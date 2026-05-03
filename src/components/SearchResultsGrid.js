import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../services/tmdbApi';
import SmartImage from './SmartImage';
import UpcomingBadge from './UpcomingBadge';
import storage from '../services/storage';
import { Play, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import './SearchResultsGrid.css';

function SearchResultsGrid({ items, query, hasMore, onLoadMore, loadingMore }) {
  const navigate        = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const sentinelRef     = useRef(null);

  useEffect(() => {
    storage.getFavorites().then(setFavorites);
    const onFavChange = (e) => {
      if (e.detail?.favorites) setFavorites(e.detail.favorites);
    };
    window.addEventListener('favoritesChanged', onFavChange);
    return () => window.removeEventListener('favoritesChanged', onFavChange);
  }, []);

  // Sentinel per infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !onLoadMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore && !loadingMore) onLoadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, loadingMore]);

  const handleItemClick = (item) => {
    navigate(item.type === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`);
  };

  const toggleFavorite = async (item, e) => {
    e.stopPropagation();
    const current  = await storage.getFavorites();
    const already  = current.some(f => f.id === item.id && f.type === item.type);
    const updated  = already
      ? current.filter(f => !(f.id === item.id && f.type === item.type))
      : [...current, item];
    await storage.saveFavorites(updated);
    toast(already ? 'Rimosso dai preferiti' : 'Aggiunto ai preferiti',
      { icon: already ? '💔' : '🧡' });
    setFavorites(updated);
    window.dispatchEvent(new CustomEvent('favoritesChanged', { detail: { favorites: updated } }));
  };

  const isFav = (item) => favorites.some(f => f.id === item.id && f.type === item.type);

  if (!items.length) return null;

  return (
    <div className="search-results-grid-container">
      <div className="results-header">
        <h2>
          Risultati per "<span className="query-highlight">{query}</span>"
        </h2>
        <p className="results-info">{items.length} risultati caricati</p>
      </div>

      <div className="results-grid">
        {items.map(item => {
          const fav = isFav(item);
          return (
            <div
              key={`${item.type}-${item.id}`}
              className="grid-item"
              onClick={() => handleItemClick(item)}
            >
              <div className="grid-item-image-container">
                <SmartImage
                  src={getImageUrl(item.poster_path)}
                  alt={item.title || item.name}
                  title={item.title || item.name}
                  type="poster"
                  className="grid-item-image"
                />
                <UpcomingBadge
                  releaseDate={item.release_date}
                  firstAirDate={item.first_air_date}
                />
                <div className="grid-item-overlay">
                  <div className="grid-item-info">
                    <h3>{item.title || item.name}</h3>
                    <p className="grid-item-rating">⭐ {item.vote_average?.toFixed(1) || 'N/A'}</p>
                    <p className="grid-item-year">
                      {item.release_date || item.first_air_date
                        ? new Date(item.release_date || item.first_air_date).getFullYear()
                        : 'N/A'}
                    </p>
                    <p className="grid-item-type">
                      {item.type === 'movie' ? 'Film' : 'Serie TV'}
                    </p>
                  </div>
                  <div className="grid-item-actions">
                    <button
                      className="grid-action-btn"
                      onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                      aria-label="Vai ai dettagli"
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                    <button
                      className={`grid-action-btn ${fav ? 'grid-action-fav' : ''}`}
                      onClick={(e) => toggleFavorite(item, e)}
                      aria-label={fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                    >
                      <Heart size={16} fill={fav ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sentinel infinite scroll */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {loadingMore && (
        <div className="grid-loading-more">
          <div className="grid-spinner" />
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="grid-end-label">✓ Tutti i risultati caricati</p>
      )}
    </div>
  );
}

export default SearchResultsGrid;
