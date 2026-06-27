import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTVDetails, getSeasonEpisodes } from '../services/tmdbApi';
import './VixSrcPlayer.css';
import storage from '../services/storage';
import { ChevronLeft, SkipBack, SkipForward, VideoOff } from 'lucide-react';
import NativePlayer from './NativePlayer';
import { resolveStream } from '../services/vixsrcResolver';

function VixSrcPlayer({ tmdbId, type, season, episode, title }) {
  const navigate = useNavigate();

  const [hasNextEpisode, setHasNextEpisode]           = useState(false);
  const [hasPrevEpisode, setHasPrevEpisode]           = useState(false);
  const [watchStartTime, setWatchStartTime]           = useState(Date.now());
  const [currentEpisodeTitle, setCurrentEpisodeTitle] = useState('');
  const [seriesTitle, setSeriesTitle]                 = useState('');
  const [playerLoading, setPlayerLoading]             = useState(true);
  const [resumeTime, setResumeTime]                   = useState(0);

  // ── Player nativo vs iframe embedded (con fallback automatico) ──
  const [playerMode, setPlayerMode]     = useState('native');
  const [streamUrl, setStreamUrl]       = useState(null);
  const [resolveError, setResolveError] = useState(false);
  const [contentNotFound, setContentNotFound] = useState(false);
  const [retry, setRetry]               = useState(0);

  // Posizione/durata reali del video, riportate dal player nativo (null finché non
  // arriva almeno un aggiornamento in questa sessione — vedi saveContinueWatching).
  // In modalità iframe classico restano sempre null (nessuna lettura possibile).
  const currentTimeRef = useRef(null);
  const durationRef    = useRef(null);
  const handlePlayerTimeUpdate = useCallback((time, duration) => {
    currentTimeRef.current = time;
    durationRef.current = duration;
  }, []);

  // Posizione di resume già salvata per un dato episodio (mappa progresso per-show)
  const resumeForEpisode = useCallback(async (s, e) => {
    const progress = await storage.getEpisodeProgress(tmdbId);
    return progress?.[`S${s}E${e}`]?.time || 0;
  }, [tmdbId]);

  // Mirror di resumeTime/currentEpisodeTitle in ref: servono al resolve-effect
  // per scrivere il placeholder "in corso" con i dati giusti senza doverli
  // mettere nel suo dependency array (altrimenti ogni aggiornamento del titolo
  // farebbe ripartire la risoluzione dello stream da capo)
  const resumeTimeRef = useRef(0);
  const currentEpisodeTitleRef = useRef('');

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      // Le scorciatoie dell'app valgono solo quando è attivo l'IFRAME classico.
      // Nel player nativo i tasti (frecce=seek, ecc.) li gestisce Vidstack.
      const embeddedActive = playerMode === 'embedded' || resolveError;
      if (!embeddedActive) return;
      if (e.key === 'Escape')                        goBackToEpisodes();
      if (e.key === 'ArrowRight' && hasNextEpisode)  goToNextEpisode();
      if (e.key === 'ArrowLeft'  && hasPrevEpisode)  goToPreviousEpisode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNextEpisode, hasPrevEpisode, playerMode, resolveError]);

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

  const saveContinueWatching = useCallback(async () => {
    // Niente da salvare se il contenuto non è mai stato confermato esistente
    // (streamUrl ancora null): altrimenti contenuti non disponibili finirebbero
    // comunque in "continua a guardare" tramite il save periodico/di chiusura.
    // In modalità iframe classico non possiamo saperlo in anticipo, quindi lì
    // si salva come sempre.
    if (playerMode !== 'embedded' && !streamUrl) return;

    const watchTime = Math.floor((Date.now() - watchStartTime) / 1000);

    // Posizione esatta per il resume: quella riportata dal player nativo in questa
    // sessione; se non ne abbiamo ancora una (es. modalità iframe classico, dove
    // non possiamo leggere currentTime) teniamo quella già salvata, non la
    // azzeriamo mai per errore.
    const prev = await storage.getContinueWatching(tmdbId);
    const resume = currentTimeRef.current != null
      ? Math.floor(currentTimeRef.current)
      : (prev?.resumeTime || 0);

    if (type === 'movie') {
      storage.saveContinueWatching(tmdbId, {
        contentType: 'movie',
        watchTime,
        resumeTime:  resume,
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
      resumeTime:    resume,
      timestamp:     Date.now(),
      lastWatched:   new Date().toISOString(),
    });

    const duration = durationRef.current;
    if (duration) {
      // mappa progresso per-episodio (per la barra sulle miniature), valida per
      // qualunque episodio, anche quelli già visti in passato — è l'UNICA
      // segnalazione di "quanto ho visto", non esiste più uno stato "visto" binario
      storage.saveEpisodeProgress(tmdbId, season, episode, resume, duration);
    }
  }, [type, season, episode, watchStartTime, currentEpisodeTitle, tmdbId, playerMode, streamUrl]);

  // Solo per il titolo da mostrare (anche prima di sapere se il contenuto
  // esiste su vixsrc) — NON scrive più "continua a guardare": quello avviene
  // solo dopo che il resolver ha confermato che il contenuto esiste (vedi
  // l'effect di risoluzione più sotto), altrimenti episodi/film inesistenti
  // finirebbero comunque in "continua a guardare" prima di fallire.
  const loadEpisodeTitle = useCallback(async () => {
    try {
      const eps     = await getSeasonEpisodes(tmdbId, parseInt(season));
      const current = eps.find(ep => ep.episode_number === parseInt(episode));
      const epTitle = current?.name || `Episodio ${episode}`;
      setCurrentEpisodeTitle(epTitle);
      currentEpisodeTitleRef.current = epTitle;
    } catch {
      setCurrentEpisodeTitle(`Episodio ${episode}`);
      currentEpisodeTitleRef.current = `Episodio ${episode}`;
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
    let alive = true;
    setWatchStartTime(Date.now());
    currentTimeRef.current = null;

    (async () => {
      // Punto di resume: per le serie usiamo la mappa progresso PER-EPISODIO
      // (univoca, chiede esattamente "quanto ho visto di S{s}E{e}"). Non dipende
      // dal puntatore continueWatching — che potrebbe non essere ancora sincronizzato
      // con l'episodio appena aperto (es. click diretto su un episodio dalla lista,
      // dove il salvataggio del puntatore e la navigazione partono quasi insieme).
      // Per i film c'è un solo contenuto: continueWatching stesso basta.
      let resume = 0;
      if (type === 'tv' && season && episode) {
        resume = await resumeForEpisode(parseInt(season), parseInt(episode));
      } else if (type === 'movie') {
        const prevCont = await storage.getContinueWatching(tmdbId);
        if (prevCont?.contentType === 'movie') resume = prevCont.resumeTime || 0;
      }
      if (!alive) return;
      setResumeTime(resume);
      resumeTimeRef.current = resume;

      if (type === 'tv' && season && episode) {
        loadEpisodeTitle();
        loadEpisodeNavigation();
      }
      // Il placeholder "in corso" si scrive SOLO quando il resolver conferma
      // che il contenuto esiste (nel then() dell'effect di risoluzione più
      // sotto) — non qui, altrimenti un film/episodio inesistente finirebbe
      // comunque in "continua a guardare" prima ancora di scoprire che non c'è.
    })();

    return () => { alive = false; };
  }, [tmdbId, season, episode, type, loadEpisodeTitle, loadEpisodeNavigation, resumeForEpisode]);

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
  // Torna alla pagina principale del film/serie (non alla home né alla lista episodi).
  // saveContinueWatching è asincrona (deve leggere lo storage prima di scrivere):
  // bisogna ASPETTARLA prima di navigare, altrimenti la pagina di destinazione può
  // montare e leggere lo storage prima che il salvataggio (inclusa la barra di
  // progresso) sia completato.
  // Tutte le navigate() qui dentro (apertura, cambio episodio, uscita) usano
  // replace, non push: il player è uno stato "di passaggio" sopra la pagina del
  // film/serie — se ogni passaggio restasse nella cronologia, il tasto Indietro
  // dell'app (in alto a destra) potrebbe riproporre il player già chiuso invece
  // di tornare alla home/pagina precedente.
  const goBackToEpisodes = async () => {
    await saveContinueWatching();
    navigate(type === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`, { replace: true });
  };

  // Salva il progresso dell'episodio che si sta abbandonando (stessa
  // saveContinueWatching usata da goBackToEpisodes — no-op se il contenuto non
  // è mai stato confermato esistente, vedi guardia in saveContinueWatching)
  // PRIMA di navigare: altrimenti, cambiando episodio prima dei 30s del
  // salvataggio periodico, il tempo visto/la posizione per la barra di
  // avanzamento di quell'episodio non verrebbero mai scritti. Il placeholder
  // "in corso" del NUOVO episodio resta comunque compito del resolve-effect di
  // destinazione (si scrive solo se risulta davvero disponibile su vixsrc).
  const goToPreviousEpisode = async () => {
    await saveContinueWatching();
    const sNum = parseInt(season);
    const eNum = parseInt(episode);
    try {
      if (eNum > 1) {
        navigate(`/player/tv/${tmdbId}/${sNum}/${eNum - 1}`, { replace: true });
      } else if (sNum > 1) {
        const prevEps = await getSeasonEpisodes(tmdbId, sNum - 1);
        if (prevEps.length > 0) {
          navigate(`/player/tv/${tmdbId}/${sNum - 1}/${prevEps.length}`, { replace: true });
        }
      }
    } catch { /**/ }
  };

  const goToNextEpisode = async () => {
    await saveContinueWatching();
    const sNum = parseInt(season);
    const eNum = parseInt(episode);
    try {
      const eps = await getSeasonEpisodes(tmdbId, sNum);
      if (eNum < eps.length) {
        navigate(`/player/tv/${tmdbId}/${sNum}/${eNum + 1}`, { replace: true });
      } else {
        const details = await getTVDetails(tmdbId);
        if (sNum < details.number_of_seasons) {
          const nextEps = await getSeasonEpisodes(tmdbId, sNum + 1);
          if (nextEps.length > 0) {
            navigate(`/player/tv/${tmdbId}/${sNum + 1}/1`, { replace: true });
          }
        }
      }
    } catch { /**/ }
  };

  // Quando il contenuto finisce DAVVERO (non solo manualmente con i tasti
  // succ./prec.): se c'è un episodio successivo passa lì, altrimenti (film, o
  // ultimo episodio della serie) pulisce "continua a guardare" — non deve
  // restare bloccata vicino ai titoli di coda, riaprendo si riparte da capo.
  // Funzione semplice (non useCallback) come le altre di navigazione qui sopra:
  // evita di dover sincronizzare manualmente un dependency array con season/
  // episode, che ha già causato un bug di closure stantia in questo file.
  const handlePlaybackEnded = async () => {
    await saveContinueWatching();
    if (type === 'tv' && hasNextEpisode) {
      goToNextEpisode();
    } else {
      await storage.saveContinueWatching(tmdbId, null);
    }
  };

  // ── Risoluzione stream per il player nativo ───────────────────────────────
  // preferenza modalità (native/embedded) all'avvio
  useEffect(() => {
    let alive = true;
    storage.getPlayerMode().then((m) => {
      if (alive && (m === 'embedded' || m === 'native')) setPlayerMode(m);
    });
    return () => { alive = false; };
  }, []);

  // risolve l'URL .m3u8 quando cambia il contenuto (solo in modalità nativa)
  useEffect(() => {
    if (playerMode === 'embedded') return;
    let alive = true;
    setStreamUrl(null);
    setResolveError(false);
    setContentNotFound(false);
    const safety = setTimeout(() => { if (alive) setResolveError(true); }, 20000);
    resolveStream({ type, id: tmdbId, season, episode })
      .then((r) => {
        if (!alive) return;
        clearTimeout(safety);
        setStreamUrl(r.url);
        // Contenuto CONFERMATO esistente: solo ora scriviamo "in corso" — è
        // l'unico punto in cui questo placeholder viene creato, apposta per
        // non far finire in "continua a guardare" contenuti che poi falliscono.
        if (type === 'movie') {
          storage.saveContinueWatching(tmdbId, {
            contentType: 'movie', watchTime: 0, resumeTime: resumeTimeRef.current, timestamp: Date.now(),
          });
        } else if (type === 'tv' && season && episode) {
          storage.saveContinueWatching(tmdbId, {
            seasonNumber: parseInt(season), episodeNumber: parseInt(episode),
            episodeTitle: currentEpisodeTitleRef.current || `Episodio ${episode}`,
            contentType: 'tv', timestamp: Date.now(), watchTime: 0, resumeTime: resumeTimeRef.current,
          });
        }
      })
      .catch((e) => {
        if (!alive) return;
        clearTimeout(safety);
        if (e?.notFound) {
          // confermato assente su vixsrc: niente iframe (darebbe lo stesso 404),
          // mostriamo direttamente la schermata "non ancora disponibile"
          console.warn('Contenuto non trovato su vixsrc:', e?.message);
          setContentNotFound(true);
        } else {
          console.warn('Resolver vixsrc fallito → fallback iframe:', e?.message);
          setResolveError(true);
        }
      });
    return () => { alive = false; clearTimeout(safety); };
  }, [tmdbId, type, season, episode, playerMode, retry]);

  const switchToEmbedded = () => { setPlayerMode('embedded'); storage.savePlayerMode('embedded'); };
  const switchToNative   = () => {
    setResolveError(false);
    setContentNotFound(false);
    setRetry((n) => n + 1);
    setPlayerMode('native');
    storage.savePlayerMode('native');
  };

  // ── Contenuto confermato assente su vixsrc: niente iframe (darebbe lo stesso
  // 404), schermata in tema invece di lasciare l'utente davanti al 404 grezzo.
  // Solo in modalità nativa: se l'utente ha scelto manualmente "player
  // classico", rispettiamo la sua scelta e lasciamo vedere l'iframe.
  if (contentNotFound && playerMode !== 'embedded') {
    return (
      <div className="player-wrapper player-wrapper-notfound">
        <div className="player-notfound">
          <VideoOff size={56} className="player-notfound-icon" />
          <h2 className="player-notfound-title">Contenuto non ancora disponibile</h2>
          <p className="player-notfound-text">
            {type === 'tv' ? 'Questo episodio' : 'Questo film'} non si trova ancora nella libreria. Riprova più tardi.
          </p>
          <div className="player-notfound-actions">
            <button className="player-back-btn" onClick={goBackToEpisodes}>
              <ChevronLeft size={22} />
              <span>Indietro</span>
            </button>
            {type === 'tv' && (
              <>
                <button className="player-nav-btn" onClick={goToPreviousEpisode} disabled={!hasPrevEpisode}>
                  <SkipBack size={18} />
                  <span>Episodio precedente</span>
                </button>
                <button className="player-nav-btn" onClick={goToNextEpisode} disabled={!hasNextEpisode}>
                  <span>Episodio successivo</span>
                  <SkipForward size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Player NATIVO (con fallback automatico all'iframe in caso di errore) ───
  const useEmbedded = playerMode === 'embedded' || resolveError;
  if (!useEmbedded) {
    return (
      <div className="player-wrapper">
        {streamUrl ? (
          <NativePlayer
            src={streamUrl}
            title={type === 'tv' ? (seriesTitle || title) : title}
            epTag={type === 'tv' ? `S${season}·E${episode}` : ''}
            episodeTitle={type === 'tv' ? currentEpisodeTitle : ''}
            type={type}
            hasNext={hasNextEpisode}
            hasPrev={hasPrevEpisode}
            onBack={goBackToEpisodes}
            onNext={goToNextEpisode}
            onPrev={goToPreviousEpisode}
            onSwitchClassic={switchToEmbedded}
            startTime={resumeTime}
            onTimeUpdate={handlePlayerTimeUpdate}
            onEnded={handlePlaybackEnded}
          />
        ) : (
          <div className="player-loading-overlay">
            <button className="player-back-btn player-loading-back" onClick={goBackToEpisodes}>
              <ChevronLeft size={22} />
              <span>Indietro</span>
            </button>
            <div className="player-loading-spinner" />
            <p className="player-loading-text">Caricamento stream…</p>
          </div>
        )}
      </div>
    );
  }

  // ── Render EMBEDDED (iframe classico — ultima spiaggia / toggle) ───────────
  return (
    <div className="player-wrapper">

      {/* TOP BAR */}
      <div className="player-top-bar">
        <button className="player-back-btn" onClick={goBackToEpisodes}>
          <ChevronLeft size={22} />
          <span>Indietro</span>
        </button>

        <button className="player-nav-btn" onClick={switchToNative} title="Torna al player nuovo">
          Player nuovo
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
