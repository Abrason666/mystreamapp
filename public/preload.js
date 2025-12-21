const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveData: (key, value) => {
    return ipcRenderer.invoke('save-data', key, value);
  },
  loadData: (key) => {
    return ipcRenderer.invoke('load-data', key);
  },
  closeApp: () => {
    return ipcRenderer.invoke('close-app');
  }
});