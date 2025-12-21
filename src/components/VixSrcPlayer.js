import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTVDetails, getSeasonEpisodes } from '../services/tmdbApi';
import './VixSrcPlayer.css';
import storage from '../services/storage';

function VixSrcPlayer({ tmdbId, type, season, episode, title }) {
  const iframeRef = useRef(null);
  const navigate = useNavigate();
  const [hasNextEpisode, setHasNextEpisode] = useState(false);
  const [hasPrevEpisode, setHasPrevEpisode] = useState(false);
  const [watchStartTime, setWatchStartTime] = useState(Date.now());
  const [currentEpisodeTitle, setCurrentEpisodeTitle] = useState(''); // 🆕 Titolo episodio corrente

  const getVixSrcUrl = () => {
    let baseUrl = 'https://vixsrc.to/';
    
    if (type === 'movie') {
      baseUrl += `movie/${tmdbId}`;
    } else if (type === 'tv') {
      baseUrl += `tv/${tmdbId}/${season}/${episode}`;
    }
    
    // Parametri per forzare qualità alta
    const params = new URLSearchParams({
      primaryColor: 'ff6b6b',
      secondaryColor: 'feca57',
      autoplay: 'false',
      lang: 'it',
      quality: '1080p',
      preferHD: 'true',
      autoQuality: 'false'
    });
    
    return `${baseUrl}?${params.toString()}`;
  };

  // 🆕 CARICA TITOLO EPISODIO VERO da TMDB
  useEffect(() => {
    if (type === 'tv' && season && episode) {
      loadEpisodeTitle();
      loadEpisodeNavigation();
      setWatchStartTime(Date.now());
    }
  }, [tmdbId, season, episode, type]);

  // 🆕 FUNZIONE: Carica titolo episodio vero
  const loadEpisodeTitle = async () => {
    try {
      const seasonEpisodes = await getSeasonEpisodes(tmdbId, parseInt(season));
      const currentEpisode = seasonEpisodes.find(ep => ep.episode_number === parseInt(episode));
      
      if (currentEpisode) {
        setCurrentEpisodeTitle(currentEpisode.name);
        console.log(`✅ Titolo episodio caricato: "${currentEpisode.name}"`);
        
        // 🆕 SALVA SUBITO con titolo vero (quando inizi a guardare)
        const continueData = {
          seasonNumber: parseInt(season),
          episodeNumber: parseInt(episode),
          episodeTitle: currentEpisode.name, // 👈 TITOLO VERO!
          timestamp: Date.now(),
          watchTime: 0
        };
        await storage.saveContinueWatching(tmdbId, continueData);
        console.log(`💾 ContinueWatching salvato: S${season}E${episode} - "${currentEpisode.name}"`);
      } else {
        console.warn('⚠️ Episodio non trovato, uso titolo generico');
        setCurrentEpisodeTitle(`Episodio ${episode}`);
      }
    } catch (error) {
      console.error('❌ Errore caricamento titolo episodio:', error);
      setCurrentEpisodeTitle(`Episodio ${episode}`);
    }
  };

  // Salva "continua a guardare" ogni 30 secondi
  useEffect(() => {
    if (type === 'tv') {
      const interval = setInterval(() => {
        saveContinueWatching();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [tmdbId, season, episode, type, watchStartTime, currentEpisodeTitle]);

  // Salva quando l'utente esce dalla pagina
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (type === 'tv') {
        saveContinueWatching();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && type === 'tv') {
        saveContinueWatching();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (type === 'tv') {
        saveContinueWatching();
      }
    };
  }, [tmdbId, season, episode, type, watchStartTime, currentEpisodeTitle]);

  // 🔧 SALVATAGGIO CON TITOLO VERO
  const saveContinueWatching = () => {
    const watchTime = Math.floor((Date.now() - watchStartTime) / 1000);
    
    if (watchTime > 60) {
      const continueData = {
        seasonNumber: parseInt(season),
        episodeNumber: parseInt(episode),
        episodeTitle: currentEpisodeTitle || `Episodio ${episode}`, // 👈 USA TITOLO VERO
        watchTime: watchTime,
        timestamp: Date.now(),
        lastWatched: new Date().toISOString()
      };
      
      storage.saveContinueWatching(tmdbId, continueData);
      console.log(`💾 Auto-save: S${season}E${episode} - "${currentEpisodeTitle}" (${Math.floor(watchTime/60)}m guardati)`);
    }
  };

  const loadEpisodeNavigation = async () => {
    try {
      const seriesDetails = await getTVDetails(tmdbId);
      const currentSeasonNum = parseInt(season);
      const currentEpisodeNum = parseInt(episode);
      
      const currentSeasonEpisodes = await getSeasonEpisodes(tmdbId, currentSeasonNum);
      
      // Controlla episodio precedente
      let prevExists = false;
      if (currentEpisodeNum > 1) {
        prevExists = true;
      } else if (currentSeasonNum > 1) {
        try {
          const prevSeasonEpisodes = await getSeasonEpisodes(tmdbId, currentSeasonNum - 1);
          prevExists = prevSeasonEpisodes.length > 0;
        } catch (e) {
          prevExists = false;
        }
      }
      
      // Controlla episodio successivo
      let nextExists = false;
      if (currentEpisodeNum < currentSeasonEpisodes.length) {
        nextExists = true;
      } else if (currentSeasonNum < seriesDetails.number_of_seasons) {
        try {
          const nextSeasonEpisodes = await getSeasonEpisodes(tmdbId, currentSeasonNum + 1);
          nextExists = nextSeasonEpisodes.length > 0;
        } catch (e) {
          nextExists = false;
        }
      }
      
      setHasPrevEpisode(prevExists);
      setHasNextEpisode(nextExists);
      
    } catch (error) {
      console.error('Errore caricamento navigazione episodi:', error);
    }
  };

  const goBackToEpisodes = () => {
    if (type === 'tv') {
      saveContinueWatching();
    }
    
    if (type === 'tv') {
      // Usa il nuovo routing con parametro stagione
      navigate(`/tv/${tmdbId}/season/${season}`);
    } else {
      navigate('/');
    }
  };

  // 🔧 NAVIGAZIONE EPISODIO PRECEDENTE - con titolo vero
  const goToPreviousEpisode = async () => {
    const currentSeasonNum = parseInt(season);
    const currentEpisodeNum = parseInt(episode);
    
    try {
      if (currentEpisodeNum > 1) {
        // Vai all'episodio precedente nella stessa stagione
        const prevEpisodeNum = currentEpisodeNum - 1;
        
        // 🆕 CARICA TITOLO VERO prima di salvare
        const seasonEpisodes = await getSeasonEpisodes(tmdbId, currentSeasonNum);
        const prevEpisode = seasonEpisodes.find(ep => ep.episode_number === prevEpisodeNum);
        
        const continueData = {
          seasonNumber: currentSeasonNum,
          episodeNumber: prevEpisodeNum,
          episodeTitle: prevEpisode?.name || `Episodio ${prevEpisodeNum}`, // 👈 TITOLO VERO
          timestamp: Date.now(),
          watchTime: 0
        };
        await storage.saveContinueWatching(tmdbId, continueData);
        console.log(`💾 Salvato episodio precedente: S${currentSeasonNum}E${prevEpisodeNum} - "${prevEpisode?.name}"`);
        
        navigate(`/player/tv/${tmdbId}/${currentSeasonNum}/${prevEpisodeNum}`);
        
      } else if (currentSeasonNum > 1) {
        // Vai all'ultimo episodio della stagione precedente
        const prevSeasonNum = currentSeasonNum - 1;
        const prevSeasonEpisodes = await getSeasonEpisodes(tmdbId, prevSeasonNum);
        
        if (prevSeasonEpisodes.length > 0) {
          const lastEpisodeNum = prevSeasonEpisodes.length;
          const lastEpisode = prevSeasonEpisodes[lastEpisodeNum - 1];
          
          const continueData = {
            seasonNumber: prevSeasonNum,
            episodeNumber: lastEpisodeNum,
            episodeTitle: lastEpisode?.name || `Episodio ${lastEpisodeNum}`, // 👈 TITOLO VERO
            timestamp: Date.now(),
            watchTime: 0
          };
          await storage.saveContinueWatching(tmdbId, continueData);
          console.log(`💾 Salvato stagione precedente: S${prevSeasonNum}E${lastEpisodeNum} - "${lastEpisode?.name}"`);
          
          navigate(`/player/tv/${tmdbId}/${prevSeasonNum}/${lastEpisodeNum}`);
        }
      }
    } catch (error) {
      console.error('❌ Errore navigazione episodio precedente:', error);
    }
  };

  // 🔧 NAVIGAZIONE EPISODIO SUCCESSIVO - con titolo vero
  const goToNextEpisode = async () => {
    // Marca episodio corrente come visto
    const episodeKey = `S${season}E${episode}`;
    const watchedEpisodes = await storage.getWatchedEpisodes(tmdbId) || [];
    if (!watchedEpisodes.includes(episodeKey)) {
      watchedEpisodes.push(episodeKey);
      await storage.saveWatchedEpisodes(tmdbId, watchedEpisodes);
    }
    
    const currentSeasonNum = parseInt(season);
    const currentEpisodeNum = parseInt(episode);
    
    try {
      const currentSeasonEpisodes = await getSeasonEpisodes(tmdbId, currentSeasonNum);
      
      if (currentEpisodeNum < currentSeasonEpisodes.length) {
        // Vai all'episodio successivo nella stessa stagione
        const nextEpisodeNum = currentEpisodeNum + 1;
        const nextEpisode = currentSeasonEpisodes.find(ep => ep.episode_number === nextEpisodeNum);
        
        // 🆕 SALVA con titolo vero
        const continueData = {
          seasonNumber: currentSeasonNum,
          episodeNumber: nextEpisodeNum,
          episodeTitle: nextEpisode?.name || `Episodio ${nextEpisodeNum}`, // 👈 TITOLO VERO
          timestamp: Date.now(),
          watchTime: 0
        };
        await storage.saveContinueWatching(tmdbId, continueData);
        console.log(`💾 Salvato nuovo episodio: S${currentSeasonNum}E${nextEpisodeNum} - "${nextEpisode?.name}"`);
        
        navigate(`/player/tv/${tmdbId}/${currentSeasonNum}/${nextEpisodeNum}`);
        
      } else {
        // Vai alla stagione successiva, episodio 1
        const seriesDetails = await getTVDetails(tmdbId);
        if (currentSeasonNum < seriesDetails.number_of_seasons) {
          const nextSeasonNum = currentSeasonNum + 1;
          const nextSeasonEpisodes = await getSeasonEpisodes(tmdbId, nextSeasonNum);
          
          if (nextSeasonEpisodes.length > 0) {
            const firstEpisode = nextSeasonEpisodes[0];
            
            const continueData = {
              seasonNumber: nextSeasonNum,
              episodeNumber: 1,
              episodeTitle: firstEpisode?.name || 'Episodio 1', // 👈 TITOLO VERO
              timestamp: Date.now(),
              watchTime: 0
            };
            await storage.saveContinueWatching(tmdbId, continueData);
            console.log(`💾 Salvato nuova stagione: S${nextSeasonNum}E1 - "${firstEpisode?.name}"`);
            
            navigate(`/player/tv/${tmdbId}/${nextSeasonNum}/1`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Errore navigazione episodio successivo:', error);
    }
  };

  return (
    <div className="vixsrc-player">
      {/* Header con titolo episodio */}
      <div className="player-header">
        {type === 'tv' ? (
          <>
            <h2>{currentEpisodeTitle}</h2>
          </>
        ) : (
          <h2>{title}</h2>
        )}
      </div>
      
      {/* Player Container */}
      <div className="player-container">
        <iframe
          ref={iframeRef}
          src={getVixSrcUrl()}
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          title={`Player per ${title}`}
          onLoad={() => console.log('✅ Player caricato')}
        />
      </div>
      
      {/* Controlli di navigazione */}
      <div className="player-controls">
        <div className="navigation-buttons">
          <button onClick={goBackToEpisodes} className="back-button">
            ← Torna Indietro {type === 'tv' ? `(S${season})` : ''}
          </button>
          
          {/* Controlli episodi solo per serie TV */}
          {type === 'tv' && (
            <div className="episode-navigation">
              {hasPrevEpisode && (
                <button onClick={goToPreviousEpisode} className="episode-nav-button prev">
                  ⏮️ Episodio Precedente
                </button>
              )}
              
              {hasNextEpisode && (
                <button onClick={goToNextEpisode} className="episode-nav-button next">
                  Episodio Successivo ⏭️
                </button>
              )}
            </div>
          )}
        </div>
        
        <p className="player-info">
          {type === 'movie' ? '🎬 Film' : `📺 S${season}E${episode}`} • Auto-Save
        </p>
      </div>
    </div>
  );
}

export default VixSrcPlayer;