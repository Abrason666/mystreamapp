const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = false;
autoUpdater.disableWebInstaller = true;
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;

const CHECK_INTERVAL = 60 * 60 * 1000; // 1 ora

let mainWindowRef = null;
let checkIntervalId = null;
let updateAvailable = false; // guard contro race condition nel controllo manuale

// ========================================
// EVENTI
// ========================================

autoUpdater.on('update-available', (info) => {
  log.info('Aggiornamento disponibile:', info.version);
  updateAvailable = true;

  const { app } = require('electron');
  const currentVersion = app.getVersion();

  dialog.showMessageBox({
    type: 'info',
    title: 'Aggiornamento disponibile',
    message: `Nuova versione ${info.version} disponibile`,
    detail: `Versione attuale: ${currentVersion}\nNuova versione: ${info.version}\n\nVuoi scaricarla ora?`,
    buttons: ['Scarica ora', 'Piu tardi'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      log.info('Avvio download aggiornamento');
      autoUpdater.downloadUpdate();
    } else {
      log.info('Aggiornamento posticipato');
    }
  });
});

autoUpdater.on('update-not-available', () => {
  log.info('App gia aggiornata');
  updateAvailable = false;
});

autoUpdater.on('download-progress', (progress) => {
  const percent = Math.round(progress.percent);
  log.info(`Download: ${percent}%`);

  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.setProgressBar(progress.percent / 100);
  }
});

autoUpdater.on('update-downloaded', () => {
  log.info('Aggiornamento scaricato');

  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.setProgressBar(-1);
  }

  dialog.showMessageBox({
    type: 'info',
    title: 'Aggiornamento pronto',
    message: "L'aggiornamento e' stato scaricato.",
    detail: "L'app verra' riavviata per completare l'installazione.\nTutti i tuoi dati e preferiti saranno mantenuti.",
    buttons: ['Riavvia ora', 'Piu tardi'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      log.info('Installazione aggiornamento...');
      autoUpdater.quitAndInstall(false, true);
    } else {
      log.info('Installazione posticipata');
    }
  });
});

autoUpdater.on('error', (error) => {
  log.error('Errore auto-updater:', error);

  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.setProgressBar(-1);
  }

  const errorMsg = error.message || error.toString();
  if (!errorMsg.includes('signed') && !errorMsg.includes('signature')) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Errore aggiornamento',
      message: "Si e' verificato un errore durante l'aggiornamento.",
      detail: 'Riprovero automaticamente piu tardi.\n\nSe il problema persiste, verifica la connessione Internet.',
      buttons: ['OK']
    });
  }
});

// ========================================
// FUNZIONI PUBBLICHE
// ========================================

function initAutoUpdater(mainWindow) {
  log.info('Auto-updater inizializzato');
  mainWindowRef = mainWindow;

  setTimeout(() => {
    log.info('Primo controllo aggiornamenti...');
    autoUpdater.checkForUpdates().catch(err => log.error('Errore controllo iniziale:', err));
  }, 10000);

  checkIntervalId = setInterval(() => {
    log.info('Controllo periodico aggiornamenti...');
    autoUpdater.checkForUpdates().catch(err => log.error('Errore controllo periodico:', err));
  }, CHECK_INTERVAL);
}

function checkForUpdatesManually() {
  log.info('Controllo manuale richiesto');
  updateAvailable = false;

  autoUpdater.checkForUpdates().then(() => {
    // Se update-available è scattato, updateAvailable è già true e il suo dialog è già aperto
    if (!updateAvailable) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Nessun aggiornamento',
        message: "Stai gia' usando l'ultima versione!",
        detail: "La tua app e' aggiornata all'ultima versione disponibile.",
        buttons: ['OK']
      });
    }
  }).catch((error) => {
    log.error('Errore controllo:', error);
    dialog.showMessageBox({
      type: 'error',
      title: 'Errore',
      message: 'Impossibile controllare aggiornamenti.',
      detail: 'Verifica la connessione Internet e riprova.',
      buttons: ['OK']
    });
  });
}

function destroyAutoUpdater() {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
}

module.exports = {
  initAutoUpdater,
  checkForUpdatesManually,
  destroyAutoUpdater
};
