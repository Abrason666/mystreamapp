import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, CheckCircle, AlertTriangle } from 'lucide-react';
import './UpdateNotification.css';

function formatSpeed(bps) {
  if (!bps) return '';
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function UpdateNotification() {
  const [state,     setState]     = useState(null); // null | 'available' | 'downloading' | 'downloaded' | 'error'
  const [version,   setVersion]   = useState('');
  const [progress,  setProgress]  = useState(0);
  const [speed,     setSpeed]     = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Funzioni di simulazione per test (usabili dalla console DevTools)
    window.__simulateUpdate = {
      available:   (v = '9.9.9') => { setVersion(v); setDismissed(false); setState('available'); },
      downloading: (pct = 45)    => { setProgress(pct); setSpeed(2.3 * 1024 * 1024); setState('downloading'); },
      downloaded:  ()            => { setProgress(100); setState('downloaded'); },
      error:       ()            => { setState('error'); setTimeout(() => setState(null), 5000); },
      reset:       ()            => { setState(null); setDismissed(false); },
    };

    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable((info) => {
      setVersion(info.version);
      setDismissed(false);
      setState('available');
    });

    window.electronAPI.onUpdateProgress((p) => {
      setProgress(p.percent);
      setSpeed(p.bytesPerSecond);
      setState('downloading');
    });

    window.electronAPI.onUpdateDownloaded(() => {
      setProgress(100);
      setState('downloaded');
    });

    window.electronAPI.onUpdateError(() => {
      setState('error');
      setTimeout(() => setState(null), 5000);
    });

    return () => {
      window.electronAPI.removeUpdateListeners?.();
      delete window.__simulateUpdate;
    };
  }, []);

  if (!window.electronAPI || !state || dismissed) return null;

  const handleDownload = () => {
    window.electronAPI.startUpdateDownload();
    setState('downloading');
    setProgress(0);
  };

  const handleInstall = () => window.electronAPI.installUpdate();
  const handleDismiss = () => setDismissed(true);

  return (
    <div className={`upd-card upd-${state}`}>

      {/* ── AVAILABLE ── */}
      {state === 'available' && (
        <>
          <button className="upd-close" onClick={handleDismiss} aria-label="Chiudi">
            <X size={15} />
          </button>
          <div className="upd-icon-wrap upd-icon-blue">
            <Download size={20} />
          </div>
          <div className="upd-body">
            <p className="upd-title">Aggiornamento disponibile</p>
            <p className="upd-sub">Versione {version} pronta al download</p>
            <div className="upd-actions">
              <button className="upd-btn-primary" onClick={handleDownload}>
                <Download size={14} /> Scarica ora
              </button>
              <button className="upd-btn-ghost" onClick={handleDismiss}>
                Più tardi
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── DOWNLOADING ── */}
      {state === 'downloading' && (
        <>
          <div className="upd-icon-wrap upd-icon-orange upd-spin">
            <RefreshCw size={20} />
          </div>
          <div className="upd-body">
            <p className="upd-title">Download in corso…</p>
            <div className="upd-progress-row">
              <div className="upd-progress-track">
                <div className="upd-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="upd-percent">{progress}%</span>
            </div>
            {speed > 0 && (
              <p className="upd-speed">{formatSpeed(speed)}</p>
            )}
          </div>
        </>
      )}

      {/* ── DOWNLOADED ── */}
      {state === 'downloaded' && (
        <>
          <button className="upd-close" onClick={handleDismiss} aria-label="Chiudi">
            <X size={15} />
          </button>
          <div className="upd-icon-wrap upd-icon-green">
            <CheckCircle size={20} />
          </div>
          <div className="upd-body">
            <p className="upd-title">Pronto per l'installazione</p>
            <p className="upd-sub">Riavvia l'app per applicare l'aggiornamento</p>
            <div className="upd-actions">
              <button className="upd-btn-primary" onClick={handleInstall}>
                <RefreshCw size={14} /> Riavvia ora
              </button>
              <button className="upd-btn-ghost" onClick={handleDismiss}>
                Più tardi
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── ERROR ── */}
      {state === 'error' && (
        <>
          <div className="upd-icon-wrap upd-icon-red">
            <AlertTriangle size={20} />
          </div>
          <div className="upd-body">
            <p className="upd-title">Errore durante l'aggiornamento</p>
            <p className="upd-sub">Riproverò automaticamente più tardi</p>
          </div>
        </>
      )}

    </div>
  );
}

export default UpdateNotification;
