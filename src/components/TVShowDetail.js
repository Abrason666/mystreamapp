import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTVSeasons, getSeasonEpisodes, getBackdropUrl, getEpisodeImageUrl } from '../services/tmdbApi';
import ExpandableText from './ExpandableText';
import SmartImage from './SmartImage';
import MovieCarousel from './MovieCarousel';
import './TVShowDetail.css';
import './ExpandableText.css';
import storage from '../services/storage';
import axios from 'axios';

// 🔑 API Key TMDB
const API_KEY = '53a4c50394ff821ef3e752f7763ddd40';
const BASE_URL = 'https://api.themoviedb.org/3';

function TVShowDetail({ initialSeason }) {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // ============================================
  // 📦 STATI
  // ============================================
  const [showDetails, setShowDetails] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [watchedEpisodes, setWatchedEpisodes] = useState([]);
  const [continueWatching, setContinueWatching] = useState(null);
  const [isFavoriteShow, setIsFavoriteShow] = useState(false);
  
  // 🆕 NUOVO STATO: Episodio successivo
  const [nextEpisode, setNextEpisode] = useState(null);
  
  // 🆕 NUOVI STATI PER TAB
  const [activeTab, setActiveTab] = useState('episodes');
  const [cast, setCast] = useState([]);
  const [crew, setCrew] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  // 🔧 RESET DELLA TAB QUANDO CAMBIA LA SERIE
  useEffect(() => {
    setActiveTab('episodes');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  // ============================================
  // 🎬 CARICAMENTO DATI
  // ============================================
  useEffect(() => {
    const loadShowData = async () => {
      setLoading(true);
      
      // 1. Carica dettagli e stagioni
      const { seasons: showSeasons, details } = await getTVSeasons(id);
      setShowDetails(details);
      
      // Filtra solo stagioni valide (non speciali)
      const validSeasons = showSeasons.filter(season => season.season_number > 0);
      setSeasons(validSeasons);
      
      // 2. Determina quale stagione caricare
      let targetSeason = 1;
      if (initialSeason) {
        targetSeason = parseInt(initialSeason);
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        const seasonFromUrl = urlParams.get('season');
        if (seasonFromUrl) {
          targetSeason = parseInt(seasonFromUrl);
        }
      }
      
      console.log('🎯 Stagione target:', targetSeason);
      
      // 3. Carica episodi della stagione
      if (validSeasons.length > 0) {
        const seasonToLoad = validSeasons.find(s => s.season_number === targetSeason) 
          ? targetSeason 
          : validSeasons[0].season_number;
        
        setSelectedSeason(seasonToLoad);
        
        const seasonEpisodes = await getSeasonEpisodes(id, seasonToLoad);
        setEpisodes(seasonEpisodes);
      }
      
      // 4. Carica dati di visione
      await loadWatchingData();
      await loadFavoriteStatus();
      
      // 🆕 5. Carica dati aggiuntivi per le tab
      await Promise.all([
        loadCredits(id),
        loadRecommendations(id)
      ]);
      
      setLoading(false);
    };

    loadShowData();
  }, [id, initialSeason]);

  // 🆕 CALCOLA EPISODIO SUCCESSIVO quando cambiano continueWatching o seasons
  useEffect(() => {
    if (continueWatching && seasons.length > 0) {
      calculateNextEpisode();
    }
  }, [continueWatching, seasons]);

  // 🆕 CARICA CAST E CREW
  const loadCredits = async (tvId) => {
    try {
      console.log(`👥 Caricando cast per serie TV: ${tvId}`);
      const response = await axios.get(`${BASE_URL}/tv/${tvId}/credits`, {
        params: { api_key: API_KEY, language: 'it-IT' }
      });
      
      // Filtra e limita il cast
      const mainCast = response.data.cast.slice(0, 20);
      setCast(mainCast);
      
      // Crew principale (creatori, produttori)
      const mainCrew = response.data.crew
        .filter(member => 
          ['Creator', 'Executive Producer', 'Producer'].includes(member.job)
        )
        .slice(0, 10);
      setCrew(mainCrew);
      
      console.log(`✅ Cast caricato: ${mainCast.length} attori`);
    } catch (error) {
      console.error('❌ Errore caricamento cast:', error);
      setCast([]);
      setCrew([]);
    }
  };

  // 🆕 CARICA SERIE SIMILI
  const loadRecommendations = async (tvId) => {
    try {
      console.log(`🔍 Caricando serie simili per: ${tvId}`);
      const response = await axios.get(`${BASE_URL}/tv/${tvId}/recommendations`, {
        params: { api_key: API_KEY, language: 'it-IT' }
      });
      
      // Aggiungi il campo 'type' per ogni risultato
      const tvRecommendations = response.data.results
        .slice(0, 20)
        .map(item => ({ ...item, type: 'tv' }));
      
      setRecommendations(tvRecommendations);
      console.log(`✅ Serie simili caricate: ${tvRecommendations.length}`);
    } catch (error) {
      console.error('❌ Errore caricamento serie simili:', error);
      setRecommendations([]);
    }
  };

  // ============================================
  // 💾 GESTIONE PREFERITI
  // ============================================
  const loadFavoriteStatus = async () => {
    const favorites = await storage.getFavorites();
    const isFavorite = favorites.some(fav => fav.id === parseInt(id) && fav.type === 'tv');
    setIsFavoriteShow(isFavorite);
  };

  const toggleFavorites = async () => {
    const favorites = await storage.getFavorites();
    let updatedFavorites;
    
    if (isFavoriteShow) {
      // Rimuovi dai favoriti
      updatedFavorites = favorites.filter(fav => 
        !(fav.id === parseInt(id) && fav.type === 'tv')
      );
      setIsFavoriteShow(false);
      console.log('💔 Serie rimossa dai favoriti:', showDetails.name);
    } else {
      // Aggiungi ai favoriti
      const favoriteItem = { ...showDetails, type: 'tv' };
      updatedFavorites = [...favorites, favoriteItem];
      setIsFavoriteShow(true);
      console.log('❤️ Serie aggiunta ai favoriti:', showDetails.name);
    }
    
    storage.saveFavorites(updatedFavorites);
    
    window.dispatchEvent(new CustomEvent('favoritesChanged', { 
      detail: { favorites: updatedFavorites } 
    }));
  };

  // ============================================
  // 📺 GESTIONE EPISODI
  // ============================================
  const loadWatchingData = async () => {
    // Carica episodi visti
    const watched = await storage.getWatchedEpisodes(id) || [];
    setWatchedEpisodes(watched);
    
    // Carica "continua a guardare"
    const continueData = await storage.getContinueWatching(id);
    setContinueWatching(continueData);
    
    console.log('📊 Dati visione caricati:', {
      episodiVisti: watched.length,
      continuaAGuardare: continueData
    });
  };

  // 🆕 FUNZIONE: CALCOLA EPISODIO SUCCESSIVO
  const calculateNextEpisode = async () => {
    if (!continueWatching || seasons.length === 0) {
      setNextEpisode(null);
      return;
    }

    const currentSeason = continueWatching.seasonNumber;
    const currentEpisode = continueWatching.episodeNumber;

    try {
      // Carica episodi della stagione corrente
      const currentSeasonEpisodes = await getSeasonEpisodes(id, currentSeason);
      
      // Caso 1: C'è un episodio successivo nella stessa stagione
      if (currentEpisode < currentSeasonEpisodes.length) {
        const nextEp = currentSeasonEpisodes[currentEpisode]; // Array è 0-indexed
        setNextEpisode({
          seasonNumber: currentSeason,
          episodeNumber: currentEpisode + 1,
          episodeTitle: nextEp.name,
          exists: true
        });
        console.log('✅ Episodio successivo trovato:', `S${currentSeason}E${currentEpisode + 1} - ${nextEp.name}`);
        return;
      }

      // Caso 2: Episodio corrente è l'ultimo della stagione
      // Controlla se c'è una stagione successiva
      const nextSeasonNumber = currentSeason + 1;
      const nextSeasonExists = seasons.find(s => s.season_number === nextSeasonNumber);

      if (nextSeasonExists) {
        // C'è una stagione successiva, carica primo episodio
        const nextSeasonEpisodes = await getSeasonEpisodes(id, nextSeasonNumber);
        if (nextSeasonEpisodes.length > 0) {
          const firstEp = nextSeasonEpisodes[0];
          setNextEpisode({
            seasonNumber: nextSeasonNumber,
            episodeNumber: 1,
            episodeTitle: firstEp.name,
            exists: true
          });
          console.log('✅ Prima ep stagione successiva:', `S${nextSeasonNumber}E1 - ${firstEp.name}`);
          return;
        }
      }

      // Caso 3: Serie finita
      setNextEpisode({
        exists: false,
        seriesCompleted: true
      });
      console.log('🏁 Serie completata! Nessun episodio successivo.');

    } catch (error) {
      console.error('❌ Errore calcolo episodio successivo:', error);
      setNextEpisode(null);
    }
  };

  const handleSeasonChange = async (seasonNumber) => {
    setSelectedSeason(seasonNumber);
    setLoading(true);
    
    const seasonEpisodes = await getSeasonEpisodes(id, seasonNumber);
    setEpisodes(seasonEpisodes);
    setLoading(false);
  };

  const playEpisode = (episode) => {
    // Salva come "continua a guardare" con TITOLO VERO
    const continueData = {
      seasonNumber: selectedSeason,
      episodeNumber: episode.episode_number,
      episodeTitle: episode.name, // 🆕 TITOLO VERO!
      timestamp: Date.now()
    };
    storage.saveContinueWatching(id, continueData);
    
    // Naviga al player
    navigate(`/player/tv/${id}/${selectedSeason}/${episode.episode_number}`);
  };

  // 🆕 FUNZIONE: Riproduci dall'inizio (S1E1)
  const playFromBeginning = async () => {
    const firstSeason = seasons.find(s => s.season_number === 1) || seasons[0];
    const seasonNumber = firstSeason.season_number;
    
    console.log('🎬 Iniziando serie dal primo episodio: S', seasonNumber, 'E1');
    
    // Carica episodi della prima stagione per ottenere titolo vero
    try {
      const firstSeasonEpisodes = await getSeasonEpisodes(id, seasonNumber);
      const firstEpisode = firstSeasonEpisodes[0];
      
      const continueData = {
        seasonNumber: seasonNumber,
        episodeNumber: 1,
        episodeTitle: firstEpisode.name, // 🆕 TITOLO VERO!
        timestamp: Date.now()
      };
      storage.saveContinueWatching(id, continueData);
      
      navigate(`/player/tv/${id}/${seasonNumber}/1`);
    } catch (error) {
      console.error('❌ Errore caricamento primo episodio:', error);
      // Fallback: usa titolo generico
      const continueData = {
        seasonNumber: seasonNumber,
        episodeNumber: 1,
        episodeTitle: 'Episodio 1',
        timestamp: Date.now()
      };
      storage.saveContinueWatching(id, continueData);
      navigate(`/player/tv/${id}/${seasonNumber}/1`);
    }
  };

  // 🆕 FUNZIONE: Continua a guardare
  const handleContinueWatching = () => {
    navigate(`/player/tv/${id}/${continueWatching.seasonNumber}/${continueWatching.episodeNumber}`);
  };

  // 🆕 FUNZIONE: Riproduci episodio successivo
  const handlePlayNextEpisode = () => {
    if (nextEpisode && nextEpisode.exists) {
      navigate(`/player/tv/${id}/${nextEpisode.seasonNumber}/${nextEpisode.episodeNumber}`);
    }
  };

  // 🆕 FUNZIONE: Riguarda dall'inizio
  const handleRestartSeries = () => {
    playFromBeginning();
  };

  const markAsWatched = (episode, e) => {
    e.stopPropagation();
    
    const episodeKey = `S${selectedSeason}E${episode.episode_number}`;
    const currentWatched = [...watchedEpisodes];
    
    if (currentWatched.includes(episodeKey)) {
      const updated = currentWatched.filter(ep => ep !== episodeKey);
      setWatchedEpisodes(updated);
      storage.saveWatchedEpisodes(id, updated);
    } else {
      const updated = [...currentWatched, episodeKey];
      setWatchedEpisodes(updated);
      storage.saveWatchedEpisodes(id, updated);
    }
  };

  const isEpisodeWatched = (episode) => {
    const episodeKey = `S${selectedSeason}E${episode.episode_number}`;
    return watchedEpisodes.includes(episodeKey);
  };

  // 🆕 HELPER: Verifica se una stagione è nuova (uscita negli ultimi 90 giorni)
  const isNewSeason = (airDate) => {
    if (!airDate) return false;
    const releaseDate = new Date(airDate);
    const now = new Date();
    const daysSinceRelease = (now - releaseDate) / (1000 * 60 * 60 * 24);
    return daysSinceRelease >= 0 && daysSinceRelease <= 90;
  };

  // 🆕 HELPER: Verifica se una stagione è futura
  const isUpcomingSeason = (airDate) => {
    if (!airDate) return false;
    const releaseDate = new Date(airDate);
    const now = new Date();
    return releaseDate > now;
  };

  // 🆕 HELPER: Formatta l'anno dalla data
  const getSeasonYear = (airDate) => {
    if (!airDate) return '';
    return new Date(airDate).getFullYear();
  };

  // ============================================
  // 🎬 RENDERING
  // ============================================
  if (loading) {
    return (
      <div className="tv-detail-loading">
        <div className="loading-spinner"></div>
        <p>Caricamento dettagli serie TV...</p>
      </div>
    );
  }


  // 🆕 MODIFICATO: Non mostrare errore se sta caricando o dati non pronti
  if (!showDetails && !loading) {
    return (
      <div className="tv-detail-error">
        <h2>Serie TV non trovata</h2>
        <p>La serie TV che stai cercando non esiste o non è disponibile.</p>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">
          ← Torna Indietro
        </button>
      </div>
    );
  }

  // 🆕 Se showDetails è null ma non stiamo caricando, mostra loading
  if (!showDetails) {
    return (
      <div className="tv-detail-loading">
        <div className="loading-spinner"></div>
        <p>Caricamento...</p>
      </div>
    );
  }

  // 💥 Trova il creatore della serie
  const creator = crew.find(member => member.job === 'Creator');

  return (
    <div className="tv-show-detail">
      
      {/* ========================================
          HERO SECTION - IDENTICA A MOVIEDETAIL
          ======================================== */}
      <div 
        className="tv-hero"
        style={{ backgroundImage: `url(${getBackdropUrl(showDetails.backdrop_path)})` }}
      >
        <div className="tv-hero-overlay">
          <div className="tv-hero-content">
            
            {/* Titolo */}
            <h1 className="tv-title">{showDetails.name}</h1>
            
            {/* Metadata Inline */}
            <div className="tv-metadata-inline">
              <span className="metadata-rating">
                ⭐ {showDetails.vote_average?.toFixed(1)}
              </span>
              <span className="metadata-separator">•</span>
              <span className="metadata-year">
                {new Date(showDetails.first_air_date).getFullYear()}
              </span>
              <span className="metadata-separator">•</span>
              <span className="metadata-seasons">
                {seasons.length} Stagion{seasons.length === 1 ? 'e' : 'i'}
              </span>
            </div>
            
            {/* Generi (se disponibili) */}
            {showDetails.genres && showDetails.genres.length > 0 && (
              <div className="tv-genres-inline">
                {showDetails.genres.slice(0, 3).map(genre => (
                  <span key={genre.id} className="genre-pill">{genre.name}</span>
                ))}
              </div>
            )}
            
            {/* Descrizione */}
            <div className="tv-description">
              <ExpandableText
                text={showDetails.overview}
                maxLength={200}
                className="tv-overview-text"
                expandText="Leggi tutto"
                collapseText="Riduci"
              />
            </div>
            
            {/* Creatore (come il regista per i film) */}
            {creator && (
              <div className="tv-creator-inline">
                <span className="creator-label">Creata da:</span>
                <span className="creator-name">{creator.name}</span>
              </div>
            )}
            
            {/* ========================================
                🆕 BOTTONI AZIONI - LOGICA A 3 SCENARI
                ======================================== */}
            <div className="tv-actions">
              
              {/* SCENARIO 1: Mai visto nulla → Solo "Riproduci" */}
              {!continueWatching && (
                <button 
                  className="btn btn-primary btn-lg"
                  onClick={playFromBeginning}
                >
                  <span className="btn-icon">▶️</span>
                      <div className="btn-text">
                        <div>Riproduci</div>
                      </div>
                </button>
              )}

              {/* SCENARIO 2 & 3: Sta guardando → "Continua" + altro bottone */}
              {continueWatching && (
                <>
                  {/* Bottone "Continua" - SEMPRE presente se c'è continueWatching */}
                  <button 
                    className="btn btn-primary btn-lg"
                    onClick={handleContinueWatching}
                  >
                    <span className="btn-icon">▶️</span>
                    <div className="btn-text">
                      <div>Continua S{continueWatching.seasonNumber}E{continueWatching.episodeNumber}</div>
                    </div>
                  </button>

                  {/* SCENARIO 2: C'è episodio successivo → "Episodio Successivo" */}
                  {nextEpisode && nextEpisode.exists && (
                    <button 
                      className="btn btn-secondary btn-lg"
                      onClick={handlePlayNextEpisode}
                    >
                      <span className="btn-icon">⏭️</span>
                      <div className="btn-text">
                        <div>Episodio Successivo S{nextEpisode.seasonNumber}E{nextEpisode.episodeNumber}</div>
                      </div>
                    </button>
                  )}

                  {/* SCENARIO 3: Serie finita → "Riguarda dall'Inizio" */}
                  {nextEpisode && nextEpisode.seriesCompleted && (
                    <button 
                      className="btn btn-secondary btn-lg"
                      onClick={handleRestartSeries}
                    >
                      <span className="btn-icon">🔄</span>
                      <div className="btn-text">
                        <div>Riguarda dall'Inizio</div>
                      </div>
                    </button>
                  )}
                </>
              )}
              
              {/* 🆕 Bottone Preferiti - SOLO ICONA */}
              <button 
                className={`btn btn-secondary btn-lg btn-favorite ${isFavoriteShow ? 'remove' : ''}`}
                onClick={toggleFavorites}
                title={isFavoriteShow ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti'}
                aria-label={isFavoriteShow ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti'}
              >
                <span className="btn-icon">{isFavoriteShow ? '🧡' : '🤍'}</span>
                <span className="btn-text">
                  {isFavoriteShow ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti'}
                </span>
              </button>
            </div>
            
          </div>
        </div>
      </div>

      {/* ========================================
          🆕 TABS NAVIGATION
          ======================================== */}
      <div className="tv-tabs-container">
        <div className="tv-tabs">
          <button 
            className={`tab-button ${activeTab === 'episodes' ? 'active' : ''}`}
            onClick={() => setActiveTab('episodes')}
          >
            📺 Episodi
          </button>
          
          {cast.length > 0 && (
            <button 
              className={`tab-button ${activeTab === 'cast' ? 'active' : ''}`}
              onClick={() => setActiveTab('cast')}
            >
              👥 Cast
            </button>
          )}
          
          {recommendations.length > 0 && (
            <button 
              className={`tab-button ${activeTab === 'similar' ? 'active' : ''}`}
              onClick={() => setActiveTab('similar')}
            >
              📺 Serie Simili
            </button>
          )}
        </div>
      </div>

      {/* ========================================
          🆕 TAB CONTENT
          ======================================== */}
      <div className="tv-tab-content">
        
        {/* === EPISODES TAB === */}
        {activeTab === 'episodes' && (
          <div className="tab-panel tab-episodes">
            
            {/* SELEZIONE STAGIONI */}
            <div className="season-selector-styled">
              <div className="section-title-wrapper">
                <h2 className="section-title">Episodi</h2>
                
              </div>
              
              <div className="season-dropdown-wrapper">
                <select 
                  value={selectedSeason} 
                  onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                  className="season-dropdown"
                >
                  {seasons.map(season => {
                    const year = getSeasonYear(season.air_date);
                    const isNew = isNewSeason(season.air_date);
                    const isUpcoming = isUpcomingSeason(season.air_date);
                    
                    let label = `Stagione ${season.season_number}`;
                    
                    // Aggiungi anno se disponibile
                    if (year) {
                      label += ` (${year}`;
                    } else {
                      label += ` (`;
                    }
                    
                    // Aggiungi numero episodi
                    label += ` • ${season.episode_count} episod${season.episode_count === 1 ? 'io' : 'i'}`;
                    
                    // Chiudi parentesi
                    label += ')';
                    
                    // Aggiungi badge
                    if (isUpcoming) {
                      label += ' 📅 IN ARRIVO';
                    } else if (isNew) {
                      label += '';
                    }
                    
                    return (
                      <option key={season.season_number} value={season.season_number}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedSeason && seasons.find(s => s.season_number === selectedSeason) && (
                  <>
                    {isNewSeason(seasons.find(s => s.season_number === selectedSeason).air_date) && (
                      <span className="season-badge season-badge-new">🆕 NUOVA</span>
                    )}
                    {isUpcomingSeason(seasons.find(s => s.season_number === selectedSeason).air_date) && (
                      <span className="season-badge season-badge-upcoming">📅 IN ARRIVO</span>
                    )}
                  </>
                )}
            </div>

            {/* GRID EPISODI */}
            <div className="episodes-grid">
              {episodes.map((episode, index) => (
                <div 
                  key={episode.id} 
                  className={`episode-card ${isEpisodeWatched(episode) ? 'watched' : ''}`}
                  onClick={() => playEpisode(episode)}
                >
                  <div className="episode-number">{episode.episode_number}</div>
                  
                  <div className="episode-thumbnail">
                    <SmartImage
                      src={getEpisodeImageUrl(episode.still_path)}
                      alt={episode.name}
                      title={episode.name}
                      type="backdrop"
                      className="episode-thumbnail-image"
                    />
                    <div className="episode-play-overlay">
                      <button className="episode-play-btn">▶️</button>
                    </div>
                    
                    {isEpisodeWatched(episode) && (
                      <div className="watched-indicator">✓</div>
                    )}
                  </div>
                  
                  <div className="episode-info">
                    <h3 className="episode-title">{episode.name}</h3>
                    <p className="episode-runtime">{episode.runtime || 45} min</p>
                    
                    {/* Descrizione Espandibile */}
                    <ExpandableText
                      text={episode.overview}
                      maxLength={120}
                      className="episode-overview"
                      expandText="Leggi tutto"
                      collapseText="Riduci"
                    />
                    
                    {/* Bottone "Segna come visto" */}
                    <button 
                      className={`btn btn-episode ${isEpisodeWatched(episode) ? 'watched' : ''}`}
                      onClick={(e) => markAsWatched(episode, e)}
                    >
                      <span className="btn-icon">{isEpisodeWatched(episode) ? '✅' : '👁️'}</span>
                      <span className="btn-text">
                        {isEpisodeWatched(episode) ? 'Visto' : 'Segna come visto'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === CAST TAB === */}
        {activeTab === 'cast' && cast.length > 0 && (
          <div className="tab-panel tab-cast">
            <h2 className="tab-title">Cast Principale</h2>
            <div className="cast-grid">
              {cast.map(actor => (
                <div key={actor.id} className="cast-item">
                  <div className="cast-photo">
                    {actor.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                        alt={actor.name}
                      />
                    ) : (
                      <div className="cast-photo-placeholder">
                        <span>👤</span>
                      </div>
                    )}
                  </div>
                  <div className="cast-details">
                    <p className="cast-actor-name">{actor.name}</p>
                    <p className="cast-character-name">{actor.character}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === SIMILAR TV SHOWS TAB === */}
        {activeTab === 'similar' && recommendations.length > 0 && (
          <div className="tab-panel tab-similar">
            <MovieCarousel 
              title="📺 Serie TV Simili"
              items={recommendations}
              type="tv"
            />
          </div>
        )}
        
      </div>
    </div>
  );
}

export default TVShowDetail;