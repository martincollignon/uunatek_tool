const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');
const fs = require('fs');
const url = require('url');

/**
 * Load environment variables from .env file
 * @param {string} envPath - Path to the .env file
 * @returns {Object} Object containing environment variables
 */
function loadEnvFile(envPath) {
  const env = {};

  if (!fs.existsSync(envPath)) {
    return env;
  }

  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      // Skip empty lines and comments
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Parse KEY=VALUE format
      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        env[key] = value;
      }
    }
  } catch (error) {
    console.error('Error loading .env file:', error);
  }

  return env;
}

let mainWindow;
let backendProcess;

// Determine paths based on dev/production mode
const BACKEND_PATH = isDev
  ? path.join(__dirname, '..', 'backend')
  : path.join(process.resourcesPath, 'backend', 'plotter-backend');

const FRONTEND_PATH = isDev
  ? null // In dev, we'll use the dev server
  : path.join(app.getAppPath(), 'frontend', 'dist', 'index.html');

const BACKEND_PORT = 8000;

/**
 * Start the Python backend server
 */
function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('Starting backend from:', BACKEND_PATH);

    // Load environment variables from multiple locations
    let envVars = { ...process.env };

    // Location 1: User's Application Support directory (recommended for users)
    const appSupportDir = path.join(app.getPath('userData'), '.env');
    const userEnv = loadEnvFile(appSupportDir);
    console.log('Loaded env from Application Support:', Object.keys(userEnv).length, 'variables');

    // Location 2: Development .env file (for development mode)
    if (isDev) {
      const devEnvPath = path.join(__dirname, '..', 'backend', '.env');
      const devEnv = loadEnvFile(devEnvPath);
      console.log('Loaded env from development:', Object.keys(devEnv).length, 'variables');
      envVars = { ...envVars, ...devEnv };
    }

    // Location 3: User's env (highest priority)
    envVars = { ...envVars, ...userEnv };

    console.log('GEMINI_API_KEY configured:', !!envVars.GEMINI_API_KEY);
    console.log('Application Support path:', appSupportDir);

    let backendCmd;
    let backendArgs;

    if (isDev) {
      // Development: Run with Python
      backendCmd = 'python3';
      backendArgs = ['-m', 'uvicorn', 'main:app', '--port', BACKEND_PORT.toString()];
      const backendDir = path.join(__dirname, '..', 'backend');

      backendProcess = spawn(backendCmd, backendArgs, {
        cwd: backendDir,
        env: envVars,
      });
    } else {
      // Production: Run the bundled executable
      backendCmd = BACKEND_PATH;
      backendArgs = [];

      if (!fs.existsSync(backendCmd)) {
        reject(new Error(`Backend executable not found at: ${backendCmd}`));
        return;
      }

      backendProcess = spawn(backendCmd, backendArgs, {
        env: envVars,
      });
    }

    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend: ${data}`);

      // Wait for server to be ready
      if (data.toString().includes('Uvicorn running') || data.toString().includes('Application startup complete')) {
        resolve();
      }
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend Error: ${data}`);
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
      reject(err);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
    });

    // Give it a few seconds to start
    setTimeout(resolve, 3000);
  });
}

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
    },
    title: 'Pen Plotter',
    show: false, // Don't show until ready
  });

  // Load the frontend
  let startUrl;
  if (isDev) {
    startUrl = 'http://localhost:5173'; // Vite dev server
  } else {
    startUrl = url.format({
      pathname: FRONTEND_PATH,
      protocol: 'file:',
      slashes: true
    });
  }

  console.log('Loading URL:', startUrl);
  console.log('Frontend path:', FRONTEND_PATH);
  console.log('App path:', app.getAppPath());
  console.log('isDev:', isDev);

  mainWindow.loadURL(startUrl);

  // Log any load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development (and in production for debugging)
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Application lifecycle
 */
app.on('ready', async () => {
  try {
    // Start backend first
    await startBackend();

    // Then create the window
    createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start the backend server:\n\n${error.message}\n\nPlease check that Python and all dependencies are installed.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Kill backend process
  if (backendProcess) {
    backendProcess.kill();
  }

  // On macOS, keep app running until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Clean up on quit
app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Error', `An unexpected error occurred:\n\n${error.message}`);
});
