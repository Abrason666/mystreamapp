// public/autoUpdater.js
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

// ========================================
// CONFIGURAZIONE AUTO-UPDATER
// ========================================

// Log per debug
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// Controlla update ogni ora
const CHECK_INTERVAL = 60 * 60 * 1000; // 1 ora in millisecondi

// ========================================
// EVENTI AUTO-UPDATER
// ========================================

// Quando trova un update disponibile
autoUpdater.on('update-available', (info) => {
  console.log('🔄 Update disponibile!');
  console.log('Versione nuova:', info.version);
  console.log('Versione attuale:', autoUpdater.currentVersion);
  
  // Notifica l'utente
  dialog.showMessageBox({
    type: 'info',
    title: 'Aggiornamento Disponibile',
    message: `Una nuova versione (${info.version}) è disponibile!`,
    detail: 'L\'aggiornamento verrà scaricato in background.\nPotrai continuare a usare l\'app normalmente.',
    buttons: ['OK']
  });
});

// Quando l'update è stato scaricato
autoUpdater.on('update-downloaded', (info) => {
  console.log('✅ Update scaricato!');
  
  // Chiedi se vuole installare subito
  dialog.showMessageBox({
    type: 'info',
    title: 'Aggiornamento Pronto',
    message: 'L\'aggiornamento è stato scaricato.',
    detail: 'L\'app verrà riavviata per completare l\'installazione.',
    buttons: ['Riavvia Ora', 'Più Tardi']
  }).then((result) => {
    if (result.response === 0) {
      // L'utente ha cliccato "Riavvia Ora"
      console.log('🔄 Installazione update in corso...');
      autoUpdater.quitAndInstall();
    } else {
      console.log('⏰ Update posticipato dall\'utente');
    }
  });
});

// Se non ci sono update
autoUpdater.on('update-not-available', () => {
  console.log('✅ App aggiornata all\'ultima versione');
});

// Se c'è un errore
autoUpdater.on('error', (error) => {
  console.error('❌ Errore auto-update:', error);
  // Non mostrare errore all'utente per non disturbarlo
  // Gli errori vengono loggati nel file di log
});

// Durante il download
autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  console.log(`⬇️ Download update: ${percent}%`);
  
  // Potresti anche mostrare una progress bar qui se vuoi
  // Ma per semplicità, loggiamo solo la percentuale
});

// ========================================
// FUNZIONI PUBBLICHE
// ========================================

/**
 * Inizializza l'auto-updater
 * Da chiamare quando l'app si avvia
 */
function initAutoUpdater(mainWindow) {
  console.log('🔧 Inizializzazione auto-updater...');
  
  // Non controllare update in sviluppo
  if (process.env.ELECTRON_IS_DEV) {
    console.log('⚠️ Auto-update disabilitato in modalità sviluppo');
    return;
  }
  
  // Primo controllo dopo 10 secondi (per non rallentare l'avvio)
  setTimeout(() => {
    console.log('🔍 Primo controllo update...');
    autoUpdater.checkForUpdates();
  }, 10000);
  
  // Poi controlla ogni ora
  setInterval(() => {
    console.log('🔍 Controllo periodico update...');
    autoUpdater.checkForUpdates();
  }, CHECK_INTERVAL);
}

/**
 * Controlla manualmente gli update
 * Da usare se l'utente clicca "Controlla Aggiornamenti"
 */
function checkForUpdatesManually() {
  console.log('🔍 Controllo manuale update richiesto dall\'utente');
  
  autoUpdater.checkForUpdates().then((result) => {
    if (!result || !result.updateInfo) {
      // Nessun update disponibile
      dialog.showMessageBox({
        type: 'info',
        title: 'Nessun Aggiornamento',
        message: 'Stai già usando l\'ultima versione!',
        buttons: ['OK']
      });
    }
  }).catch((error) => {
    console.error('❌ Errore controllo update:', error);
    dialog.showMessageBox({
      type: 'error',
      title: 'Errore',
      message: 'Impossibile controllare gli aggiornamenti.',
      detail: 'Verifica la tua connessione a Internet.',
      buttons: ['OK']
    });
  });
}

module.exports = {
  initAutoUpdater,
  checkForUpdatesManually
};