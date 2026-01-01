const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script to securely expose Electron APIs to the renderer process
 */
contextBridge.exposeInMainWorld('electron', {
  /**
   * Get the backend port that Electron is using
   * @returns {Promise<number>} The backend port number
   */
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
});
