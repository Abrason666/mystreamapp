const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

// ========================================
// CONFIGURAZIONE LOGGING
// ========================================
log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.info('📂 Log salvato in:', log.transports.file.getFile().path);
log.info('🚀 Electron avviato');

// ========================================
// VARIABILI GLOBALI
// ========================================
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === 'true';
let mainWindow;

// ========================================
// AD-BLOCKER
// ========================================
const adBlockFilters = [
  '*://*/ads/*',
  '*://*/advertisements/*',
  '*://*/popup*',
  '*://*/pop-up*',
  '*://*.doubleclick.net/*',
  '*://*.googleadservices.com/*',
  '*://*.googlesyndication.com/*'
];

// ========================================
// STORAGE PERSISTENTE
// ========================================
const userDataPath = app.getPath('userData');
const dataFilePath = path.join(userDataPath, 'mystream-data.json');

function saveDataToFile(key, value) {
  try {
    let data = {};
    if (fs.existsSync(dataFilePath)) {
      const fileContent = fs.readFileSync(dataFilePath, 'utf8');
      data = JSON.parse(fileContent);
    }
    
    data[key] = value;
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    log.info(`💾 Dati salvati: ${key}`);
  } catch (error) {
    log.error('❌ Errore salvataggio:', error);
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
    log.error('❌ Errore caricamento:', error);
  }
  return null;
}

// ========================================
// CREAZIONE FINESTRA
// ========================================
function createWindow() {
  const ses = session.defaultSession;
  
  // Abilita ad-blocker
  ses.webRequest.onBeforeRequest({ urls: adBlockFilters }, (details, callback) => {
    log.info('🚫 Pubblicità bloccata:', details.url);
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
    show: false,
    fullscreenable: true,
    backgroundColor: '#1e3c72',
    icon: path.join(__dirname, 'images/logo512.png')
  });

  // ========================================
  // GESTORI IPC
  // ========================================
  ipcMain.handle('save-data', async (event, key, value) => {
    saveDataToFile(key, value);
  });

  ipcMain.handle('load-data', async (event, key) => {
    return loadDataFromFile(key);
  });

  ipcMain.handle('close-app', async () => {
    log.info('🚪 Chiusura app richiesta');
    app.quit();
  });

  // 🆕 GESTORI IPC PER NAVIGAZIONE AVANTI/INDIETRO
  ipcMain.handle('can-go-back', () => {
    if (mainWindow && mainWindow.webContents) {
      return mainWindow.webContents.canGoBack();
    }
    return false;
  });

  ipcMain.handle('can-go-forward', () => {
    if (mainWindow && mainWindow.webContents) {
      return mainWindow.webContents.canGoForward();
    }
    return false;
  });

  ipcMain.handle('go-back', () => {
    if (mainWindow && mainWindow.webContents && mainWindow.webContents.canGoBack()) {
      mainWindow.webContents.goBack();
      log.info('⬅️ Navigazione indietro');
    }
  });

  ipcMain.handle('go-forward', () => {
    if (mainWindow && mainWindow.webContents && mainWindow.webContents.canGoForward()) {
      mainWindow.webContents.goForward();
      log.info('➡️ Navigazione avanti');
    }
  });

  // Blocca nuove finestre
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return { action: 'deny' };
  });

  // ========================================
  // CARICAMENTO CONTENUTO
  // ========================================
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
    log.info('🔧 Modalità sviluppo');
  } else {
    const express = require('express');
    const serverApp = express();
    const buildPath = path.join(__dirname, '../build');
    
    log.info('📁 Build path:', buildPath);
    
    // 🔧 REWRITE PATH - DEVE STARE PRIMA DI express.static!
    serverApp.use((req, res, next) => {
      // Se l'URL contiene /static/ in qualsiasi posizione, estrai solo la parte /static/...
      if (req.url.includes('/static/')) {
        const staticIndex = req.url.indexOf('/static/');
        req.url = req.url.substring(staticIndex);
        log.info(`🔧 Path rewrite: ${req.url}`);
      }
      next();
    });
    
    // 🔧 Serve file statici con configurazione corretta
    serverApp.use(express.static(buildPath, {
      setHeaders: (res, filepath) => {
        // Assicura che i file JS abbiano il content-type corretto
        if (filepath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        }
        if (filepath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        }
      }
    }));
    
    // 🆕 CATCH-ALL per React Router (usando funzione middleware)
    serverApp.use((req, res, next) => {
      // Serve index.html per tutte le altre richieste
      res.sendFile(path.join(buildPath, 'index.html'), (err) => {
        if (err) {
          log.error('❌ Errore:', err);
          res.status(500).send('Errore');
        }
      });
    });
    
    const server = serverApp.listen(0, () => {
      const port = server.address().port;
      const url = `http://localhost:${port}`;
      log.info('🌐 Server locale:', url);
      
      mainWindow.loadURL(url);
    });
  }

  // ========================================
  // MOSTRA FINESTRA
  // ========================================
  mainWindow.once('ready-to-show', () => {
    log.info('⏳ App pronta, caricamento...');
    
    setTimeout(() => {
      log.info('✅ Mostrando app');
      mainWindow.show();
      
      setTimeout(() => {
        if (!mainWindow.isFullScreen()) {
          mainWindow.setFullScreen(true);
        }
        log.info('🚀 CatStreamApp avviata');
      }, 100);
      
    }, 2000);
  });

  mainWindow.webContents.once('did-finish-load', () => {
    log.info('🎯 React caricato');
  });

  // Gestione fullscreen
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

  // Fallback sicurezza
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      log.info('⚠️ Fallback: mostrando app');
      mainWindow.show();
      if (!mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(true);
      }
    }
  }, 8000);

  return mainWindow;
}

// ========================================
// APP LIFECYCLE
// ========================================
app.whenReady().then(() => {
  const window = createWindow();
  
  // 🔍 DEBUG: Stampa variabili ambiente
  log.info('🔍 DEBUG - Variabili ambiente:');
  log.info('🔍 isDev:', isDev);
  log.info('🔍 NODE_ENV:', process.env.NODE_ENV);
  log.info('🔍 ELECTRON_IS_DEV:', process.env.ELECTRON_IS_DEV);
  log.info('🔍 __dirname:', __dirname);
  
  // ✅ ATTIVA AUTO-UPDATER (SOLO IN PRODUZIONE)
  if (!isDev) {
    log.info('🔄 Inizializzazione auto-updater...');
    try {
      const { initAutoUpdater } = require('./autoUpdater');
      initAutoUpdater(mainWindow);
      log.info('✅ Auto-updater caricato con successo');
    } catch (error) {
      log.error('❌ Errore caricamento auto-updater:', error);
    }
  } else {
    log.info('⚙️ Dev mode: auto-updater disabilitato');
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