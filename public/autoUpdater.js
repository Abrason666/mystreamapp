const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');
const log = require('electron-log');

// ========================================
// CONFIGURAZIONE
// ========================================
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = false; // Chiedi prima di scaricare

// 🔓 CONFIGURAZIONE PER CERTIFICATO SELF-SIGNED
autoUpdater.disableWebInstaller = true;
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;

const CHECK_INTERVAL = 60 * 60 * 1000; // 1 ora

// Riferimento alla finestra principale
let mainWindowRef = null;

// ========================================
// EVENTI AUTO-UPDATER
// ========================================

// Update disponibile
autoUpdater.on('update-available', (info) => {
  log.info('✅ Update disponibile:', info.version);
  
  const { app } = require('electron');
  const currentVersion = app.getVersion();
  
  dialog.showMessageBox({
    type: 'info',
    title: 'Aggiornamento Disponibile',
    message: `🎉 Nuova versione ${info.version} disponibile!`,
    detail: `Versione attuale: ${currentVersion}\nNuova versione: ${info.version}\n\nVuoi scaricarla ora?`,
    buttons: ['📥 Scarica Ora', '⏰ Più Tardi'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      log.info('📥 Inizio download update');
      
      // Mostra notifica Windows
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('download-started');
      }
      
      // Inizia download
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

// Download in corso - BARRA NATIVA WINDOWS
autoUpdater.on('download-progress', (progress) => {
  const percent = Math.round(progress.percent);
  log.info(`📥 Download: ${percent}%`);
  
  // 🎯 BARRA PROGRESSO NATIVA WINDOWS (TASKBAR)
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    // Imposta progresso sulla taskbar di Windows
    mainWindowRef.setProgressBar(progress.percent / 100);
  }
});

// Download completato
autoUpdater.on('update-downloaded', () => {
  log.info('✅ Update scaricato');
  
  // ✅ Reset barra progresso Windows
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.setProgressBar(-1); // -1 = nasconde la barra
  }
  
  // Mostra dialog installazione
  dialog.showMessageBox({
    type: 'info',
    title: '✅ Aggiornamento Pronto',
    message: 'L\'aggiornamento è stato scaricato con successo!',
    detail: 'L\'app verrà riavviata per completare l\'installazione.\n\nTutti i tuoi dati e preferiti saranno mantenuti.',
    buttons: ['🔄 Riavvia Ora', '⏰ Più Tardi'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      log.info('🔄 Installazione update...');
      autoUpdater.quitAndInstall(false, true);
    } else {
      log.info('⏰ Installazione posticipata');
    }
  });
});

// Errore
autoUpdater.on('error', (error) => {
  log.error('❌ Errore auto-updater:', error);
  
  // Reset barra progresso
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.setProgressBar(-1);
  }
  
  // Non mostrare errore se è solo controllo firma
  const errorMsg = error.message || error.toString();
  if (!errorMsg.includes('signed') && !errorMsg.includes('signature')) {
    dialog.showMessageBox({
      type: 'warning',
      title: '⚠️ Errore Aggiornamento',
      message: 'Si è verificato un errore durante l\'aggiornamento.',
      detail: 'Riproverò automaticamente più tardi.\n\nSe il problema persiste, verifica la connessione Internet.',
      buttons: ['OK']
    });
  }
});

// ========================================
// FUNZIONI PUBBLICHE
// ========================================

/**
 * Inizializza auto-updater
 * @param {BrowserWindow} mainWindow - Finestra principale dell'app
 */
function initAutoUpdater(mainWindow) {
  log.info('🔧 Auto-updater inizializzato');
  
  // Salva riferimento alla finestra principale
  mainWindowRef = mainWindow;
  
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
 * Controllo manuale (per menu "Controlla aggiornamenti")
 */
function checkForUpdatesManually() {
  log.info('🔍 Controllo manuale richiesto');
  
  autoUpdater.checkForUpdates().then((result) => {
    if (!result || !result.updateInfo) {
      dialog.showMessageBox({
        type: 'info',
        title: '✅ Nessun Aggiornamento',
        message: 'Stai già usando l\'ultima versione!',
        detail: 'La tua app è aggiornata all\'ultima versione disponibile.',
        buttons: ['OK']
      });
    }
  }).catch((error) => {
    log.error('❌ Errore controllo:', error);
    dialog.showMessageBox({
      type: 'error',
      title: '❌ Errore',
      message: 'Impossibile controllare aggiornamenti.',
      detail: 'Verifica la connessione Internet e riprova.',
      buttons: ['OK']
    });
  });
}

module.exports = {
  initAutoUpdater,
  checkForUpdatesManually
};