import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTVSeasons, getSeasonEpisodes, getBackdropUrl, getEpisodeImageUrl, getTVCredits, getTVRecommendations } from '../services/tmdbApi';
import { useTrailerCycle } from '../hooks/useTrailerCycle';
import SmartImage from './SmartImage';
import MovieCarousel from './MovieCarousel';
import './TVShowDetail.css';
import storage from '../services/storage';
import { SkeletonDetail } from './Skeleton';
import { Play, SkipForward, RefreshCw, Heart, List, Info, Film, Eye, Check, Star, User, Volume2, VolumeX, ChevronDown } from 'lucide-react';


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
  const [loading, setLoading]               = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState([]);
  const [continueWatching, setContinueWatching] = useState(null);
  const [isFavoriteShow, setIsFavoriteShow] = useState(false);
  const [pulsingFav, setPulsingFav]         = useState(false);
  
  // 🆕 NUOVO STATO: Episodio successivo
  const [nextEpisode, setNextEpisode] = useState(null);
  
  // 🆕 NUOVI STATI PER TAB
  const [activeTab, setActiveTab] = useState('episodes');
  const [cast, setCast] = useState([]);
  const [crew, setCrew] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  const [openSections, setOpenSections] = useState({ similar: false });
  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    setActiveTab('episodes');
    setOpenSections({ similar: false });
  }, [id]);

  const loadFavoriteStatus = useCallback(async () => {
    const favorites = await storage.getFavorites();
    const isFavorite = favorites.some(fav => fav.id === parseInt(id) && fav.type === 'tv');
    setIsFavoriteShow(isFavorite);
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

      // Filtra stagioni valide: esclude speciali (season 0) e stagioni senza episodi
      const validSeasons = showSeasons.filter(season => season.season_number > 0 && season.episode_count > 0);
      setSeasons(validSeasons);

      // 2. Carica continue watching PRIMA di scegliere la stagione
      const [continueData, watched] = await Promise.all([
        storage.getContinueWatching(id),
        storage.getWatchedEpisodes(id),
      ]);
      setContinueWatching(continueData);
      setWatchedEpisodes(watched || []);

      // 3. Determina quale stagione aprire:
      //    initialSeason (URL) → query param → stagione del continue watching → 1
      let targetSeason = 1;
      if (initialSeason) {
        targetSeason = parseInt(initialSeason);
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        const seasonFromUrl = urlParams.get('season');
        if (seasonFromUrl) {
          targetSeason = parseInt(seasonFromUrl);
        } else if (continueData?.seasonNumber) {
          targetSeason = continueData.seasonNumber;
        }
      }

      // 4. Carica episodi della stagione target
      if (validSeasons.length > 0) {
        const seasonToLoad = validSeasons.find(s => s.season_number === targetSeason)
          ? targetSeason
          : validSeasons[0].season_number;

        setSelectedSeason(seasonToLoad);
        const seasonEpisodes = await getSeasonEpisodes(id, seasonToLoad);
        setEpisodes(seasonEpisodes);
      }

      // 5. Carica favoriti e dati aggiuntivi in parallelo
      await Promise.all([
        loadFavoriteStatus(),
        loadCredits(id),
        loadRecommendations(id),
      ]);

      setLoading(false);
    };

    loadShowData();
  }, [id, initialSeason, loadFavoriteStatus]);

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
    const data = await getTVCredits(tvId);
    setCast(data.cast.slice(0, 20));
    setCrew(data.crew
      .filter(m => ['Creator', 'Executive Producer', 'Producer'].includes(m.job))
      .slice(0, 10));
  };

  const loadRecommendations = async (tvId) => {
    const data = await getTVRecommendations(tvId);
    setRecommendations(
      data.results.slice(0, 20).map(item => ({ ...item, type: 'tv' }))
    );
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
    } else {
      // Aggiungi ai favoriti
      const favoriteItem = { ...showDetails, type: 'tv' };
      updatedFavorites = [...favorites, favoriteItem];
      setIsFavoriteShow(true);
    }
    
    storage.saveFavorites(updatedFavorites);
    setPulsingFav(true);
    setTimeout(() => setPulsingFav(false), 500);
    window.dispatchEvent(new CustomEvent('favoritesChanged', {
      detail: { favorites: updatedFavorites }
    }));
  };

  // ============================================
  // 📺 GESTIONE EPISODI
  // ============================================

  const handleSeasonChange = async (seasonNumber) => {
    if (seasonNumber === selectedSeason) return;
    setSelectedSeason(seasonNumber);
    setEpisodesLoading(true);
    const seasonEpisodes = await getSeasonEpisodes(id, seasonNumber);
    setEpisodes(seasonEpisodes);
    setEpisodesLoading(false);
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

  // Marca/deseleziona tutti gli episodi della stagione corrente
  const markSeasonAsWatched = async () => {
    const seasonKeys  = episodes.map(ep => `S${selectedSeason}E${ep.episode_number}`);
    const allWatched  = seasonKeys.every(k => watchedEpisodes.includes(k));
    const existing    = await storage.getWatchedEpisodes(id) || [];

    let updated;
    if (allWatched) {
      // Togli la spunta a tutti gli episodi della stagione
      updated = existing.filter(k => !seasonKeys.includes(k));
    } else {
      // Marca tutti come visti
      updated = [...new Set([...existing, ...seasonKeys])];
      // Se continueWatching era in questa stagione, azzera
      if (continueWatching?.seasonNumber === selectedSeason) {
        await storage.saveContinueWatching(id, null);
        setContinueWatching(null);
      }
    }

    await storage.saveWatchedEpisodes(id, updated);
    setWatchedEpisodes(updated);
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

  // Hook sempre prima degli early return
  const { showIframe, trailerVisible, trailerSrc, isMuted, iframeRef, toggleMute } =
    useTrailerCycle(id, 'tv');

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
          HERO SECTION - BACKDROP + TRAILER LOOP
          ======================================== */}
      <div className="tv-hero">

        {/* Layer 1: immagine fissa */}
        <div
          className="tv-hero-bg"
          style={{ backgroundImage: `url(${getBackdropUrl(showDetails.backdrop_path)})` }}
        />

        {/* Layer 2: trailer iframe (loop automatico) */}
        {showIframe && trailerSrc && (
          <div className={`tv-hero-trailer${trailerVisible ? ' visible' : ''}`}>
            <iframe
              ref={iframeRef}
              src={trailerSrc}
              frameBorder="0"
              allow="autoplay; encrypted-media"
              title="trailer"
            />
            <div className="tv-hero-trailer-mask" />
          </div>
        )}

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
            
            {/* Descrizione — 3 righe, si espande al hover come HeroSection */}
            {showDetails.overview && (
              <p className="tv-overview">{showDetails.overview}</p>
            )}
            
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

              {/* Bottone principale — arancione */}
              {!continueWatching ? (
                <button className="tv-btn-play" onClick={playFromBeginning}>
                  <Play size={20} fill="currentColor" />
                  Riproduci
                </button>
              ) : (
                <button className="tv-btn-play" onClick={handleContinueWatching}>
                  <Play size={20} fill="currentColor" />
                  Continua S{continueWatching.seasonNumber}E{continueWatching.episodeNumber}
                </button>
              )}

              {/* Bottone secondario — glass, solo se c'è un episodio successivo o la serie è finita */}
              {continueWatching && nextEpisode?.exists && (
                <button className="tv-btn-info" onClick={handlePlayNextEpisode}>
                  <SkipForward size={18} />
                  Successivo S{nextEpisode.seasonNumber}E{nextEpisode.episodeNumber}
                </button>
              )}
              {continueWatching && nextEpisode?.seriesCompleted && (
                <button className="tv-btn-info" onClick={handleRestartSeries}>
                  <RefreshCw size={18} />
                  Riguarda dall'Inizio
                </button>
              )}

              {/* Cuore */}
              <button
                className={`tv-btn-fav${isFavoriteShow ? ' active' : ''}${pulsingFav ? ' heart-pulse' : ''}`}
                onClick={toggleFavorites}
                aria-label={isFavoriteShow ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti'}
              >
                <Heart size={20} fill={isFavoriteShow ? 'currentColor' : 'none'} />
              </button>
            </div>
            
          </div>
        </div>

        {/* Pulsante mute — compare solo quando il trailer è visibile */}
        {showIframe && trailerVisible && (
          <button className="detail-mute-btn" onClick={toggleMute} aria-label={isMuted ? 'Attiva audio' : 'Disattiva audio'}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}
      </div>

      {/* ========================================
          🆕 TABS NAVIGATION
          ======================================== */}
      <div className="tv-tabs-container">
        <div className="tv-tabs">
          <button className={`tab-button ${activeTab === 'episodes' ? 'active' : ''}`} onClick={() => setActiveTab('episodes')}>
            <List size={15} /> Episodi
          </button>
          <button className={`tab-button ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
            <Info size={15} /> Info
          </button>
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
                  {episodes.length > 0 && (() => {
                    const seasonKeys  = episodes.map(ep => `S${selectedSeason}E${ep.episode_number}`);
                    const allWatched  = seasonKeys.every(k => watchedEpisodes.includes(k));
                    return (
                      <button className={`mark-season-btn${allWatched ? ' active' : ''}`} onClick={markSeasonAsWatched}>
                        <Check size={12} />
                        {allWatched ? 'Togli spunta a tutti' : 'Segna tutti come visti'}
                      </button>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* LISTA EPISODI — layout orizzontale */}
            {episodesLoading && (
              <div className="episodes-loading">
                <div className="episodes-spinner" />
              </div>
            )}
            <div className={`episodes-list${episodesLoading ? ' episodes-list-loading' : ''}`}>
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

        {/* === INFO TAB === */}
        {activeTab === 'info' && (
          <div className="tab-panel tab-info">
            <div className="tv-scroll-content">

              {/* Riga: metadata + cast */}
              <div className="tv-main-row">

                {/* Metadata */}
                <div className="info-meta">
                  <div className="info-group">
                    {creator && (
                      <div className="info-row">
                        <span className="info-label">Creata da</span>
                        <span className="info-value">{creator.name}</span>
                      </div>
                    )}
                    {showDetails.number_of_seasons > 0 && (
                      <div className="info-row">
                        <span className="info-label">Stagioni</span>
                        <span className="info-value">{showDetails.number_of_seasons}</span>
                      </div>
                    )}
                    {showDetails.number_of_episodes > 0 && (
                      <div className="info-row">
                        <span className="info-label">Episodi totali</span>
                        <span className="info-value">{showDetails.number_of_episodes}</span>
                      </div>
                    )}
                    {showDetails.episode_run_time?.length > 0 && (
                      <div className="info-row">
                        <span className="info-label">Durata episodio</span>
                        <span className="info-value">{showDetails.episode_run_time[0]} min</span>
                      </div>
                    )}
                    {showDetails.networks?.length > 0 && (
                      <div className="info-row">
                        <span className="info-label">Rete</span>
                        <span className="info-value">{showDetails.networks.map(n => n.name).join(', ')}</span>
                      </div>
                    )}
                    {showDetails.spoken_languages?.length > 0 && (
                      <div className="info-row">
                        <span className="info-label">Lingua originale</span>
                        <span className="info-value">{showDetails.spoken_languages.map(l => l.english_name).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cast compatto — max 8 */}
                {cast.length > 0 && (
                  <div className="movie-cast-col">
                    <h2 className="section-label">Cast</h2>
                    <div className="cast-compact-grid">
                      {cast.slice(0, 10).map(actor => (
                        <div key={actor.id} className="cast-compact-item">
                          {actor.profile_path ? (
                            <img
                              className="cast-compact-photo"
                              src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                              alt={actor.name}
                              loading="lazy"
                            />
                          ) : (
                            <div className="cast-compact-photo cast-compact-placeholder">
                              <User size={20} />
                            </div>
                          )}
                          <div className="cast-compact-info">
                            <p className="cast-compact-name">{actor.name}</p>
                            <p className="cast-compact-char">{actor.character}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Serie Simili — collassabile */}
              {recommendations.length > 0 && (
                <div className="movie-section">
                  <button className="section-toggle" onClick={() => toggleSection('similar')}>
                    <span className="section-label">Serie Simili</span>
                    <ChevronDown size={18} className={`section-chevron${openSections.similar ? ' open' : ''}`} />
                  </button>
                  <div className={`section-body${openSections.similar ? ' open' : ''}`}>
                    <div className="section-body-inner">
                      <MovieCarousel title="" items={recommendations} type="tv" />
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}

export default TVShowDetail;