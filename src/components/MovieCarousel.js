import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../services/tmdbApi';
import SmartImage from './SmartImage';
import UpcomingBadge from './UpcomingBadge';
import './MovieCarousel.css';
import './SmartImage.css';
import './PlaceholderImage.css';
import storage from '../services/storage';
import { Play, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
function MovieCarousel({ title, items, type = 'movie', onFavoritesChange, icon: Icon }) {
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [localFavorites, setLocalFavorites] = useState([]);
  const [pulsingId, setPulsingId] = useState(null);

  // Precompute type map once per items change — O(1) lookup during render
  const computedItemTypes = useMemo(() => {
    if (type !== 'mixed') return null;
    const map = new Map();
    items.forEach(item => {
      let t;
      if      (item.media_type)                                                          t = item.media_type === 'movie' ? 'movie' : 'tv';
      else if (item.type)                                                                t = item.type;
      else if (item.name && item.first_air_date && !(item.title && item.release_date))  t = 'tv';
      else if (item.title && item.release_date && !(item.name && item.first_air_date))  t = 'movie';
      else                                                                               t = item.title ? 'movie' : 'tv';
      map.set(item.id, t);
    });
    return map;
  }, [items, type]);

  useEffect(() => {
    // Caricamento iniziale
    storage.getFavorites().then(setLocalFavorites);

    const handleFavoritesChange = (event) => {
      // Usa i dati già presenti nell'evento, senza ri-fetchare dallo storage
      if (event.detail?.favorites) {
        setLocalFavorites(event.detail.favorites);
      }
    };

    window.addEventListener('favoritesChanged', handleFavoritesChange);
    return () => window.removeEventListener('favoritesChanged', handleFavoritesChange);
  }, []);

  const checkScrollButtons = () => {
    const carousel = carouselRef.current;
    if (carousel) {
      setCanScrollLeft(carousel.scrollLeft > 0);
      setCanScrollRight(
        carousel.scrollLeft < carousel.scrollWidth - carousel.clientWidth
      );
    }
  };

  const scrollLeft = () => {
    const carousel = carouselRef.current;
    if (carousel) {
      carousel.scrollBy({ left: -300, behavior: 'smooth' });
      setTimeout(checkScrollButtons, 300);
    }
  };

  const scrollRight = () => {
    const carousel = carouselRef.current;
    if (carousel) {
      carousel.scrollBy({ left: 300, behavior: 'smooth' });
      setTimeout(checkScrollButtons, 300);
    }
  };

  const determineItemType = useCallback((item) => {
    if (type !== 'mixed') return type;
    return computedItemTypes?.get(item.id) ?? (item.title ? 'movie' : 'tv');
  }, [type, computedItemTypes]);

  const handleItemClick = (item) => {
    const itemType = determineItemType(item);
    if (itemType === 'tv') {
      navigate(`/tv/${item.id}`);
    } else {
      navigate(`/movie/${item.id}`);
    }
  };

  const handlePlayClick = (item, e) => {
    e.stopPropagation();
    const itemType = determineItemType(item);
    if (itemType === 'tv') {
      navigate(`/player/tv/${item.id}/1/1`);
    } else {
      navigate(`/player/movie/${item.id}`);
    }
  };

  const addToFavorites = async (item, e) => {
    e.stopPropagation();
    
    // Ottieni favoriti dal storage
    const favorites = await storage.getFavorites();
    
    // Usa la funzione migliorata per determinare il tipo
    const itemType = determineItemType(item);
    
    // Controlla se è già nei favoriti
    const isAlreadyFavorite = favorites.some(fav => fav.id === item.id && fav.type === itemType);
    
    let updatedFavorites;
    
    if (isAlreadyFavorite) {
      updatedFavorites = favorites.filter(fav => !(fav.id === item.id && fav.type === itemType));
    } else {
      updatedFavorites = [...favorites, { ...item, type: itemType }];
    }
    
    await storage.saveFavorites(updatedFavorites);
    setLocalFavorites(updatedFavorites);
    setPulsingId(item.id);
    setTimeout(() => setPulsingId(null), 500);
    
    // Notifica il parent component
    if (onFavoritesChange) {
      onFavoritesChange(updatedFavorites);
    }
    
    window.dispatchEvent(new CustomEvent('favoritesChanged', {
      detail: { favorites: updatedFavorites }
    }));
  };

  const isFavorite = (item) => {
    const itemType = determineItemType(item);
    return localFavorites.some(fav => fav.id === item.id && fav.type === itemType);
  };

  return (
    <div className="movie-carousel">
      <h2 className="carousel-title">
        {Icon && <Icon size={28} className="carousel-title-icon" />}
        {title}
      </h2>
      
      <div className="carousel-container">
        {canScrollLeft && (
          <button className="carousel-button left" onClick={scrollLeft} aria-label="Scorri a sinistra">
            <ChevronLeft size={28} />
          </button>
        )}
        
        <div 
          className="carousel-items"
          ref={carouselRef}
          onScroll={checkScrollButtons}
        >
          {items.map((item) => {
            const itemType      = determineItemType(item);
            const isItemFavorite = localFavorites.some(fav => fav.id === item.id && fav.type === itemType);

            return (
              <div 
                key={`${item.id}-${itemType}`}
                className="carousel-item"
                onClick={() => handleItemClick(item)}
              >
                <div className="item-image-container">
                  {/* 🎯 SMARTIMAGE CON FALLBACK AUTOMATICO */}
                  <SmartImage
                    src={getImageUrl(item.poster_path)}
                    alt={item.title || item.name}
                    title={item.title || item.name}
                    type="poster"
                    className="item-image"
                  />

                    {/* 🆕 BADGE IN ARRIVO */}
                  <UpcomingBadge 
                    releaseDate={item.release_date}
                    firstAirDate={item.first_air_date}
                  />
                  
                  <div className="item-overlay">
                    <div className="item-info">
                      <h3>{item.title || item.name}</h3>
                      <p className="item-rating">⭐ {item.vote_average?.toFixed(1) || 'N/A'}</p>
                      <p className="item-year">
                        {item.release_date || item.first_air_date 
                          ? new Date(item.release_date || item.first_air_date).getFullYear()
                          : 'N/A'
                        }
                      </p>
                      {type === 'mixed' && (
                        <p className="item-type">
                          {itemType === 'movie' ? '🎬 Film' : '📺 Serie TV'}
                        </p>
                      )}
                    </div>
                    
                    <div className="item-actions">
                      <button
                        className="play-button"
                        onClick={(e) => handlePlayClick(item, e)}
                        aria-label="Riproduci"
                      >
                        <Play size={18} fill="currentColor" />
                      </button>

                      <button
                        className={`favorite-button ${isItemFavorite ? 'active' : ''} ${pulsingId === item.id ? 'heart-pulse' : ''}`}
                        onClick={(e) => addToFavorites(item, e)}
                        title={isItemFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                        aria-label={isItemFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                      >
                        <Heart size={16} fill={isItemFavorite ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {canScrollRight && (
          <button className="carousel-button right" onClick={scrollRight} aria-label="Scorri a destra">
            <ChevronRight size={28} />
          </button>
        )}
      </div>
    </div>
  );
}

export default MovieCarousel;