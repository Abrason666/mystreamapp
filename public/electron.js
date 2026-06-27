const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { version } = require('../package.json');

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
    // Scrittura atomica: prima su un file temporaneo, poi rinominato sopra
    // l'originale. fs.renameSync sullo stesso volume è atomico (anche su
    // Windows, via MoveFileEx con replace) — se l'app crasha o viene chiusa a
    // metà, il file originale resta intatto invece di restare troncato/corrotto
    // (il rischio: PRIMA si scriveva direttamente sul file vero).
    const tmpPath = `${dataFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, dataFilePath);
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
// BROWSER-SNIFF (tier 3 del resolver vixsrc)
// ========================================
// Se il resolver HTTP nel renderer (fetch puro su API/pagine embed) non trova
// l'URL della playlist HLS — vixsrc ha cambiato markup — come ultima risorsa
// PRIMA del fallback all'iframe carichiamo la pagina del player in una
// BrowserWindow NASCOSTA e intercettiamo il traffico di rete in uscita: appena
// passa una richiesta verso /playlist/ o un .m3u8, abbiamo l'URL, senza
// dipendere da nessun pattern HTML/JS — funziona finché il sito riesce a
// riprodurre qualcosa. Niente Playwright: Electron ha già Chromium integrato.
// Validato isolatamente nel progetto di test (scraper_test) prima di portarlo
// qui: 3/3 contenuti di prova hanno prodotto un master HLS valido.
const VIXSRC_ROOT = 'https://vixsrc.to';
const SNIFF_KEYWORDS = ['/playlist/', '.m3u8'];
const SNIFF_TIMEOUT_MS = 25000;
const SNIFF_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';
// Partition NON persistente (niente prefisso "persist:"): vive solo in
// memoria, sparisce alla chiusura dell'app, isolata dalla sessione della
// finestra principale (niente condivisione di cookie/cache).
const SNIFF_PARTITION = 'electron-vixsrc-sniff';

function sniffPageUrls({ type, id, season, episode }) {
  return type === 'tv'
    ? [`${VIXSRC_ROOT}/tv/${id}/${season}/${episode}`, `${VIXSRC_ROOT}/embed/tv/${id}/${season}/${episode}`]
    : [`${VIXSRC_ROOT}/movie/${id}`, `${VIXSRC_ROOT}/embed/movie/${id}`];
}

// Serializza i tentativi: la sessione di sniff ha UN solo listener onBeforeRequest
// alla volta, quindi due chiamate in contemporanea si scavalcherebbero a vicenda
// (l'ultima registrata "vince", l'altra non vedrebbe mai la sua richiesta).
let sniffQueue = Promise.resolve();
function browserSniffMaster(params) {
  const run = sniffQueue.then(() => sniffOnePage(params));
  sniffQueue = run.catch(() => {}); // la coda prosegue anche se questo tentativo fallisce
  return run;
}

async function sniffOnePage({ type, id, season, episode }) {
  const pageUrls = sniffPageUrls({ type, id, season, episode });
  const ses = session.fromPartition(SNIFF_PARTITION);

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.setUserAgent(SNIFF_USER_AGENT);

  try {
    for (const pageUrl of pageUrls) {
      const found = await new Promise((resolve) => {
        let settled = false;
        const finish = (url) => {
          if (settled) return;
          settled = true;
          ses.webRequest.onBeforeRequest(null);
          resolve(url);
        };

        const timer = setTimeout(() => finish(null), SNIFF_TIMEOUT_MS);

        ses.webRequest.onBeforeRequest((details, callback) => {
          if (!settled && SNIFF_KEYWORDS.some((k) => details.url.includes(k))) {
            clearTimeout(timer);
            finish(details.url);
          }
          callback({}); // osserva soltanto, non blocca mai la richiesta
        });

        win.loadURL(pageUrl, { httpReferrer: `${VIXSRC_ROOT}/` }).catch(() => {});

        // alcuni player partono solo con interazione: un click al centro come
        // fallback, dato un attimo alla pagina per caricarsi prima
        setTimeout(() => {
          if (settled || win.isDestroyed()) return;
          const { width, height } = win.getBounds();
          const x = Math.round(width / 2), y = Math.round(height / 2);
          win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
          win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        }, 2500);
      });

      if (found) return found;
    }
    return null;
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
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

  // 🎬 CORS per il resolver/player nativo: vixsrc non espone Access-Control-Allow-Origin
  // su /api e /embed, quindi il fetch dal renderer verrebbe bloccato. Iniettiamo l'header
  // sulle risposte di vixsrc (e del CDN dei segmenti) così il player nativo può risolvere
  // e riprodurre. Stessa cosa per image.tmdb.org: cacheService.cacheImage() fa un fetch()
  // per salvare i poster in locale, bloccato dal CORS del CDN TMDB (l'<img> funziona
  // comunque, ma la cache resta disabilitata). Additivo: non tocca il resto (l'iframe
  // carica vixsrc come documento, le <img> caricano TMDB normalmente).
  ses.webRequest.onHeadersReceived(
    { urls: ['*://vixsrc.to/*', '*://*.vixsrc.to/*', '*://*.vix-content.net/*', '*://image.tmdb.org/*'] },
    (details, callback) => {
      const headers = details.responseHeaders || {};
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === 'access-control-allow-origin') delete headers[k];
      }
      headers['Access-Control-Allow-Origin'] = ['*'];
      callback({ responseHeaders: headers });
    }
  );

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    fullscreen: true,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
    title: `CatStreamApp v${version}`,
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

  ipcMain.handle('get-all-continue-watching', async () => {
    try {
      if (!fs.existsSync(dataFilePath)) return [];
      const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      const entries = [];
      for (const key of Object.keys(data)) {
        if (!key.startsWith('mystream_continue_')) continue;
        try {
          const val = typeof data[key] === 'string' ? JSON.parse(data[key]) : data[key];
          if (val) entries.push({ tmdbId: key.replace('mystream_continue_', ''), ...val });
        } catch {}
      }
      return entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } catch (error) {
      log.error('Errore getAllContinueWatching:', error);
      return [];
    }
  });

  ipcMain.handle('clean-expired-cache', async () => {
    try {
      if (!fs.existsSync(dataFilePath)) return 0;
      const fileContent = fs.readFileSync(dataFilePath, 'utf8');
      const data = JSON.parse(fileContent);
      const now = Date.now();
      let cleaned = 0;

      for (const key of Object.keys(data)) {
        if (!key.startsWith('cache_')) continue;
        try {
          const entry = typeof data[key] === 'string' ? JSON.parse(data[key]) : data[key];
          if (entry && entry.expires && now > entry.expires) {
            delete data[key];
            cleaned++;
          }
        } catch {
          delete data[key];
          cleaned++;
        }
      }

      if (cleaned > 0) {
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
        log.info(`🧹 Cache pulita: ${cleaned} elementi scaduti rimossi`);
      }
      return cleaned;
    } catch (error) {
      log.error('❌ Errore pulizia cache:', error);
      return 0;
    }
  });

  ipcMain.handle('close-app', async () => {
    log.info('🚪 Chiusura app richiesta');
    app.quit();
  });

  // 🆕 Tier 3 del resolver vixsrc — vedi commento sopra a sniffOnePage()
  ipcMain.handle('browser-sniff', async (event, params) => {
    try {
      const url = await browserSniffMaster(params || {});
      log.info(url ? `🔎 browser-sniff: trovato ${url}` : '🔎 browser-sniff: nessun URL intercettato');
      return { url };
    } catch (error) {
      log.error('❌ Errore browser-sniff:', error);
      return { url: null, error: error.message };
    }
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
    try {
      const { destroyAutoUpdater } = require('./autoUpdater');
      destroyAutoUpdater();
    } catch {}
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