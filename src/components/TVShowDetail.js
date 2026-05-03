import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTVSeasons, getSeasonEpisodes, getBackdropUrl, getEpisodeImageUrl } from '../services/tmdbApi';
import ExpandableText from './ExpandableText';
import SmartImage from './SmartImage';
import MovieCarousel from './MovieCarousel';
import './TVShowDetail.css';
import './ExpandableText.css';
import storage from '../services/storage';
import axios from 'axios';
import { SkeletonDetail } from './Skeleton';
import toast from 'react-hot-toast';
import { Play, SkipForward, RefreshCw, Heart, List, Users, Film, Eye, Check, Star, User } from 'lucide-react';

const API_KEY = process.env.REACT_APP_TMDB_API_KEY;
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
  }, [id]);

  const loadFavoriteStatus = useCallback(async () => {
    const favorites = await storage.getFavorites();
    const isFavorite = favorites.some(fav => fav.id === parseInt(id) && fav.type === 'tv');
    setIsFavoriteShow(isFavorite);
  }, [id]);

  const loadWatchingData = useCallback(async () => {
    const watched = await storage.getWatchedEpisodes(id) || [];
    setWatchedEpisodes(watched);
    const continueData = await storage.getContinueWatching(id);
    setContinueWatching(continueData);
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
  }, [id, initialSeason, loadFavoriteStatus, loadWatchingData]);

  const calculateNextEpisode = useCallback(async () => {
    if (!continueWatching || seasons.length === 0) {
      setNextEpisode(null);
      return;
    }

    const currentSeason = continueWatching.seasonNumber;
    const currentEpisode = continueWatching.episodeNumber;

    try {
      const currentSeasonEpisodes = await getSeasonEpisodes(id, currentSeason);

      if (currentEpisode < currentSeasonEpisodes.length) {
        const nextEp = currentSeasonEpisodes[currentEpisode];
        setNextEpisode({
          seasonNumber: currentSeason,
          episodeNumber: currentEpisode + 1,
          episodeTitle: nextEp.name,
          exists: true
        });
        return;
      }

      const nextSeasonNumber = currentSeason + 1;
      const nextSeasonExists = seasons.find(s => s.season_number === nextSeasonNumber);

      if (nextSeasonExists) {
        const nextSeasonEpisodes = await getSeasonEpisodes(id, nextSeasonNumber);
        if (nextSeasonEpisodes.length > 0) {
          const firstEp = nextSeasonEpisodes[0];
          setNextEpisode({
            seasonNumber: nextSeasonNumber,
            episodeNumber: 1,
            episodeTitle: firstEp.name,
            exists: true
          });
          return;
        }
      }

      setNextEpisode({ exists: false, seriesCompleted: true });
    } catch (error) {
      console.error('Errore calcolo episodio successivo:', error);
      setNextEpisode(null);
    }
  }, [continueWatching, seasons, id]);

  useEffect(() => {
    if (continueWatching && seasons.length > 0) {
      calculateNextEpisode();
    }
  }, [continueWatching, seasons, calculateNextEpisode]);

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
    toast(isFavoriteShow ? 'Rimosso dai preferiti' : 'Aggiunto ai preferiti',
      { icon: isFavoriteShow ? '💔' : '🧡' }
    );
    window.dispatchEvent(new CustomEvent('favoritesChanged', {
      detail: { favorites: updatedFavorites }
    }));
  };

  // ============================================
  // 📺 GESTIONE EPISODI
  // ============================================

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

  // Avanza continueWatching all'episodio successivo (o lo azzera se è l'ultimo)
  const advanceContinueWatching = useCallback(async (seasonNum, episodeNum) => {
    const nextEpNum = episodeNum + 1;
    const nextInSeason = episodes.find(e => e.episode_number === nextEpNum);

    if (nextInSeason) {
      const newCont = {
        seasonNumber: seasonNum, episodeNumber: nextEpNum,
        episodeTitle: nextInSeason.name, timestamp: Date.now(), watchTime: 0,
      };
      await storage.saveContinueWatching(id, newCont);
      setContinueWatching(newCont);
    } else {
      // Ultimo episodio della stagione corrente — azzera
      await storage.saveContinueWatching(id, null);
      setContinueWatching(null);
    }
  }, [id, episodes]);

  const markAsWatched = async (episode, e) => {
    e.stopPropagation();
    const episodeKey    = `S${selectedSeason}E${episode.episode_number}`;
    const currentWatched = [...watchedEpisodes];

    if (currentWatched.includes(episodeKey)) {
      // Deselect
      const updated = currentWatched.filter(ep => ep !== episodeKey);
      setWatchedEpisodes(updated);
      await storage.saveWatchedEpisodes(id, updated);
    } else {
      // Marca come visto
      const updated = [...currentWatched, episodeKey];
      setWatchedEpisodes(updated);
      await storage.saveWatchedEpisodes(id, updated);

      // Sincronizza continueWatching se puntava a questo episodio
      if (continueWatching?.seasonNumber === selectedSeason &&
          continueWatching?.episodeNumber === episode.episode_number) {
        await advanceContinueWatching(selectedSeason, episode.episode_number);
      }
    }
  };

  // Marca tutti gli episodi della stagione corrente come visti
  const markSeasonAsWatched = async () => {
    const seasonKeys = episodes.map(ep => `S${selectedSeason}E${ep.episode_number}`);
    const existing   = await storage.getWatchedEpisodes(id) || [];
    const allMarked  = [...new Set([...existing, ...seasonKeys])];
    await storage.saveWatchedEpisodes(id, allMarked);
    setWatchedEpisodes(allMarked);

    // Se continueWatching era in questa stagione, azzera
    if (continueWatching?.seasonNumber === selectedSeason) {
      await storage.saveContinueWatching(id, null);
      setContinueWatching(null);
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

  const getSeasonYear = (airDate) => {
    if (!airDate) return '';
    return new Date(airDate).getFullYear();
  };

  const isContinuingEpisode = (episode) =>
    continueWatching &&
    continueWatching.seasonNumber === selectedSeason &&
    continueWatching.episodeNumber === episode.episode_number;

  // ============================================
  // 🎬 RENDERING
  // ============================================
  if (loading) return <SkeletonDetail />;


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
  if (!showDetails) return <SkeletonDetail />;

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
                <Star size={14} fill="currentColor" style={{ color: '#feca57', verticalAlign: 'middle' }} />
                {' '}{showDetails.vote_average?.toFixed(1)}
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
                <button className="btn btn-primary btn-lg" onClick={playFromBeginning}>
                  <Play size={18} fill="currentColor" />
                  <div className="btn-text"><div>Riproduci</div></div>
                </button>
              )}

              {/* SCENARIO 2 & 3: Sta guardando → "Continua" + altro bottone */}
              {continueWatching && (
                <>
                  {/* Bottone "Continua" - SEMPRE presente se c'è continueWatching */}
                  <button className="btn btn-primary btn-lg" onClick={handleContinueWatching}>
                    <Play size={18} fill="currentColor" />
                    <div className="btn-text"><div>Continua S{continueWatching.seasonNumber}E{continueWatching.episodeNumber}</div></div>
                  </button>

                  {nextEpisode && nextEpisode.exists && (
                    <button className="btn btn-secondary btn-lg" onClick={handlePlayNextEpisode}>
                      <SkipForward size={18} />
                      <div className="btn-text"><div>Episodio Successivo S{nextEpisode.seasonNumber}E{nextEpisode.episodeNumber}</div></div>
                    </button>
                  )}

                  {nextEpisode && nextEpisode.seriesCompleted && (
                    <button className="btn btn-secondary btn-lg" onClick={handleRestartSeries}>
                      <RefreshCw size={18} />
                      <div className="btn-text"><div>Riguarda dall'Inizio</div></div>
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
                <Heart size={18} fill={isFavoriteShow ? 'currentColor' : 'none'} />
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
          <button className={`tab-button ${activeTab === 'episodes' ? 'active' : ''}`} onClick={() => setActiveTab('episodes')}>
            <List size={15} /> Episodi
          </button>
          {cast.length > 0 && (
            <button className={`tab-button ${activeTab === 'cast' ? 'active' : ''}`} onClick={() => setActiveTab('cast')}>
              <Users size={15} /> Cast
            </button>
          )}
          {recommendations.length > 0 && (
            <button className={`tab-button ${activeTab === 'similar' ? 'active' : ''}`} onClick={() => setActiveTab('similar')}>
              <Film size={15} /> Serie Simili
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
            
            {/* SELEZIONE STAGIONI — pill orizzontali */}
            <div className="season-pills-bar">
              <div className="season-pills-scroll">
                {seasons.map(season => {
                  const isActive   = selectedSeason === season.season_number;
                  const isNew      = isNewSeason(season.air_date);
                  const isUpcoming = isUpcomingSeason(season.air_date);
                  return (
                    <button
                      key={season.season_number}
                      className={`season-pill ${isActive ? 'active' : ''}`}
                      onClick={() => handleSeasonChange(season.season_number)}
                    >
                      Stagione {season.season_number}
                      {isNew      && <span className="season-pill-dot season-dot-new" />}
                      {isUpcoming && <span className="season-pill-dot season-dot-upcoming" />}
                    </button>
                  );
                })}
              </div>
              {seasons.find(s => s.season_number === selectedSeason) && (
                <div className="season-meta-row">
                  <p className="season-meta">
                    {episodes.length} episod{episodes.length === 1 ? 'io' : 'i'}
                    {getSeasonYear(seasons.find(s => s.season_number === selectedSeason)?.air_date)
                      ? ` · ${getSeasonYear(seasons.find(s => s.season_number === selectedSeason).air_date)}`
                      : ''}
                    {isNewSeason(seasons.find(s => s.season_number === selectedSeason)?.air_date) && (
                      <span className="season-meta-badge new">Nuova</span>
                    )}
                    {isUpcomingSeason(seasons.find(s => s.season_number === selectedSeason)?.air_date) && (
                      <span className="season-meta-badge upcoming">In arrivo</span>
                    )}
                  </p>
                  {episodes.length > 0 && (
                    <button className="mark-season-btn" onClick={markSeasonAsWatched}>
                      <Check size={12} />
                      Segna tutti come visti
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* LISTA EPISODI — layout orizzontale */}
            <div className="episodes-list">
              {episodes.map(episode => {
                const watched  = isEpisodeWatched(episode);
                const current  = isContinuingEpisode(episode);
                return (
                  <div
                    key={episode.id}
                    className={`episode-row${watched ? ' is-watched' : ''}${current ? ' is-current' : ''}`}
                    onClick={() => playEpisode(episode)}
                  >
                    {/* Thumbnail */}
                    <div className="ep-thumb">
                      <SmartImage
                        src={getEpisodeImageUrl(episode.still_path)}
                        alt={episode.name}
                        title={episode.name}
                        type="backdrop"
                        className="ep-thumb-img"
                      />
                      <div className="ep-play-overlay">
                        <div className="ep-play-circle">
                          <Play size={22} fill="currentColor" />
                        </div>
                      </div>
                      {watched && (
                        <div className="ep-watched-badge">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                      {current && !watched && (
                        <div className="ep-continue-bar" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="ep-info">
                      <div className="ep-header">
                        <span className="ep-number">E{episode.episode_number}</span>
                        <h3 className="ep-title">{episode.name}</h3>
                        <span className="ep-runtime">{episode.runtime || 45} min</span>
                      </div>
                      {episode.overview && (
                        <p className="ep-overview">{episode.overview}</p>
                      )}
                      <div className="ep-actions" onClick={e => e.stopPropagation()}>
                        <button
                          className={`ep-watched-btn${watched ? ' active' : ''}`}
                          onClick={e => markAsWatched(episode, e)}
                        >
                          {watched ? <><Check size={13} /> Visto</> : <><Eye size={13} /> Segna come visto</>}
                        </button>
                        {current && (
                          <span className="ep-in-progress">
                            <Play size={10} fill="currentColor" /> In corso
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
                        <User size={32} />
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
              title="Serie TV Simili"
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