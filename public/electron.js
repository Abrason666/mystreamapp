const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === 'true';

// ✨ IMPORTA AUTO-UPDATER
const { initAutoUpdater } = require('./autoUpdater');

let mainWindow;

const adBlockFilters = [
  '*://*/ads/*',
  '*://*/advertisements/*',
  '*://*/popup*',
  '*://*/pop-up*',
  '*://*.doubleclick.net/*',
  '*://*.googleadservices.com/*',
  '*://*.googlesyndication.com/*'
];

const fs = require('fs');

// Path per salvare dati persistenti
const userDataPath = app.getPath('userData');
const dataFilePath = path.join(userDataPath, 'mystream-data.json');

// Timing professionale
const LOADING_DURATION = isDev ? 2000 : 2000;
const FALLBACK_TIMEOUT = 8000;

// Funzioni per salvare dati su file
function saveDataToFile(key, value) {
  try {
    let data = {};
    if (fs.existsSync(dataFilePath)) {
      const fileContent = fs.readFileSync(dataFilePath, 'utf8');
      data = JSON.parse(fileContent);
    }
    
    data[key] = value;
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    console.log(`💾 Dati salvati: ${key}`);
  } catch (error) {
    console.error('❌ Errore salvataggio:', error);
  }
}

function loadDataFromFile(key) {
  try {
    if (fs.existsSync(dataFilePath)) {
      const fileContent = fs.readFileSync(dataFilePath, 'utf8');
      const data = JSON.parse(fileContent);
      return data[key] || null;
    }
  } catch (error) {
    console.error('❌ Errore caricamento:', error);
  }
  return null;
}

function createWindow() {
  const ses = session.defaultSession;
  
  ses.webRequest.onBeforeRequest({ urls: adBlockFilters }, (details, callback) => {
    console.log('🚫 Richiesta pubblicitaria bloccata:', details.url);
    callback({ cancel: true });
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    fullscreen: true,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
    title: 'CatStreamApp v1.1.5',
    show: false, // Inizialmente nascosta
    fullscreenable: true,
    backgroundColor: '#1e3c72', // Colore dell'app - NESSUN FLASH
    icon: path.join(__dirname, 'images/logo512.png') // ✨ ICONA NELLA FINESTRA
  });

  const { ipcMain } = require('electron');

  // Gestori IPC per salvare/caricare dati
  ipcMain.handle('save-data', async (event, key, value) => {
    saveDataToFile(key, value);
  });

  ipcMain.handle('load-data', async (event, key) => {
    return loadDataFromFile(key);
  });

  ipcMain.handle('close-app', async () => {
    console.log('🚪 Richiesta chiusura app dall\'utente');
    app.quit();
  });

  // ✨ NUOVO: Handler per controllo manuale update
  ipcMain.handle('check-for-updates', async () => {
    const { checkForUpdatesManually } = require('./autoUpdater');
    checkForUpdatesManually();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const express = require('express');
    const serverApp = express();
    const buildPath = path.join(__dirname, '../build');
    
    console.log('📁 Build path:', buildPath);
    
    // Serve file statici
    serverApp.use(express.static(buildPath));
    
    // SPA fallback
    serverApp.use((req, res) => {
      res.sendFile(path.join(buildPath, 'index.html'), (err) => {
        if (err) {
          console.log('❌ Errore:', err);
          res.status(500).send('Errore');
        }
      });
    });
    
    const server = serverApp.listen(0, () => {
      const port = server.address().port;
      const url = `http://localhost:${port}`;
      console.log('🌐 Server su:', url);
      
      mainWindow.loadURL(url);
    });
  }

  // APPROCCIO SEMPLICE E EFFICACE - NESSUN SPLASH, SOLO ATTESA
  mainWindow.once('ready-to-show', () => {
    console.log('⏳ App pronta, caricamento in corso...');
    
    // Timer principale - professionale ma senza complicazioni
    setTimeout(() => {
      console.log('✅ Caricamento completato, mostrando app');
      
      mainWindow.show();
      
      // Assicurati che sia fullscreen
      setTimeout(() => {
        if (!mainWindow.isFullScreen()) {
          mainWindow.setFullScreen(true);
        }
        console.log('🚀 CatStreamApp avviata con successo');
      }, 100);
      
    }, LOADING_DURATION);
  });

  // Opzionale: mostra prima se completamente caricata
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('🎯 React completamente caricato');
    
    // Se vuoi, puoi ridurre il tempo qui
    // Ma per sicurezza manteniamo il timer originale
  });

  // Gestione tasti per fullscreen
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      const isFullScreen = mainWindow.isFullScreen();
      mainWindow.setFullScreen(!isFullScreen);
    }
    
    if (input.key === 'Escape' && input.type === 'keyDown') {
      if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Fallback di sicurezza
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('⚠️ Fallback: mostrando app dopo timeout');
      mainWindow.show();
      if (!mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(true);
      }
    }
  }, FALLBACK_TIMEOUT);
}

// ========================================
// APP LIFECYCLE
// ========================================

app.whenReady().then(() => {
  createWindow();
  
  // ✨ ATTIVA AUTO-UPDATER dopo che la finestra è pronta
  // Solo in produzione (non in sviluppo)
  if (!isDev) {
    console.log('🔄 Inizializzazione auto-updater...');
    initAutoUpdater(mainWindow);
  } else {
    console.log('⚙️ Modalità sviluppo: auto-updater disabilitato');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});