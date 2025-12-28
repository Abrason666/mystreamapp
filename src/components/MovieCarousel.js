import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../services/tmdbApi';
import SmartImage from './SmartImage';
import UpcomingBadge from './UpcomingBadge';
import './MovieCarousel.css';
import './SmartImage.css';
import './PlaceholderImage.css';
import storage from '../services/storage';

function MovieCarousel({ title, items, type = 'movie', onFavoritesChange }) {
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [localFavorites, setLocalFavorites] = useState([]);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Carica i favoriti localmente per aggiornamenti real-time
  useEffect(() => {
    const loadFavorites = async () => {
      const favorites = await storage.getFavorites();
      setLocalFavorites(favorites);
      setForceUpdate(prev => prev + 1);
    };
    
    loadFavorites();
    
    // Ascolta cambiamenti nei favoriti da TUTTI i componenti
    const handleFavoritesChange = (event) => {
      console.log('🔄 Aggiornamento favoriti ricevuto nel carousel:', title);
      loadFavorites();
    };
    
    const handleStorageChange = () => loadFavorites();
    
    window.addEventListener('favoritesChanged', handleFavoritesChange);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('favoritesChanged', handleFavoritesChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [title]);

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

  /**
   * 🔧 FUNZIONE MIGLIORATA PER DETERMINARE IL TIPO DI CONTENUTO
   * 
   * Questa funzione determina se un contenuto è un film o una serie TV.
   * Utilizza diversi metodi in ordine di affidabilità:
   * 
   * 1. Se il carousel ha un tipo specifico (non 'mixed'), usa quello
   * 2. Se l'item ha il campo 'media_type' da TMDB, usa quello (più affidabile!)
   * 3. Se l'item ha il campo 'type' già impostato, usa quello
   * 4. Come fallback, controlla la presenza di campi specifici:
   *    - 'name' + 'first_air_date' → Serie TV
   *    - 'title' + 'release_date' → Film
   */
  const determineItemType = (item) => {
    // Se il carousel ha un tipo non-mixed, usa quello
    if (type !== 'mixed') {
      return type;
    }
    
    // 🎯 PRIMO: Controlla il campo media_type di TMDB (il più affidabile!)
    if (item.media_type) {
      console.log(`📍 Tipo da media_type: ${item.media_type} per "${item.title || item.name}"`);
      return item.media_type === 'movie' ? 'movie' : 'tv';
    }
    
    // SECONDO: Controlla se ha già un campo 'type'
    if (item.type) {
      console.log(`📍 Tipo da item.type: ${item.type} per "${item.title || item.name}"`);
      return item.type;
    }
    
    // 🎯 TERZO: Usa una logica più robusta basata sui campi specifici
    // Serie TV hanno 'name' e 'first_air_date'
    // Film hanno 'title' e 'release_date'
    const hasSeriesFields = item.name && item.first_air_date;
    const hasMovieFields = item.title && item.release_date;
    
    if (hasSeriesFields && !hasMovieFields) {
      console.log(`📍 Rilevata Serie TV (name+first_air_date): "${item.name}"`);
      return 'tv';
    }
    
    if (hasMovieFields && !hasSeriesFields) {
      console.log(`📍 Rilevato Film (title+release_date): "${item.title}"`);
      return 'movie';
    }
    
    // ULTIMO FALLBACK: usa il vecchio metodo (meno affidabile)
    const fallbackType = item.title ? 'movie' : 'tv';
    console.warn(`⚠️ Fallback usato per "${item.title || item.name}": ${fallbackType}`);
    return fallbackType;
  };

  const handleItemClick = (item) => {
    // Usa la nuova funzione migliorata
    const itemType = determineItemType(item);
    
    console.log(`🎬 Click su: "${item.title || item.name}" | ID: ${item.id} | Tipo: ${itemType}`);
    
    // Naviga alla pagina corretta
    if (itemType === 'tv') {
      navigate(`/tv/${item.id}`);
    } else {
      navigate(`/movie/${item.id}`);
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
      // Rimuovi dai favoriti
      updatedFavorites = favorites.filter(fav => !(fav.id === item.id && fav.type === itemType));
      console.log('💔 Rimosso dai favoriti:', item.title || item.name);
    } else {
      // Aggiungi ai favoriti
      const favoriteItem = { ...item, type: itemType };
      updatedFavorites = [...favorites, favoriteItem];
      console.log('❤️ Aggiunto ai favoriti:', item.title || item.name);
    }
    
    // Salva e aggiorna stato locale
    await storage.saveFavorites(updatedFavorites);
    setLocalFavorites(updatedFavorites);
    
    // Notifica il parent component
    if (onFavoritesChange) {
      onFavoritesChange(updatedFavorites);
    }
    
    // Trigger evento personalizzato per aggiornare TUTTI gli altri componenti
    window.dispatchEvent(new CustomEvent('favoritesChanged', { 
      detail: { 
        favorites: updatedFavorites,
        action: isAlreadyFavorite ? 'removed' : 'added',
        item: item,
        timestamp: Date.now()
      } 
    }));
    
    // Force re-render di questo componente
    setForceUpdate(prev => prev + 1);
  };

  const isFavorite = (item) => {
    // Usa la funzione migliorata
    const itemType = determineItemType(item);
    
    const result = localFavorites.some(fav => fav.id === item.id && fav.type === itemType);
    return result;
  };

  return (
    <div className="movie-carousel">
      <h2 className="carousel-title">{title}</h2>
      
      <div className="carousel-container">
        {canScrollLeft && (
          <button 
            className="carousel-button left"
            onClick={scrollLeft}
          >
            ‹
          </button>
        )}
        
        <div 
          className="carousel-items"
          ref={carouselRef}
          onScroll={checkScrollButtons}
        >
          {items.map((item) => {
            const isItemFavorite = isFavorite(item);
            const itemType = determineItemType(item); // Per il badge "Film" o "Serie TV"
            
            return (
              <div 
                key={`${item.id}-${itemType}-${forceUpdate}`}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item);
                        }}
                      >
                        ▶️
                      </button>
                      
                      <button 
                        className={`favorite-button ${isItemFavorite ? 'active' : ''}`}
                        onClick={(e) => addToFavorites(item, e)}
                        title={isItemFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                      >
                        {isItemFavorite ? '🧡' : '🤍'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {canScrollRight && (
          <button 
            className="carousel-button right"
            onClick={scrollRight}
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}

export default MovieCarousel;