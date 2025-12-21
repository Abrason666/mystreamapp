import axios from 'axios';
import { cacheService } from './cacheService'; // NUOVO IMPORT

const API_KEY = '53a4c50394ff821ef3e752f7763ddd40';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

const tmdbApi = axios.create({
  baseURL: BASE_URL,
  params: {
    api_key: API_KEY,
    language: 'it-IT'
  }
});

// === FUNZIONI CON CACHE IMPLEMENTATA ===

export const searchMovies = async (query) => {
  try {
    // Cache per ricerche - scade più velocemente (1 ora)
    const cacheKey = `search_movies_${query}`;
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log(`🔍 Cercando film: "${query}"`);
    const response = await tmdbApi.get('/search/movie', {
      params: { query }
    });

    // 🎯 AGGIUNTO: Aggiungi il campo 'type' per identificazione corretta
    const results = response.data.results.map(item => ({ ...item, type: 'movie' }));
    // Cache ricerca per 1 ora
    await cacheService.saveToCache(cacheKey, results);
    
    return results;
  } catch (error) {
    console.error('Errore ricerca film:', error);
    return [];
  }
};

export const searchTVShows = async (query) => {
  try {
    const cacheKey = `search_tv_${query}`;
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log(`🔍 Cercando serie TV: "${query}"`);
    const response = await tmdbApi.get('/search/tv', {
      params: { query }
    });

    // 🎯 AGGIUNTO: Aggiungi il campo 'type' per identificazione corretta
    const results = response.data.results.map(item => ({ ...item, type: 'tv' }));
    await cacheService.saveToCache(cacheKey, results);
    
    return results;
  } catch (error) {
    console.error('Errore ricerca serie TV:', error);
    return [];
  }
};

// 🎬 FUNZIONE AGGIORNATA: Discover per Genere con PAGINAZIONE
export const discoverByGenre = async (genreId, type = 'movie', page = 1) => {
  try {
    const cacheKey = `discover_${type}_${genreId}_page_${page}`;
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      console.log(`⚡ Cache HIT: ${type} genere ${genreId} pagina ${page}`);
      return cached;
    }

    console.log(`🎬 Caricando ${type} per genere: ${genreId} (pagina ${page})`);
    
    const endpoint = type === 'movie' ? '/discover/movie' : '/discover/tv';
    const response = await tmdbApi.get(endpoint, {
      params: {
        with_genres: genreId,
        sort_by: 'popularity.desc', // I più popolari
        'vote_count.gte': 100, // Solo con almeno 100 voti (qualità)
        page: page // 👈 AGGIUNTO PARAMETRO PAGINA
      }
    });

    const results = response.data.results;
    
    // Cache per 12 ore (le categorie cambiano lentamente)
    await cacheService.saveToCache(cacheKey, results);
    
    console.log(`✅ Caricati ${results.length} contenuti per genere ${genreId} (pagina ${page})`);
    return results;
  } catch (error) {
    console.error('Errore discover per genere:', error);
    return [];
  }
};

export const getTrendingMovies = async () => {
  try {
    const cacheKey = 'trending_movies';
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log('📈 Caricando film di tendenza...');
    const response = await tmdbApi.get('/trending/movie/week');
    
    const results = response.data.results;
    await cacheService.saveToCache(cacheKey, results);
    
    return results;
  } catch (error) {
    console.error('Errore film trending:', error);
    return [];
  }
};

export const getTrendingTVShows = async () => {
  try {
    const cacheKey = 'trending_tv';
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log('📈 Caricando serie TV di tendenza...');
    const response = await tmdbApi.get('/trending/tv/week');
    
    const results = response.data.results;
    await cacheService.saveToCache(cacheKey, results);
    
    return results;
  } catch (error) {
    console.error('Errore serie TV trending:', error);
    return [];
  }
};

