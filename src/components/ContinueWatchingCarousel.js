import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTVDetails, getMovieDetails, getImageUrl } from '../services/tmdbApi';
import SmartImage from './SmartImage';
import { SkeletonCarousel } from './Skeleton';
import storage from '../services/storage';
import { Play, ChevronLeft, ChevronRight, X, Heart, Info, Clock } from 'lucide-react';
import './ContinueWatchingCarousel.css';

function ContinueWatchingCarousel() {
  const navigate    = useNavigate();
  const carouselRef = useRef(null);

  const [items, setItems]                   = useState([]);
  const [localFavorites, setLocalFavorites] = useState([]);
  const [pulsingId, setPulsingId]           = useState(null);
  const [loading, setLoading]               = useState(true);
  const [canScrollLeft, setCanScrollLeft]   = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    load();
    storage.getFavorites().then(setLocalFavorites);

    const onFavChange = (e) => {
      if (e.detail?.favorites) setLocalFavorites(e.detail.favorites);
    };
    window.addEventListener('favoritesChanged', onFavChange);
    return () => window.removeEventListener('favoritesChanged', onFavChange);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const entries = await storage.getAllContinueWatching();
      if (!entries.length) { setLoading(false); return; }

      const enriched = await Promise.all(
        entries.map(async (entry) => {
          try {
            const details = entry.contentType === 'movie'
              ? await getMovieDetails(entry.tmdbId)
              : await getTVDetails(entry.tmdbId);
            if (!details) return null;
            return { ...entry, details };
          } catch { return null; }
        })
      );
      setItems(enriched.filter(Boolean));
    } catch { /* silently fail */ }
    setLoading(false);
  };

  const checkScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || !items.length) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, [items]);

  const scroll = (dir) => carouselRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });

  const isMovie = (item) => item.contentType === 'movie';

  const goToDetail = (item) => navigate(isMovie(item) ? `/movie/${item.tmdbId}` : `/tv/${item.tmdbId}`);

  const goToPlayer = (item, e) => {
    e.stopPropagation();
    navigate(isMovie(item)
      ? `/player/movie/${item.tmdbId}`
      : `/player/tv/${item.tmdbId}/${item.seasonNumber}/${item.episodeNumber}`
    );
  };

  const remove = async (tmdbId, e) => {
    e.stopPropagation();
    await storage.saveContinueWatching(tmdbId, null);
    setItems(prev => prev.filter(i => i.tmdbId !== tmdbId));
  };

  const isFav = (item) => {
    const type = isMovie(item) ? 'movie' : 'tv';
    return localFavorites.some(f => f.id === parseInt(item.tmdbId) && f.type === type);
  };

  const toggleFav = async (item, e) => {
    e.stopPropagation();
    const type = isMovie(item) ? 'movie' : 'tv';
    const favorites = await storage.getFavorites();
    const id = parseInt(item.tmdbId);
    const already = favorites.some(f => f.id === id && f.type === type);
    const updated = already
      ? favorites.filter(f => !(f.id === id && f.type === type))
      : [...favorites, { ...item.details, id, type }];
    await storage.saveFavorites(updated);
    setLocalFavorites(updated);
    setPulsingId(item.tmdbId);
    setTimeout(() => setPulsingId(null), 500);
    window.dispatchEvent(new CustomEvent('favoritesChanged', { detail: { favorites: updated } }));
  };

  // Skeleton mentre carica (evita layout shift)
  if (loading) return <SkeletonCarousel />;

  // Nessun item → non rendere nulla
  if (!items.length) return null;

  return (
    <div className="cw-carousel">
      <h2 className="cw-title">
        <Clock size={28} className="cw-title-icon" />
        Continua a guardare
      </h2>

      <div className="cw-wrapper">
        {canScrollLeft && (
          <button className="cw-arrow left" onClick={() => scroll(-1)} aria-label="Scorri sinistra">
            <ChevronLeft size={26} />
          </button>
        )}

        <div className="cw-track" ref={carouselRef}>
          {items.map(item => (
            <div key={item.tmdbId} className="cw-card" onClick={(e) => goToPlayer(item, e)}>
              <div className="cw-poster-wrap">
                <SmartImage
                  src={getImageUrl(item.details.poster_path)}
                  alt={item.details.name}
                  title={item.details.name}
                  type="poster"
                  className="cw-poster"
                />

                {/* Overlay hover */}
                <div className="cw-play-overlay">
                  {/* Play grande al centro */}
                  <div className="cw-play-circle">
                    <Play size={28} fill="currentColor" />
                  </div>
                  {/* Info + Heart in basso */}
                  <div className="cw-overlay-actions">
                    <button className="cw-action-btn" onClick={(e) => { e.stopPropagation(); goToDetail(item); }} aria-label="Vai ai dettagli">
                      <Info size={15} />
                    </button>
                    <button className={`cw-action-btn ${isFav(item) ? 'fav-active' : ''} ${pulsingId === item.tmdbId ? 'heart-pulse' : ''}`} onClick={(e) => toggleFav(item, e)} aria-label={isFav(item) ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}>
                      <Heart size={15} fill={isFav(item) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>

                {/* Rimuovi dalla lista */}
                <button className="cw-remove-btn" onClick={(e) => remove(item.tmdbId, e)} aria-label="Rimuovi dalla lista">
                  <X size={16} />
                </button>
              </div>

              <div className="cw-info">
                <p className="cw-series-name">
                  {isMovie(item) ? item.details.title : item.details.name}
                </p>
                {!isMovie(item) && (
                  <>
                    <p className="cw-episode-tag">S{item.seasonNumber} · E{item.episodeNumber}</p>
                    {item.episodeTitle && (
                      <p className="cw-episode-title">{item.episodeTitle}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {canScrollRight && (
          <button className="cw-arrow right" onClick={() => scroll(1)} aria-label="Scorri destra">
            <ChevronRight size={26} />
          </button>
        )}
      </div>
    </div>
  );
}

export default ContinueWatchingCarousel;
