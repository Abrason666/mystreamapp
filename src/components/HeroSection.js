import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getTrendingAll, getBackdropUrl,
  getMovieVideos, getTVVideos,
} from '../services/tmdbApi';
import UpcomingBadge from './UpcomingBadge';
import { SkeletonHero } from './Skeleton';
import storage from '../services/storage';
import { Info, Play, Heart, ChevronLeft, ChevronRight, Volume2, VolumeX, Pause } from 'lucide-react';
import { Star } from 'lucide-react';
import './HeroSection.css';

const SLIDE_DURATION   = 16000; // ~4.5s hidden + ~11.5s visibile
const TRAILER_FADE_OUT = 1000;  // durata fade-out prima di swappare l'iframe
const TRAILER_FADE_IN  = 4500;  // delay prima che il nuovo trailer diventi visibile
const MAX_PAUSE        = 30000; // pausa massima: dopo 30s riprende da solo

function HeroSection() {
  const navigate = useNavigate();

  const [heroItems, setHeroItems]         = useState([]);
  const [currentIndex, setCurrentIndex]   = useState(0);
  const [loading, setLoading]             = useState(true);
  const [favoriteStates, setFavoriteStates] = useState({});
  const [pulsingFav, setPulsingFav]         = useState(false);
  const [isPaused, setIsPaused]           = useState(false);

  // Cross-fade: due layer di background
  const [layers, setLayers] = useState([
    { url: '', opacity: 1 },
    { url: '', opacity: 0 },
  ]);
  const frontRef = useRef(0); // indice del layer attualmente visibile

  // Trailer
  const [trailerKey, setTrailerKey]       = useState(null);
  const [showTrailer, setShowTrailer]     = useState(false);
  const [trailerVisible, setTrailerVisible] = useState(false); // opacity controllata via JS
  const [isMuted, setIsMuted]             = useState(true);
  const iframeRef      = useRef(null);
  const trailerTimer   = useRef(null);
  const maxPauseTimer  = useRef(null);

  // Pulizia timer su unmount
  useEffect(() => () => {
    clearTimeout(trailerTimer.current);
    clearTimeout(maxPauseTimer.current);
  }, []);

  // (indicatorKey rimosso — usiamo dot semplici invece di barre animate)

  // ── HELPERS ──────────────────────────────────────────────────────────────────
  const getItemType  = (item) => item.media_type === 'movie' ? 'movie' : 'tv';
  const getItemTitle = (item) => item.title || item.name || '';
  const getItemDate  = (item) => item.release_date || item.first_air_date;

  // ── CROSS-FADE BACKGROUND ─────────────────────────────────────────────────
  const changeBg = useCallback((newUrl) => {
    const next = frontRef.current === 0 ? 1 : 0;
    const curr = frontRef.current;

    // Prepara il layer nascosto con la nuova immagine
    setLayers(prev => {
      const updated = [...prev];
      updated[next] = { url: newUrl, opacity: 0 };
      return updated;
    });

    // Un frame dopo, avvia il cross-fade
    setTimeout(() => {
      setLayers(prev => {
        const updated = [...prev];
        updated[next] = { url: newUrl, opacity: 1 };
        updated[curr] = { ...prev[curr], opacity: 0 };
        return updated;
      });
      frontRef.current = next;
    }, 50);
  }, []);

  // ── TRAILER ───────────────────────────────────────────────────────────────
  const loadTrailer = useCallback((item) => {
    clearTimeout(trailerTimer.current);

    // Fade-out del trailer corrente (la CSS transition lo gestisce in 0.9s)
    setTrailerVisible(false);

    // Dopo il fade-out, smonta il vecchio iframe e carica il nuovo trailer
    trailerTimer.current = setTimeout(() => {
      setShowTrailer(false);
      setTrailerKey(null);

      (async () => {
        try {
          const type = getItemType(item);
          const data = type === 'movie'
            ? await getMovieVideos(item.id)
            : await getTVVideos(item.id);
          const trailer = data.results?.find(
            v => v.type === 'Trailer' && v.site === 'YouTube'
          );
          if (trailer) {
            setTrailerKey(trailer.key);
            setShowTrailer(true);
            trailerTimer.current = setTimeout(() => setTrailerVisible(true), TRAILER_FADE_IN);
          }
        } catch { /* nessun trailer, rimane il backdrop */ }
      })();
    }, TRAILER_FADE_OUT);
  }, []);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: next ? 'mute' : 'unMute', args: [] }), '*'
    );
    if (!next) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'setVolume', args: [80] }), '*'
      );
    }
  };

  const togglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    clearTimeout(maxPauseTimer.current);
    if (next) {
      // Auto-riprende dopo MAX_PAUSE secondi al massimo
      maxPauseTimer.current = setTimeout(() => setIsPaused(false), MAX_PAUSE);
    }
  };

  // ── CARICAMENTO INIZIALE ──────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const all = await getTrendingAll();
        if (!isMounted) return;

        const items = all.slice(0, 8).map(i => ({
          ...i,
          media_type: i.media_type || 'movie',
        }));
        setHeroItems(items);

        if (items.length) {
          changeBg(getBackdropUrl(items[0].backdrop_path));
          loadTrailer(items[0]);
        }

        const favs = await storage.getFavorites();
        if (!isMounted) return;
        const states = {};
        favs.forEach(f => { states[`${f.type}_${f.id}`] = true; });
        setFavoriteStates(states);
      } catch {}
      if (isMounted) setLoading(false);
    };
    load();
    return () => { isMounted = false; };
  }, [changeBg, loadTrailer]);

  // ── AUTO-SLIDE ────────────────────────────────────────────────────────────
  // setTimeout invece di setInterval: ogni cambio slide (manuale o auto) fa ripartire il timer da zero
  useEffect(() => {
    if (isPaused || !heroItems.length) return;
    const id = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % heroItems.length);
    }, SLIDE_DURATION);
    return () => clearTimeout(id);
  }, [currentIndex, heroItems.length, isPaused]);

  // ── CAMBIA SLIDE ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!heroItems.length) return;
    const item = heroItems[currentIndex];
    changeBg(getBackdropUrl(item.backdrop_path));
    loadTrailer(item);
    setIsMuted(true); // rimuta al cambio slide
  }, [currentIndex, heroItems, changeBg, loadTrailer]);

  // ── NAVIGAZIONE MANUALE ───────────────────────────────────────────────────
  const goTo = (idx) => {
    setCurrentIndex((idx + heroItems.length) % heroItems.length);
    clearTimeout(maxPauseTimer.current);
    setIsPaused(false);
  };

  // ── AZIONI ───────────────────────────────────────────────────────────────
  const playItem = (item) => {
    const type = getItemType(item);
    navigate(type === 'movie'
      ? `/player/movie/${item.id}`
      : `/player/tv/${item.id}/1/1`);
  };

  const goToDetails = (item) => {
    const type = getItemType(item);
    navigate(type === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`);
  };

  const toggleFavorites = async (item) => {
    const type = getItemType(item);
    const favs = await storage.getFavorites();
    const isFav = favs.some(f => f.id === item.id && f.type === type);
    const updated = isFav
      ? favs.filter(f => !(f.id === item.id && f.type === type))
      : [...favs, { ...item, type }];
    await storage.saveFavorites(updated);
    setFavoriteStates(prev => ({ ...prev, [`${type}_${item.id}`]: !isFav }));
    setPulsingFav(true);
    setTimeout(() => setPulsingFav(false), 500);
    window.dispatchEvent(new CustomEvent('favoritesChanged', { detail: { favorites: updated } }));
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (loading) return <SkeletonHero />;
  if (!heroItems.length) return null;

  const item      = heroItems[currentIndex];
  const itemType  = getItemType(item);
  const itemTitle = getItemTitle(item);
  const itemDate  = getItemDate(item);
  const isFav     = favoriteStates[`${itemType}_${item.id}`] || false;

  const trailerSrc = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerKey}&enablejsapi=1&modestbranding=1&rel=0&iv_load_policy=3`
    : null;

  return (
    <div className="hero-root">

      {/* ── BACKGROUND LAYERS (cross-fade) ── */}
      {layers.map((layer, i) => (
        <div
          key={i}
          className="hero-bg-layer"
          style={{
            backgroundImage: layer.url ? `url(${layer.url})` : 'none',
            opacity: layer.opacity,
          }}
        />
      ))}

      {/* ── TRAILER IFRAME ── */}
      {showTrailer && trailerSrc && (
        <div className={`hero-trailer-wrap${trailerVisible ? ' visible' : ''}`}>
          <iframe
            ref={iframeRef}
            src={trailerSrc}
            className="hero-trailer-iframe"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            title="trailer"
          />
          {/* Maschera trasparente: blocca i mouse-event verso l'iframe così YouTube non mostra i suoi controlli al hover */}
          <div className="hero-trailer-mask" />
        </div>
      )}

      {/* ── GRADIENTE OVERLAY ── */}
      <div className="hero-overlay" />

      {/* ── FRECCIA SINISTRA ── */}
      <button
        className="hero-arrow left"
        onClick={() => goTo(currentIndex - 1)}
        aria-label="Precedente"
      >
        <ChevronLeft size={32} />
      </button>

      {/* ── CONTENUTO ── */}
      <div className="hero-content">
        <h1 className="hero-title">{itemTitle}</h1>

        <UpcomingBadge releaseDate={itemDate} />

        <div className="hero-meta">
          <span className="hero-type-badge">
            {itemType === 'movie' ? 'Film' : 'Serie TV'}
          </span>
          <span className="hero-rating">
            <Star size={14} fill="currentColor" style={{ color: '#feca57' }} />
            {item.vote_average?.toFixed(1)}
          </span>
          {itemDate && (
            <span className="hero-year">{new Date(itemDate).getFullYear()}</span>
          )}
        </div>

        <p className="hero-overview">{item.overview}</p>

        <div className="hero-actions">
          <button className="hero-btn-play" onClick={() => playItem(item)}>
            <Play size={20} fill="currentColor" />
            Riproduci
          </button>
          <button className="hero-btn-info" onClick={() => goToDetails(item)}>
            <Info size={18} />
            Dettagli
          </button>
          <button
            className={`hero-btn-fav ${isFav ? 'active' : ''} ${pulsingFav ? 'heart-pulse' : ''}`}
            onClick={() => toggleFavorites(item)}
            aria-label={isFav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          >
            <Heart size={20} fill={isFav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* ── FRECCIA DESTRA ── */}
      <button
        className="hero-arrow right"
        onClick={() => goTo(currentIndex + 1)}
        aria-label="Successivo"
      >
        <ChevronRight size={32} />
      </button>

      {/* ── BOTTOM BAR ── */}
      <div className="hero-bottom">
        {/* Indicatori a puntino */}
        <div className="hero-indicators">
          {heroItems.map((_, i) => (
            <button
              key={i}
              className={`hero-indicator${i === currentIndex ? ' active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Vai a ${i + 1}`}
            />
          ))}
        </div>

        {/* Audio + Pausa */}
        <div className="hero-controls">
          {showTrailer && trailerVisible && (
            <button className="hero-ctrl-btn" onClick={toggleMute} aria-label="Audio">
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}
          <button className="hero-ctrl-btn" onClick={togglePause} aria-label={isPaused ? 'Riprendi' : 'Pausa'}>
            {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} />}
          </button>
        </div>
      </div>

    </div>
  );
}

export default HeroSection;