export const getPopularMovies = async () => {
  try {
    const cacheKey = 'popular_movies';
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log('🌟 Caricando film popolari...');
    const response = await tmdbApi.get('/movie/popular');
    
    const results = response.data.results;
    await cacheService.saveToCache(cacheKey, results);
    
    return results;
  } catch (error) {
    console.error('Errore film popolari:', error);
    return [];
  }
};

export const getPopularTVShows = async () => {
  try {
    const cacheKey = 'popular_tv';
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log('🌟 Caricando serie TV popolari...');
    const response = await tmdbApi.get('/tv/popular');
    
    const results = response.data.results;
    await cacheService.saveToCache(cacheKey, results);
    
    return results;
  } catch (error) {
    console.error('Errore serie TV popolari:', error);
    return [];
  }
};

export const getMovieDetails = async (id) => {
  try {
    const cacheKey = `movie_${id}`;
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log(`🎬 Caricando dettagli film: ${id}`);
    const response = await tmdbApi.get(`/movie/${id}`);
    
    const movie = response.data;
    
    // Cache anche le immagini del film
    if (movie.poster_path) {
      const posterUrl = `${IMAGE_BASE_URL}${movie.poster_path}`;
      movie.cached_poster = await cacheService.cacheImage(posterUrl, `poster_${id}`);
    }
    
    if (movie.backdrop_path) {
      const backdropUrl = `${BACKDROP_BASE_URL}${movie.backdrop_path}`;
      movie.cached_backdrop = await cacheService.cacheImage(backdropUrl, `backdrop_${id}`);
    }

    await cacheService.saveToCache(cacheKey, movie);
    return movie;
  } catch (error) {
    console.error('Errore dettagli film:', error);
    return null;
  }
};

export const getTVDetails = async (id) => {
  try {
    const cacheKey = `tv_${id}`;
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log(`📺 Caricando dettagli serie TV: ${id}`);
    const response = await tmdbApi.get(`/tv/${id}`);
    
    const show = response.data;
    
    // Cache anche le immagini della serie
    if (show.poster_path) {
      const posterUrl = `${IMAGE_BASE_URL}${show.poster_path}`;
      show.cached_poster = await cacheService.cacheImage(posterUrl, `tv_poster_${id}`);
    }
    
    if (show.backdrop_path) {
      const backdropUrl = `${BACKDROP_BASE_URL}${show.backdrop_path}`;
      show.cached_backdrop = await cacheService.cacheImage(backdropUrl, `tv_backdrop_${id}`);
    }

    await cacheService.saveToCache(cacheKey, show);
    return show;
  } catch (error) {
    console.error('Errore dettagli serie TV:', error);
    return null;
  }
};

export const getTVSeasons = async (tvId) => {
  try {
    const cacheKey = `tv_seasons_${tvId}`;
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log(`📺 Caricando stagioni TV: ${tvId}`);
    const response = await tmdbApi.get(`/tv/${tvId}`);
    
    const result = {
      seasons: response.data.seasons,
      details: response.data
    };
    
    await cacheService.saveToCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Errore stagioni TV:', error);
    return { seasons: [], details: null };
  }
};

export const getSeasonEpisodes = async (tvId, seasonNumber) => {
  try {
    const cacheKey = `tv_episodes_${tvId}_s${seasonNumber}`;
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log(`📺 Caricando episodi: S${seasonNumber} di ${tvId}`);
    const response = await tmdbApi.get(`/tv/${tvId}/season/${seasonNumber}`);
    
    const episodes = response.data.episodes;
    await cacheService.saveToCache(cacheKey, episodes);
    
    return episodes;
  } catch (error) {
    console.error('Errore episodi stagione:', error);
    return [];
  }
};

