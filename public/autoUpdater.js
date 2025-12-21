const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const log = require('electron-log');

// ========================================
// CONFIGURAZIONE
// ========================================
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = false; // Chiedi prima di scaricare

const CHECK_INTERVAL = 60 * 60 * 1000; // 1 ora

// ========================================
// EVENTI AUTO-UPDATER
// ========================================

// Update disponibile
autoUpdater.on('update-available', (info) => {
  log.info('✅ Update disponibile:', info.version);
  
  dialog.showMessageBox({
    type: 'info',
    title: 'Aggiornamento Disponibile',
    message: `Nuova versione ${info.version} disponibile!`,
    detail: 'Vuoi scaricarla ora?',
    buttons: ['Scarica', 'Dopo']
  }).then((result) => {
    if (result.response === 0) {
      log.info('📥 Inizio download update');
      autoUpdater.downloadUpdate();
    } else {
      log.info('⏰ Update posticipato');
    }
  });
});

// Nessun update
autoUpdater.on('update-not-available', () => {
  log.info('✅ App già aggiornata');
});

// Download in corso
autoUpdater.on('download-progress', (progress) => {
  const percent = Math.round(progress.percent);
  log.info(`📥 Download: ${percent}%`);
});

// Download completato
autoUpdater.on('update-downloaded', () => {
  log.info('✅ Update scaricato');
  
  dialog.showMessageBox({
    type: 'info',
    title: 'Aggiornamento Pronto',
    message: 'L\'aggiornamento è stato scaricato.',
    detail: 'L\'app verrà riavviata per completare l\'installazione.',
    buttons: ['Riavvia Ora', 'Più Tardi']
  }).then((result) => {
    if (result.response === 0) {
      log.info('🔄 Installazione update...');
      autoUpdater.quitAndInstall();
    } else {
      log.info('⏰ Installazione posticipata');
    }
  });
});

// Errore
autoUpdater.on('error', (error) => {
  log.error('❌ Errore auto-updater:', error);
});

// ========================================
// FUNZIONI PUBBLICHE
// ========================================

/**
 * Inizializza auto-updater
 */
function initAutoUpdater(mainWindow) {
  log.info('🔧 Auto-updater inizializzato');
  
  // Primo controllo dopo 10 secondi
  setTimeout(() => {
    log.info('🔍 Primo controllo update...');
    autoUpdater.checkForUpdates();
  }, 10000);
  
  // Controllo ogni ora
  setInterval(() => {
    log.info('🔍 Controllo periodico update...');
    autoUpdater.checkForUpdates();
  }, CHECK_INTERVAL);
}

/**
 * Controllo manuale (se serve in futuro)
 */
function checkForUpdatesManually() {
  log.info('🔍 Controllo manuale richiesto');
  
  autoUpdater.checkForUpdates().then((result) => {
    if (!result || !result.updateInfo) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Nessun Aggiornamento',
        message: 'Stai già usando l\'ultima versione!',
        buttons: ['OK']
      });
    }
  }).catch((error) => {
    log.error('❌ Errore controllo:', error);
    dialog.showMessageBox({
      type: 'error',
      title: 'Errore',
      message: 'Impossibile controllare aggiornamenti.',
      detail: 'Verifica la connessione Internet.',
      buttons: ['OK']
    });
  });
}

module.exports = {
  initAutoUpdater,
  checkForUpdatesManually
};