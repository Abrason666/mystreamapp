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

  // Carica dati episodi per serie TV
  useEffect(() => {
    if (type === 'tv' && season && episode) {
      loadEpisodeNavigation();
      setWatchStartTime(Date.now());
    }
  }, [tmdbId, season, episode, type]);

  // Salva "continua a guardare" ogni 30 secondi
  useEffect(() => {
    if (type === 'tv') {
      const interval = setInterval(() => {
        saveContinueWatching();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [tmdbId, season, episode, type, watchStartTime]);

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
  }, [tmdbId, season, episode, type, watchStartTime]);

  const saveContinueWatching = () => {
    const watchTime = Math.floor((Date.now() - watchStartTime) / 1000);
    
    if (watchTime > 60) {
      const continueData = {
        tmdbId: tmdbId,
        seasonNumber: parseInt(season),
        episodeNumber: parseInt(episode),
        episodeTitle: title,
        watchTime: watchTime,
        timestamp: Date.now(),
        lastWatched: new Date().toISOString()
      };
      
      storage.saveContinueWatching(tmdbId, continueData);
      console.log(`💾 Salvato "continua a guardare": S${season}E${episode}`);
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

 const goToPreviousEpisode = async () => {
    // 🚨 NON salvare qui il continueWatching dell'episodio corrente  
    // saveContinueWatching(); // ❌ RIMOSSO
    
    const currentSeasonNum = parseInt(season);
    const currentEpisodeNum = parseInt(episode);
    
    if (currentEpisodeNum > 1) {
      // Vai all'episodio precedente nella stessa stagione
      const prevEpisodeNum = currentEpisodeNum - 1;
      
      // ✅ SALVA il progresso del NUOVO episodio
      const continueData = {
        seasonNumber: currentSeasonNum,
        episodeNumber: prevEpisodeNum,
        episodeTitle: `Episodio ${prevEpisodeNum}`,
        timestamp: Date.now(),
        watchTime: 0
      };
      storage.saveContinueWatching(tmdbId, continueData);
      console.log(`💾 Salvato episodio precedente: S${currentSeasonNum}E${prevEpisodeNum}`);
      
      navigate(`/player/tv/${tmdbId}/${currentSeasonNum}/${prevEpisodeNum}`);
      
    } else if (currentSeasonNum > 1) {
      try {
        const prevSeasonEpisodes = await getSeasonEpisodes(tmdbId, currentSeasonNum - 1);
        if (prevSeasonEpisodes.length > 0) {
          const prevSeasonNum = currentSeasonNum - 1;
          const lastEpisodeNum = prevSeasonEpisodes.length;
          
          // ✅ SALVA il progresso della stagione precedente
          const continueData = {
            seasonNumber: prevSeasonNum,
            episodeNumber: lastEpisodeNum,
            episodeTitle: `Episodio ${lastEpisodeNum}`,
            timestamp: Date.now(),
            watchTime: 0
          };
          storage.saveContinueWatching(tmdbId, continueData);
          console.log(`💾 Salvato stagione precedente: S${prevSeasonNum}E${lastEpisodeNum}`);
          
          navigate(`/player/tv/${tmdbId}/${prevSeasonNum}/${lastEpisodeNum}`);
        }
      } catch (error) {
        console.error('Errore navigazione episodio precedente:', error);
      }
    }
  };

const goToNextEpisode = async () => {
    // 🚨 NON salvare qui il continueWatching dell'episodio corrente
    // saveContinueWatching(); // ❌ RIMOSSO
    
    // Marca episodio corrente come visto
    const episodeKey = `S${season}E${episode}`;
    const watchedEpisodes = await storage.getWatchedEpisodes(tmdbId) || [];
    if (!watchedEpisodes.includes(episodeKey)) {
      watchedEpisodes.push(episodeKey);
      storage.saveWatchedEpisodes(tmdbId, watchedEpisodes);
    }
    
    const currentSeasonNum = parseInt(season);
    const currentEpisodeNum = parseInt(episode);
    
    try {
      const currentSeasonEpisodes = await getSeasonEpisodes(tmdbId, currentSeasonNum);
      
      if (currentEpisodeNum < currentSeasonEpisodes.length) {
        // Vai all'episodio successivo nella stessa stagione
        const nextEpisodeNum = currentEpisodeNum + 1;
        
        // ✅ SALVA il progresso del NUOVO episodio PRIMA di navigare
        const continueData = {
          seasonNumber: currentSeasonNum,
          episodeNumber: nextEpisodeNum,
          episodeTitle: `Episodio ${nextEpisodeNum}`, // Titolo generico
          timestamp: Date.now(),
          watchTime: 0 // Nuovo episodio, tempo 0
        };
        storage.saveContinueWatching(tmdbId, continueData);
        console.log(`💾 Salvato nuovo episodio: S${currentSeasonNum}E${nextEpisodeNum}`);
        
        // Poi naviga
        navigate(`/player/tv/${tmdbId}/${currentSeasonNum}/${nextEpisodeNum}`);
        
      } else {
        // Vai alla stagione successiva, episodio 1
        const seriesDetails = await getTVDetails(tmdbId);
        if (currentSeasonNum < seriesDetails.number_of_seasons) {
          const nextSeasonNum = currentSeasonNum + 1;
          
          // ✅ SALVA il progresso della NUOVA stagione
          const continueData = {
            seasonNumber: nextSeasonNum,
            episodeNumber: 1,
            episodeTitle: `Episodio 1`,
            timestamp: Date.now(),
            watchTime: 0
          };
          storage.saveContinueWatching(tmdbId, continueData);
          console.log(`💾 Salvato nuova stagione: S${nextSeasonNum}E1`);
          
          navigate(`/player/tv/${tmdbId}/${nextSeasonNum}/1`);
        }
      }
    } catch (error) {
      console.error('Errore navigazione episodio successivo:', error);
    }
  };


  return (
    <div className="vixsrc-player">
      {/* Header semplificato */}
      <div className="player-header">
        <h2>{title}</h2>
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