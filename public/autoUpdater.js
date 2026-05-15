const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = false;
autoUpdater.disableWebInstaller = true;
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;

const CHECK_INTERVAL = 60 * 60 * 1000; // 1 ora

let mainWindowRef  = null;
let checkIntervalId = null;

// Invia un evento IPC alla finestra React
function send(channel, payload) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, payload);
  }
}

// ── EVENTI AUTO-UPDATER ───────────────────────────────────────────────────────

autoUpdater.on('update-available', (info) => {
  log.info('Aggiornamento disponibile:', info.version);
  send('update-available', { version: info.version });
});

autoUpdater.on('update-not-available', () => {
  log.info('App già aggiornata');
  send('update-not-available', {});
});

autoUpdater.on('download-progress', (progress) => {
  log.info(`Download: ${Math.round(progress.percent)}%`);
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.setProgressBar(progress.percent / 100);
  }
  send('update-download-progress', {
    percent:        Math.round(progress.percent),
    bytesPerSecond: progress.bytesPerSecond,
    transferred:    progress.transferred,
    total:          progress.total,
  });
});

autoUpdater.on('update-downloaded', () => {
  log.info('Aggiornamento scaricato');
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.setProgressBar(-1);
  }
  send('update-downloaded', {});
});

autoUpdater.on('error', (error) => {
  log.error('Errore auto-updater:', error);
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.setProgressBar(-1);
  }
  const msg = error.message || error.toString();
  // Ignora errori di firma (non critici)
  if (!msg.includes('signed') && !msg.includes('signature')) {
    send('update-error', { message: msg });
  }
});

// ── FUNZIONI PUBBLICHE ────────────────────────────────────────────────────────

function initAutoUpdater(mainWindow) {
  log.info('Auto-updater inizializzato');
  mainWindowRef = mainWindow;

  // Comandi dal renderer
  ipcMain.handle('update-start-download', () => {
    log.info('Avvio download aggiornamento');
    autoUpdater.downloadUpdate();
  });

  ipcMain.handle('update-install-now', () => {
    log.info('Installazione aggiornamento...');
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('update-check-manually', () => {
    log.info('Controllo manuale aggiornamenti');
    autoUpdater.checkForUpdates().catch(err => log.error('Errore controllo:', err));
  });

  // Primo controllo dopo 10s dall'avvio
  setTimeout(() => {
    log.info('Primo controllo aggiornamenti...');
    autoUpdater.checkForUpdates().catch(err => log.error('Errore controllo iniziale:', err));
  }, 10000);

  // Controllo periodico ogni ora
  checkIntervalId = setInterval(() => {
    log.info('Controllo periodico aggiornamenti...');
    autoUpdater.checkForUpdates().catch(err => log.error('Errore controllo periodico:', err));
  }, CHECK_INTERVAL);
}

function destroyAutoUpdater() {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
  try { ipcMain.removeHandler('update-start-download'); } catch {}
  try { ipcMain.removeHandler('update-install-now');    } catch {}
  try { ipcMain.removeHandler('update-check-manually'); } catch {}
}

module.exports = { initAutoUpdater, destroyAutoUpdater };
