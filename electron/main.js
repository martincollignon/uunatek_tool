const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');
const fs = require('fs');
const url = require('url');
const http = require('http');
const { detect } = require('detect-port');

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
let actualBackendPort;
let actualFrontendPort;

// Setup logging to file for debugging
const logFile = path.join(app.getPath('userData'), 'app.log');
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
  console.log(message);
}
logToFile('=== App Starting ===');
logToFile(`Log file: ${logFile}`);

// Determine paths based on dev/production mode
const BACKEND_PATH = isDev
  ? path.join(__dirname, '..', 'backend')
  : path.join(process.resourcesPath, 'backend', 'plotter-backend');

const FRONTEND_PATH = isDev
  ? null // In dev, we'll use the dev server
  : path.join(app.getAppPath(), 'frontend', 'dist', 'index.html');

const PREFERRED_BACKEND_PORT = 8000;
const PREFERRED_FRONTEND_PORT = 5173;

/**
 * Wait for backend to be ready by polling the health endpoint
 * @param {number} port - The port to check
 * @param {number} maxAttempts - Maximum number of attempts (default 30 = 15 seconds)
 * @param {number} intervalMs - Interval between attempts in ms (default 500)
 * @returns {Promise<boolean>} Resolves when backend is ready
 */
async function waitForBackendReady(port, maxAttempts = 30, intervalMs = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/health`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Health check returned status ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Health check timeout'));
        });
      });
      console.log(`Backend ready after ${(i + 1) * intervalMs}ms`);
      return true;
    } catch (err) {
      // Backend not ready yet, wait and retry
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
  throw new Error('Backend failed to start - no response from health endpoint after 15 seconds');
}

/**
 * Start the Python backend server
 */
async function startBackend() {
  return new Promise(async (resolve, reject) => {
    logToFile('Starting backend from: ' + BACKEND_PATH);

    // Detect available port for backend
    try {
      actualBackendPort = await detect(PREFERRED_BACKEND_PORT);
      if (actualBackendPort !== PREFERRED_BACKEND_PORT) {
        console.log(`Backend port ${PREFERRED_BACKEND_PORT} is in use, using port ${actualBackendPort} instead`);
      } else {
        console.log(`Using preferred backend port ${actualBackendPort}`);
      }
    } catch (err) {
      console.error('Error detecting backend port:', err);
      reject(err);
      return;
    }

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
      backendArgs = ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', actualBackendPort.toString()];
      const backendDir = path.join(__dirname, '..', 'backend');

      console.log('Spawning backend (dev):', backendCmd, backendArgs);
      backendProcess = spawn(backendCmd, backendArgs, {
        cwd: backendDir,
        env: envVars,
      });
    } else {
      // Production: Run the bundled executable with dynamic port
      backendCmd = BACKEND_PATH;
      backendArgs = ['--port', actualBackendPort.toString()];

      if (!fs.existsSync(backendCmd)) {
        reject(new Error(`Backend executable not found at: ${backendCmd}`));
        return;
      }

      logToFile('Spawning backend (prod): ' + backendCmd + ' ' + backendArgs.join(' '));
      backendProcess = spawn(backendCmd, backendArgs, {
        env: envVars,
      });
      logToFile('Backend process spawned with PID: ' + backendProcess.pid);
    }

    backendProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      logToFile('Backend stdout: ' + msg.trim());

      // Wait for server to be ready
      if (msg.includes('Uvicorn running') || msg.includes('Application startup complete')) {
        resolve();
      }
    });

    backendProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      logToFile('Backend stderr: ' + msg.trim());
    });

    backendProcess.on('error', (err) => {
      logToFile('FATAL: Failed to start backend process: ' + err.message);
      logToFile('Backend command: ' + backendCmd);
      logToFile('Backend args: ' + JSON.stringify(backendArgs));
      logToFile('Backend exists: ' + fs.existsSync(backendCmd));
      logToFile('Error code: ' + err.code);
      logToFile('Error stack: ' + err.stack);
      reject(err);
    });

    backendProcess.on('close', (code) => {
      logToFile(`Backend process exited with code ${code}`);
    });

    // Wait for backend to be ready via health check
    waitForBackendReady(actualBackendPort)
      .then(resolve)
      .catch(reject);
  });
}

/**
 * Create the main application window
 */
async function createWindow() {
  // In dev mode, detect available frontend port
  if (isDev) {
    try {
      actualFrontendPort = await detect(PREFERRED_FRONTEND_PORT);
      if (actualFrontendPort !== PREFERRED_FRONTEND_PORT) {
        console.log(`Frontend port ${PREFERRED_FRONTEND_PORT} is in use, using port ${actualFrontendPort} instead`);
        console.log('WARNING: You may need to start Vite on the detected port');
      } else {
        console.log(`Using preferred frontend port ${actualFrontendPort}`);
      }
    } catch (err) {
      console.error('Error detecting frontend port:', err);
      actualFrontendPort = PREFERRED_FRONTEND_PORT;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Pen Plotter',
    show: false, // Don't show until ready
  });

  // Load the frontend
  let startUrl;
  if (isDev) {
    startUrl = `http://localhost:${actualFrontendPort}`; // Vite dev server with dynamic port
  } else {
    startUrl = url.format({
      pathname: FRONTEND_PATH,
      protocol: 'file:',
      slashes: true
    });
  }

  console.log('Loading URL:', startUrl);
  console.log('Backend port:', actualBackendPort);
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
 * IPC handler to provide backend port to renderer process
 */
ipcMain.handle('get-backend-port', () => {
  return actualBackendPort;
});

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
