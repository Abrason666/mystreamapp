import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTVDetails, getSeasonEpisodes } from '../services/tmdbApi';
import './VixSrcPlayer.css';
import storage from '../services/storage';
import { ChevronLeft, SkipBack, SkipForward } from 'lucide-react';

function VixSrcPlayer({ tmdbId, type, season, episode, title }) {
  const navigate = useNavigate();

  const [hasNextEpisode, setHasNextEpisode]           = useState(false);
  const [hasPrevEpisode, setHasPrevEpisode]           = useState(false);
  const [watchStartTime, setWatchStartTime]           = useState(Date.now());
  const [currentEpisodeTitle, setCurrentEpisodeTitle] = useState('');
  const [seriesTitle, setSeriesTitle]                 = useState('');
  const [playerLoading, setPlayerLoading]             = useState(true);

  // Refs stabili per l'auto-mark (non causano re-render)
  const episodeRuntimeRef = useRef(0);   // minuti, da TMDB
  const autoMarkedRef     = useRef(false); // evita doppio mark per stesso episodio

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')                        goBackToEpisodes();
      if (e.key === 'ArrowRight' && hasNextEpisode)  goToNextEpisode();
      if (e.key === 'ArrowLeft'  && hasPrevEpisode)  goToPreviousEpisode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNextEpisode, hasPrevEpisode]);

  // ── URL player ────────────────────────────────────────────────────────────
  const getVixSrcUrl = () => {
    let base = 'https://vixsrc.to/';
    if (type === 'movie') base += `movie/${tmdbId}`;
    else if (type === 'tv') base += `tv/${tmdbId}/${season}/${episode}`;

    const params = new URLSearchParams({
      primaryColor: 'ff6b35',
      secondaryColor: 'feca57',
      autoplay: 'false',
      lang: 'it',
      quality: '1080p',
      preferHD: 'true',
      autoQuality: 'false',
    });
    return `${base}?${params}`;
  };

  // ── Funzioni dati ─────────────────────────────────────────────────────────

  // Auto-mark: chiamata al massimo una volta per episodio
  const autoMarkWatched = useCallback(async () => {
    if (autoMarkedRef.current) return;
    autoMarkedRef.current = true;

    const epKey  = `S${season}E${episode}`;
    const watched = await storage.getWatchedEpisodes(tmdbId) || [];
    if (watched.includes(epKey)) return;

    await storage.saveWatchedEpisodes(tmdbId, [...watched, epKey]);

    // Sincronizza continueWatching: se puntava a questo episodio, azzera
    const cont = await storage.getContinueWatching(tmdbId);
    if (cont?.seasonNumber === parseInt(season) && cont?.episodeNumber === parseInt(episode)) {
      await storage.saveContinueWatching(tmdbId, null);
    }
  }, [tmdbId, season, episode]);

  // Reset del flag quando l'utente cambia episodio
  useEffect(() => {
    autoMarkedRef.current = false;
    episodeRuntimeRef.current = 0;
  }, [season, episode]);

  const saveContinueWatching = useCallback(() => {
    const watchTime = Math.floor((Date.now() - watchStartTime) / 1000);
    if (watchTime < 60) return;

    if (type === 'movie') {
      storage.saveContinueWatching(tmdbId, {
        contentType: 'movie',
        watchTime,
        timestamp:   Date.now(),
      });
      return;
    }

    storage.saveContinueWatching(tmdbId, {
      seasonNumber:  parseInt(season),
      episodeNumber: parseInt(episode),
      episodeTitle:  currentEpisodeTitle || `Episodio ${episode}`,
      contentType:   'tv',
      watchTime,
      timestamp:     Date.now(),
      lastWatched:   new Date().toISOString(),
    });

    const runtime   = episodeRuntimeRef.current;
    const threshold = Math.max(120, runtime > 0 ? runtime * 60 * 0.8 : 120);
    if (watchTime >= threshold) autoMarkWatched();
  }, [type, season, episode, watchStartTime, currentEpisodeTitle, tmdbId, autoMarkWatched]);

  const loadEpisodeTitle = useCallback(async () => {
    try {
      const eps     = await getSeasonEpisodes(tmdbId, parseInt(season));
      const current = eps.find(ep => ep.episode_number === parseInt(episode));
      const epTitle = current?.name || `Episodio ${episode}`;
      setCurrentEpisodeTitle(epTitle);
      if (current?.runtime) episodeRuntimeRef.current = current.runtime;
      await storage.saveContinueWatching(tmdbId, {
        seasonNumber:  parseInt(season),
        episodeNumber: parseInt(episode),
        episodeTitle:  epTitle,
        contentType:   'tv',
        timestamp:     Date.now(),
        watchTime:     0,
      });
    } catch {
      setCurrentEpisodeTitle(`Episodio ${episode}`);
    }
  }, [tmdbId, season, episode]);

  const loadEpisodeNavigation = useCallback(async () => {
    try {
      const details          = await getTVDetails(tmdbId);
      setSeriesTitle(details.name || '');
      const sNum             = parseInt(season);
      const eNum             = parseInt(episode);
      const currentSeasonEps = await getSeasonEpisodes(tmdbId, sNum);

      let prevExists = eNum > 1;
      if (!prevExists && sNum > 1) {
        try { prevExists = (await getSeasonEpisodes(tmdbId, sNum - 1)).length > 0; } catch { /**/ }
      }

      let nextExists = eNum < currentSeasonEps.length;
      if (!nextExists && sNum < details.number_of_seasons) {
        try { nextExists = (await getSeasonEpisodes(tmdbId, sNum + 1)).length > 0; } catch { /**/ }
      }

      setHasPrevEpisode(prevExists);
      setHasNextEpisode(nextExists);
    } catch { /**/ }
  }, [tmdbId, season, episode]);

  useEffect(() => {
    setWatchStartTime(Date.now());
    if (type === 'tv' && season && episode) {
      loadEpisodeTitle();
      loadEpisodeNavigation();
    }
    if (type === 'movie') {
      storage.saveContinueWatching(tmdbId, {
        contentType: 'movie',
        watchTime:   0,
        timestamp:   Date.now(),
      });
    }
  }, [tmdbId, season, episode, type, loadEpisodeTitle, loadEpisodeNavigation]);

  useEffect(() => {
    const id = setInterval(saveContinueWatching, 30000);
    return () => clearInterval(id);
  }, [saveContinueWatching]);

  useEffect(() => {
    const onUnload     = () => saveContinueWatching();
    const onVisibility = () => { if (document.visibilityState === 'hidden') saveContinueWatching(); };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      saveContinueWatching();
    };
  }, [saveContinueWatching]);

  // ── Navigazione ───────────────────────────────────────────────────────────
  const goBackToEpisodes = () => {
    saveContinueWatching();
    navigate(type === 'tv' ? `/tv/${tmdbId}/season/${season}` : '/');
  };

  const goToPreviousEpisode = async () => {
    const sNum = parseInt(season);
    const eNum = parseInt(episode);
    try {
      if (eNum > 1) {
        const eps  = await getSeasonEpisodes(tmdbId, sNum);
        const prev = eps.find(e => e.episode_number === eNum - 1);
        await storage.saveContinueWatching(tmdbId, {
          seasonNumber: sNum, episodeNumber: eNum - 1,
          episodeTitle: prev?.name || `Episodio ${eNum - 1}`,
          contentType: 'tv', timestamp: Date.now(), watchTime: 0,
        });
        navigate(`/player/tv/${tmdbId}/${sNum}/${eNum - 1}`);
      } else if (sNum > 1) {
        const prevEps = await getSeasonEpisodes(tmdbId, sNum - 1);
        if (prevEps.length > 0) {
          const last = prevEps[prevEps.length - 1];
          await storage.saveContinueWatching(tmdbId, {
            seasonNumber: sNum - 1, episodeNumber: last.episode_number,
            episodeTitle: last.name, timestamp: Date.now(), watchTime: 0,
          });
          navigate(`/player/tv/${tmdbId}/${sNum - 1}/${last.episode_number}`);
        }
      }
    } catch { /**/ }
  };

  const goToNextEpisode = async () => {
    const epKey = `S${season}E${episode}`;
    const watched = await storage.getWatchedEpisodes(tmdbId) || [];
    if (!watched.includes(epKey)) {
      await storage.saveWatchedEpisodes(tmdbId, [...watched, epKey]);
    }
    const sNum = parseInt(season);
    const eNum = parseInt(episode);
    try {
      const eps = await getSeasonEpisodes(tmdbId, sNum);
      if (eNum < eps.length) {
        const next = eps.find(e => e.episode_number === eNum + 1);
        await storage.saveContinueWatching(tmdbId, {
          seasonNumber: sNum, episodeNumber: eNum + 1,
          episodeTitle: next?.name || `Episodio ${eNum + 1}`,
          contentType: 'tv', timestamp: Date.now(), watchTime: 0,
        });
        navigate(`/player/tv/${tmdbId}/${sNum}/${eNum + 1}`);
      } else {
        const details = await getTVDetails(tmdbId);
        if (sNum < details.number_of_seasons) {
          const nextEps = await getSeasonEpisodes(tmdbId, sNum + 1);
          if (nextEps.length > 0) {
            const first = nextEps[0];
            await storage.saveContinueWatching(tmdbId, {
              seasonNumber: sNum + 1, episodeNumber: 1,
              episodeTitle: first.name, timestamp: Date.now(), watchTime: 0,
            });
            navigate(`/player/tv/${tmdbId}/${sNum + 1}/1`);
          }
        }
      }
    } catch { /**/ }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="player-wrapper">

      {/* TOP BAR */}
      <div className="player-top-bar">
        <button className="player-back-btn" onClick={goBackToEpisodes}>
          <ChevronLeft size={22} />
          <span>Indietro</span>
        </button>

        <div className="player-divider" />

        <div className="player-title-block">
          {type === 'tv' && seriesTitle && (
            <span className="player-series-name">{seriesTitle}</span>
          )}
          {type === 'tv' && seriesTitle && <span className="player-series-name">·</span>}
          {type === 'tv' && (
            <span className="player-ep-tag">S{season} · E{episode}</span>
          )}
          <span className="player-ep-title">
            {type === 'tv' ? currentEpisodeTitle : title}
          </span>
        </div>

        {type === 'tv' && (
          <div className="player-episode-nav">
            <button
              className="player-nav-btn"
              onClick={goToPreviousEpisode}
              disabled={!hasPrevEpisode}
              title="Episodio precedente (←)"
            >
              <SkipBack size={18} />
              <span>Precedente</span>
            </button>
            <button
              className="player-nav-btn"
              onClick={goToNextEpisode}
              disabled={!hasNextEpisode}
              title="Episodio successivo (→)"
            >
              <span>Successivo</span>
              <SkipForward size={18} />
            </button>
          </div>
        )}
      </div>

      {/* IFRAME — prende tutto il resto della finestra */}
      <iframe
        src={getVixSrcUrl()}
        className="player-iframe"
        frameBorder="0"
        allowFullScreen
        title={title}
        onLoad={() => setPlayerLoading(false)}
      />

      {/* Loading overlay */}
      {playerLoading && (
        <div className="player-loading-overlay">
          <div className="player-loading-spinner" />
          <p className="player-loading-text">Caricamento player...</p>
        </div>
      )}
    </div>
  );
}

export default VixSrcPlayer;
