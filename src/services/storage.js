// Wrapper per gestire storage sia in dev che in produzione
class StorageService {
  constructor() {
    this.isElectron = this.checkIfElectron();
    
    // 🔍 DEBUG: Controlla cosa sta succedendo
    console.log('🔍 Storage Debug:');
    console.log('- window.electronAPI:', !!window.electronAPI);
    console.log('- this.isElectron:', this.isElectron);
    console.log('- Modalità storage:', this.isElectron ? 'ELECTRON (FILE)' : 'BROWSER (localStorage)');
  }

  checkIfElectron() {
    // ✅ RIATTIVATA - Controlla se electronAPI è disponibile
    return typeof window !== 'undefined' && window.electronAPI;
    // return false; // ❌ COMMENTATA/RIMOSSA QUESTA RIGA
  }

  async getFavorites() {
    try {
      if (this.isElectron) {
        const data = await window.electronAPI.loadData('mystream_favorites');
        return data ? JSON.parse(data) : [];
      } else {
        const favorites = localStorage.getItem('mystream_favorites') || '[]';
        return JSON.parse(favorites);
      }
    } catch (e) {
      console.error('Errore caricamento favoriti:', e);
      return [];
    }
  }

  async saveFavorites(favorites) {
    try {
      // Rimuove i campi base64 (cached_poster, cached_backdrop) prima di salvare.
      // getMovieDetails/getTVDetails li aggiungono all'oggetto per uso interno,
      // ma in storage pesano 200-400KB ciascuno e saturano lo storage dopo pochi item.
      const sanitized = favorites.map(({ cached_poster, cached_backdrop, ...rest }) => rest);
      const data = JSON.stringify(sanitized);
      if (this.isElectron) {
        await window.electronAPI.saveData('mystream_favorites', data);
      } else {
        localStorage.setItem('mystream_favorites', data);
      }
    } catch (e) {
      console.error('Errore salvataggio favoriti:', e);
    }
  }

  async getContinueWatching(tmdbId) {
    try {
      const key = `mystream_continue_${tmdbId}`;
      if (this.isElectron) {
        const data = await window.electronAPI.loadData(key);
        return data ? JSON.parse(data) : null;
      } else {
        const data = localStorage.getItem(key) || 'null';
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Errore caricamento continue watching:', e);
      return null;
    }
  }

  async saveContinueWatching(tmdbId, data) {
    try {
      const key = `mystream_continue_${tmdbId}`;
      const jsonData = JSON.stringify(data);
      if (this.isElectron) {
        await window.electronAPI.saveData(key, jsonData);
      } else {
        localStorage.setItem(key, jsonData);
      }
    } catch (e) {
      console.error('Errore salvataggio continue watching:', e);
    }
  }

  async getWatchedEpisodes(tmdbId) {
    try {
      const key = `mystream_watched_${tmdbId}`;
      if (this.isElectron) {
        const data = await window.electronAPI.loadData(key);
        return data ? JSON.parse(data) : [];
      } else {
        const data = localStorage.getItem(key) || '[]';
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Errore caricamento watched episodes:', e);
      return [];
    }
  }

  async saveWatchedEpisodes(tmdbId, episodes) {
    try {
      const key = `mystream_watched_${tmdbId}`;
      const data = JSON.stringify(episodes);
      if (this.isElectron) {
        await window.electronAPI.saveData(key, data);
      } else {
        localStorage.setItem(key, data);
      }
    } catch (e) {
      console.error('Errore salvataggio watched episodes:', e);
    }
  }

  async getAllContinueWatching() {
    try {
      if (this.isElectron) {
        const data = await window.electronAPI.getAllContinueWatching();
        return data || [];
      } else {
        const entries = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith('mystream_continue_')) continue;
          try {
            const val = JSON.parse(localStorage.getItem(key));
            if (val) {
              entries.push({ tmdbId: key.replace('mystream_continue_', ''), ...val });
            }
          } catch {}
        }
        return entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }
    } catch {
      return [];
    }
  }

  async getSearchHistory() {
    try {
      if (this.isElectron) {
        const data = await window.electronAPI.loadData('mystream_search_history');
        return data ? JSON.parse(data) : [];
      } else {
        return JSON.parse(localStorage.getItem('mystream_search_history') || '[]');
      }
    } catch (e) {
      return [];
    }
  }

  async saveSearchHistory(history) {
    try {
      const data = JSON.stringify(history);
      if (this.isElectron) {
        await window.electronAPI.saveData('mystream_search_history', data);
      } else {
        localStorage.setItem('mystream_search_history', data);
      }
    } catch (e) {
      console.error('Errore salvataggio cronologia:', e);
    }
  }
}

// Esporta istanza singleton
export const storage = new StorageService();
export default storage;