class CacheService {
  constructor() {
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 ore in millisecondi
  }

  // Salva dati in cache con timestamp
  async saveToCache(key, data) {
    const cacheData = {
      data: data,
      timestamp: Date.now(),
      expires: Date.now() + this.cacheExpiry
    };
    
    try {
      if (window.electronAPI) {
        // Electron: salva su file
        await window.electronAPI.saveData(`cache_${key}`, JSON.stringify(cacheData));
      } else {
        // Browser: salva in localStorage
        localStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
      }
      console.log(`💾 Cache SAVED: ${key}`);
    } catch (error) {
      console.error('Errore salvataggio cache:', error);
    }
  }

  // Carica dati dalla cache se ancora validi
  async getFromCache(key) {
    try {
      let cacheData;
      
      if (window.electronAPI) {
        // Electron: carica da file
        const data = await window.electronAPI.loadData(`cache_${key}`);
        cacheData = data ? JSON.parse(data) : null;
      } else {
        // Browser: carica da localStorage
        cacheData = JSON.parse(localStorage.getItem(`cache_${key}`) || 'null');
      }

      // Controlla se la cache è ancora valida
      if (cacheData && Date.now() < cacheData.expires) {
        console.log(`⚡ Cache HIT: ${key} (risparmiato tempo)`);
        return cacheData.data;
      } else if (cacheData) {
        console.log(`⏰ Cache EXPIRED: ${key} (riscaricare)`);
        // Rimuovi cache scaduta
        await this.removeFromCache(key);
      } else {
        console.log(`❌ Cache MISS: ${key} (prima volta)`);
      }
      
      return null;
    } catch (error) {
      console.error('Errore caricamento cache:', error);
      return null;
    }
  }

  // Rimuove elemento dalla cache
  async removeFromCache(key) {
    try {
      if (window.electronAPI) {
        await window.electronAPI.saveData(`cache_${key}`, null);
      } else {
        localStorage.removeItem(`cache_${key}`);
      }
    } catch (error) {
      console.error('Errore rimozione cache:', error);
    }
  }

  // Cache per le immagini (poster, backdrop)
  async cacheImage(url, filename) {
    try {
      // Prima controlla se già in cache
      const cachedImage = await this.getFromCache(`img_${filename}`);
      if (cachedImage) {
        return cachedImage;
      }

      console.log(`📥 Scaricando immagine: ${filename}`);
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Converti in base64 per salvare
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          const base64Data = reader.result;
          await this.saveToCache(`img_${filename}`, base64Data);
          resolve(base64Data);
        };
        reader.onerror = () => {
          console.error('Errore conversione immagine');
          resolve(url); // Fallback all'URL originale
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Errore cache immagine:', error);
      return url; // Fallback all'URL originale
    }
  }

  async cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;

    try {
      if (window.electronAPI) {
        cleaned = await window.electronAPI.cleanExpiredCache();
      } else {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith('cache_')) continue;
          try {
            const entry = JSON.parse(localStorage.getItem(key));
            if (!entry || !entry.expires || now > entry.expires) {
              keysToRemove.push(key);
            }
          } catch {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        cleaned = keysToRemove.length;
      }

      if (cleaned > 0) {
        console.log(`🧹 Cache pulita: ${cleaned} elementi scaduti rimossi`);
      }
    } catch (error) {
      console.error('Errore pulizia cache:', error);
    }
  }

  // Mostra statistiche cache
  async getCacheStats() {
    let totalItems = 0;
    let totalSize = 0;
    
    try {
      if (window.electronAPI) {
        // Per Electron dovremmo leggere il file JSON
        console.log('Cache stats disponibili solo in modalità browser per ora');
      } else {
        // Per localStorage possiamo contare
        for (let key in localStorage) {
          if (key.startsWith('cache_')) {
            totalItems++;
            totalSize += localStorage[key].length;
          }
        }
      }
      
      console.log(`📊 Cache Stats: ${totalItems} elementi, ~${Math.round(totalSize/1024)}KB`);
      return { items: totalItems, sizeKB: Math.round(totalSize/1024) };
    } catch (error) {
      console.error('Errore statistiche cache:', error);
      return { items: 0, sizeKB: 0 };
    }
  }
}

// Esporta istanza singleton
export const cacheService = new CacheService();
export default cacheService;