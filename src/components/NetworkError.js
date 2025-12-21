import React from 'react';
import './NetworkError.css';

/**
 * Componente per mostrare errori di rete
 * @param {string} message - Messaggio personalizzato (opzionale)
 * @param {Function} onRetry - Funzione da chiamare quando l'utente clicca "Riprova"
 * @param {boolean} showRetry - Mostra il pulsante "Riprova" (default: true)
 */
function NetworkError({ message, onRetry, showRetry = true }) {
  return (
    <div className="network-error">
      <div className="network-error-content">
        <div className="network-error-icon">
          📡
        </div>
        <h2 className="network-error-title">Nessuna Connessione</h2>
        <p className="network-error-message">
          {message || 'Impossibile connettersi a Internet. Controlla la tua connessione e riprova.'}
        </p>
        {showRetry && onRetry && (
          <button 
            className="btn btn-primary network-error-retry"
            onClick={onRetry}
          >
            🔄 Riprova
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Componente inline più piccolo per errori di rete
 */
export function NetworkErrorInline({ message, onRetry }) {
  return (
    <div className="network-error-inline">
      <span className="network-error-inline-icon">📡</span>
      <span className="network-error-inline-text">
        {message || 'Nessuna connessione'}
      </span>
      {onRetry && (
        <button 
          className="network-error-inline-retry"
          onClick={onRetry}
        >
          Riprova
        </button>
      )}
    </div>
  );
}

export default NetworkError;