export const getEpisodeDetails = async (tvId, seasonNumber, episodeNumber) => {
  try {
    const cacheKey = `episode_${tvId}_s${seasonNumber}e${episodeNumber}`;
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log(`📺 Caricando episodio: S${seasonNumber}E${episodeNumber} di ${tvId}`);
    const response = await tmdbApi.get(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`);
    
    const episode = response.data;
    await cacheService.saveToCache(cacheKey, episode);
    
    return episode;
  } catch (error) {
    console.error('Errore dettagli episodio:', error);
    return null;
  }
};

// === FUNZIONI HELPER CON CACHE IMMAGINI ===

export const getImageUrl = (path) => {
  return path ? `${IMAGE_BASE_URL}${path}` : null;
};

export const getBackdropUrl = (path) => {
  return path ? `${BACKDROP_BASE_URL}${path}` : '/placeholder-backdrop.jpg';
};

export const getEpisodeImageUrl = (path) => {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : '/placeholder-episode.jpg';
};

// Nuova funzione helper per immagini con cache
export const getCachedImageUrl = (originalPath, cachedPath, type = 'poster') => {
  // Se abbiamo la versione cachata, usala
  if (cachedPath && cachedPath.startsWith('data:')) {
    return cachedPath;
  }
  
  // Altrimenti usa l'URL originale
  if (originalPath) {
    return type === 'backdrop' 
      ? `${BACKDROP_BASE_URL}${originalPath}`
      : `${IMAGE_BASE_URL}${originalPath}`;
  }
  
  // Placeholder se nessuna immagine disponibile
  return type === 'backdrop' 
    ? '/placeholder-backdrop.jpg'
    : '/placeholder-poster.jpg';
};

// Lista generi film da TMDB
export const getMovieGenres = async () => {
  try {
    const cacheKey = 'movie_genres';
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      console.log('⚡ Cache HIT: Generi film');
      return cached;
    }

    console.log('🎭 Caricando generi film da TMDB...');
    const response = await tmdbApi.get('/genre/movie/list');
    
    const genres = response.data.genres;
    await cacheService.saveToCache(cacheKey, genres);
    
    console.log('✅ Generi film caricati:', genres.length);
    return genres;
  } catch (error) {
    console.error('❌ Errore caricamento generi film:', error);
    return [];
  }
};

// Lista generi serie TV da TMDB
export const getTVGenres = async () => {
  try {
    const cacheKey = 'tv_genres';
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      console.log('⚡ Cache HIT: Generi TV');
      return cached;
    }

    console.log('📺 Caricando generi serie TV da TMDB...');
    const response = await tmdbApi.get('/genre/tv/list');
    
    const genres = response.data.genres;
    await cacheService.saveToCache(cacheKey, genres);
    
    console.log('✅ Generi TV caricati:', genres.length);
    return genres;
  } catch (error) {
    console.error('❌ Errore caricamento generi TV:', error);
    return [];
  }
};

// Carica film per un genere specifico
export const getMoviesByGenre = async (genreId, page = 1) => {
  try {
    const cacheKey = `movies_genre_${genreId}_page_${page}`;
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      console.log(`⚡ Cache HIT: Film genere ${genreId}`);
      return cached;
    }

    console.log(`🎬 Caricando film del genere ${genreId}...`);
    const response = await tmdbApi.get('/discover/movie', {
      params: {
        with_genres: genreId,
        page: page,
        sort_by: 'popularity.desc'
      }
    });
    
    const movies = response.data.results;
    await cacheService.saveToCache(cacheKey, movies);
    
    console.log(`✅ Film genere ${genreId} caricati:`, movies.length);
    return movies;
  } catch (error) {
    console.error(`❌ Errore caricamento film genere ${genreId}:`, error);
    return [];
  }
};

// Carica serie TV per un genere specifico
export const getTVShowsByGenre = async (genreId, page = 1) => {
  try {
    const cacheKey = `tv_genre_${genreId}_page_${page}`;
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      console.log(`⚡ Cache HIT: Serie TV genere ${genreId}`);
      return cached;
    }

    console.log(`📺 Caricando serie TV del genere ${genreId}...`);
    const response = await tmdbApi.get('/discover/tv', {
      params: {
        with_genres: genreId,
        page: page,
        sort_by: 'popularity.desc'
      }
    });
    
    const shows = response.data.results;
    await cacheService.saveToCache(cacheKey, shows);
    
    console.log(`✅ Serie TV genere ${genreId} caricate:`, shows.length);
    return shows;
  } catch (error) {
    console.error(`❌ Errore caricamento serie TV genere ${genreId}:`, error);
    return [];
  }
};

// 🔧 FUNZIONE CORRETTA: Carica MOLTI più contenuti per genere
export const getContentByGenre = async (genreId) => {
  try {
    const cacheKey = `genre_${genreId}`;
    const cached = await cacheService.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log(`🎭 Caricando TUTTI i contenuti per genere: ${genreId}`);
    
    // 🆕 MAPPATURA GENERI: Film ID → Serie TV ID
    const genreMapping = {
      28: 10759,   // Azione → Azione & Avventura
      12: 10759,   // Avventura → Azione & Avventura
      14: 10765,   // Fantasy → Sci-Fi & Fantasy
      878: 10765,  // Fantascienza → Sci-Fi & Fantasy
      27: 10765,   // Horror → Sci-Fi & Fantasy (TMDB non ha Horror TV separato)
      9648: 9648,  // Mistero → Mistero (stesso ID)
      80: 80,      // Crimine → Crimine (stesso ID)
      16: 16,      // Animazione → Animazione (stesso ID)
      35: 35,      // Commedia → Commedia (stesso ID)
      99: 99,      // Documentario → Documentario (stesso ID)
      18: 18,      // Drammatico → Drammatico (stesso ID)
      10751: 10751, // Famiglia → Famiglia (stesso ID)
      10402: 10402, // Musicale → Musicale (stesso ID)
      10749: 10749, // Romantico → Romantico (stesso ID)
      53: 10765,   // Thriller → Sci-Fi & Fantasy (approssimazione)
      10752: 10768, // Guerra → War & Politics
      37: 37       // Western → Western (stesso ID)
    };
    
    // Determina l'ID genere da usare per le serie TV
    const tvGenreId = genreMapping[genreId] || genreId;
    
    console.log(`📺 Mappatura generi: Film=${genreId}, Serie TV=${tvGenreId}`);
    
    // 🚀 CARICA TUTTE LE PAGINE DISPONIBILI
    const maxPages = 20; // 20 pagine = ~400 risultati
    
    const moviePromises = [];
    const tvPromises = [];
    
    for (let page = 1; page <= maxPages; page++) {
      // Film: usa genreId originale
      moviePromises.push(
        tmdbApi.get('/discover/movie', { 
          params: { 
            with_genres: genreId, 
            page: page,
            sort_by: 'popularity.desc'
          } 
        })
      );
      
      // Serie TV: usa genreId MAPPATO
      tvPromises.push(
        tmdbApi.get('/discover/tv', { 
          params: { 
            with_genres: tvGenreId, // 👈 USA ID MAPPATO
            page: page,
            sort_by: 'popularity.desc'
          } 
        })
      );
    }
    
    console.log(`📥 Caricamento ${maxPages} pagine di film e ${maxPages} di serie TV...`);
    
    const [movieResults, tvResults] = await Promise.all([
      Promise.all(moviePromises),
      Promise.all(tvPromises)
    ]);
    
    // Unisci tutti i risultati
    const movies = movieResults
      .flatMap(response => response.data.results)
      .map(item => ({ ...item, type: 'movie' }));
    
    const tvShows = tvResults
      .flatMap(response => response.data.results)
      .map(item => ({ ...item, type: 'tv' }));
    
    const allContent = [...movies, ...tvShows];
    
    console.log(`✅ Caricati ${movies.length} film e ${tvShows.length} serie TV (Totale: ${allContent.length})`);
    
    await cacheService.saveToCache(cacheKey, allContent);
    
    return allContent;
  } catch (error) {
    console.error('Errore caricamento contenuti per genere:', error);
    return [];
  }
};

export default tmdbApi;