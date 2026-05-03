// ========================================
// NETWORK UTILITIES - Gestione Connessione
// ========================================

/**
 * Controlla se il browser è online
 * @returns {boolean} true se online, false se offline
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Controlla se un errore è dovuto a problemi di rete
 * @param {Error} error - L'errore da analizzare
 * @returns {boolean} true se è un errore di rete
 */
export const isNetworkError = (error) => {
  if (!error) return false;
  
  // Controlla se è un errore di Axios/Fetch
  if (error.message) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('timeout') ||
      msg.includes('enotfound') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset')
    );
  }
  
  // Controlla se è un errore di Axios con codice specifico
  if (error.code) {
    return (
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ERR_NETWORK'
    );
  }
  
  // Controlla se la risposta non è arrivata
  if (error.request && !error.response) {
    return true;
  }
  
  return false;
};

/**
 * Esegue una chiamata API e gestisce gli errori di rete
 * @param {Function} apiCall - La funzione API da chiamare
 * @param {string} fallbackMessage - Messaggio da mostrare in caso di errore
 * @returns {Object} { success: boolean, data: any, error: string|null, isNetworkError: boolean }
 */
export const safeApiCall = async (apiCall, fallbackMessage = 'Errore nel caricamento') => {
  // Prima controlla se sei online
  if (!isOnline()) {
    return {
      success: false,
      data: null,
      error: 'Nessuna connessione a Internet',
      isNetworkError: true
    };
  }
  
  try {
    const data = await apiCall();
    return {
      success: true,
      data: data,
      error: null,
      isNetworkError: false
    };
  } catch (error) {
    console.error('❌ Errore API:', error);
    
    const netError = isNetworkError(error);
    
    return {
      success: false,
      data: null,
      error: netError 
        ? 'Impossibile connettersi. Controlla la tua connessione a Internet.'
        : fallbackMessage,
      isNetworkError: netError
    };
  }
};

/**
 * Hook per ascoltare i cambiamenti di connessione
 * Usa questo in un useEffect per reagire ai cambiamenti online/offline
 */
export const setupNetworkListeners = (onOnline, onOffline) => {
  const handleOnline = () => {
    console.log('🌐 Connessione ripristinata');
    if (onOnline) onOnline();
  };
  
  const handleOffline = () => {
    console.log('📡 Connessione persa');
    if (onOffline) onOffline();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

/**
 * Testa la connessione facendo una chiamata a un endpoint affidabile
 * @returns {Promise<boolean>} true se connesso, false altrimenti
 */
export const testConnection = async () => {
  if (!isOnline()) return false;
  
  try {
    // Prova a fare una chiamata HEAD a Google (veloce e affidabile)
    await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    });
    return true;
  } catch (error) {
    return false;
  }
};