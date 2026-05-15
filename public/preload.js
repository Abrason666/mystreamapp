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
  },
  cleanExpiredCache: () => {
    return ipcRenderer.invoke('clean-expired-cache');
  },
  getAllContinueWatching: () => {
    return ipcRenderer.invoke('get-all-continue-watching');
  },

  // ── AGGIORNAMENTI ──────────────────────────────────────────────────────────
  onUpdateAvailable:    (cb) => ipcRenderer.on('update-available',         (_, info) => cb(info)),
  onUpdateProgress:     (cb) => ipcRenderer.on('update-download-progress', (_, p)    => cb(p)),
  onUpdateDownloaded:   (cb) => ipcRenderer.on('update-downloaded',        ()        => cb()),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available',     ()        => cb()),
  onUpdateError:        (cb) => ipcRenderer.on('update-error',             (_, err)  => cb(err)),
  startUpdateDownload:  ()   => ipcRenderer.invoke('update-start-download'),
  installUpdate:        ()   => ipcRenderer.invoke('update-install-now'),
  checkForUpdates:      ()   => ipcRenderer.invoke('update-check-manually'),
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('update-error');
  },
});