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
  },
  // 🆕 AGGIUNTE API PER NAVIGAZIONE AVANTI/INDIETRO
  canGoBack: () => {
    return ipcRenderer.invoke('can-go-back');
  },
  canGoForward: () => {
    return ipcRenderer.invoke('can-go-forward');
  },
  goBack: () => {
    return ipcRenderer.invoke('go-back');
  },
  goForward: () => {
    return ipcRenderer.invoke('go-forward');
  }
});