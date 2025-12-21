import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../services/tmdbApi';
import SmartImage from './SmartImage';
import UpcomingBadge from './UpcomingBadge';
import storage from '../services/storage';
import './SearchResultsGrid.css';

function SearchResultsGrid({ items, query }) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState([]);
  
  // 📊 CONFIGURAZIONE PAGINAZIONE
  const ITEMS_PER_PAGE = 30; // Regolabile in base alle preferenze
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  
  // Calcola indici per la pagina corrente
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = items.slice(startIndex, endIndex);

  // Carica favoriti
  useEffect(() => {
    loadFavorites();
    
    const handleFavoritesChange = () => loadFavorites();
    window.addEventListener('favoritesChanged', handleFavoritesChange);
    
    return () => window.removeEventListener('favoritesChanged', handleFavoritesChange);
  }, []);

  // Reset alla pagina 1 quando cambiano i risultati
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  const loadFavorites = async () => {
    const savedFavorites = await storage.getFavorites();
    setFavorites(savedFavorites);
  };

  const handleItemClick = (item) => {
    if (item.type === 'tv') {
      navigate(`/tv/${item.id}`);
    } else {
      navigate(`/movie/${item.id}`);
    }
  };

  const toggleFavorite = async (item, e) => {
    e.stopPropagation();
    
    const currentFavorites = await storage.getFavorites();
    const isAlreadyFavorite = currentFavorites.some(
      fav => fav.id === item.id && fav.type === item.type
    );
    
    let updatedFavorites;
    
    if (isAlreadyFavorite) {
      updatedFavorites = currentFavorites.filter(
        fav => !(fav.id === item.id && fav.type === item.type)
      );
    } else {
      updatedFavorites = [...currentFavorites, item];
    }
    
    await storage.saveFavorites(updatedFavorites);
    setFavorites(updatedFavorites);
    
    window.dispatchEvent(new CustomEvent('favoritesChanged', {
      detail: { favorites: updatedFavorites }
    }));
  };

  const isFavorite = (item) => {
    return favorites.some(fav => fav.id === item.id && fav.type === item.type);
  };

  const goToPage = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  // Genera array di numeri pagina da mostrare
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 7;
    
    if (totalPages <= maxPagesToShow) {
      // Mostra tutte le pagine
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Logica intelligente per mostrare pagine rilevanti
      if (currentPage <= 4) {
        // Siamo all'inizio
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Siamo alla fine
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        // Siamo nel mezzo
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="search-results-grid-container">
      {/* Header con info risultati */}
      <div className="results-header">
        <h2>
          Risultati per "<span className="query-highlight">{query}</span>"
        </h2>
        <p className="results-info">
          {items.length} risultati totali • Pagina {currentPage} di {totalPages}
        </p>
      </div>

      {/* Griglia risultati */}
      <div className="results-grid">
        {currentItems.map((item) => {
          const itemIsFavorite = isFavorite(item);
          
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
                {/* 🆕 BADGE IN ARRIVO */}
                    <UpcomingBadge 
                        releaseDate={item.release_date}
                        firstAirDate={item.first_air_date}
                    />
                
                <div className="grid-item-overlay">
                  <div className="grid-item-info">
                    <h3>{item.title || item.name}</h3>
                    <p className="grid-item-rating">
                      ⭐ {item.vote_average?.toFixed(1) || 'N/A'}
                    </p>
                    <p className="grid-item-year">
                      {item.release_date || item.first_air_date
                        ? new Date(item.release_date || item.first_air_date).getFullYear()
                        : 'N/A'}
                    </p>
                    <p className="grid-item-type">
                      {item.type === 'movie' ? '🎬 Film' : '📺 Serie TV'}
                    </p>
                  </div>
                  
                  <div className="grid-item-actions">
                    <button
                      className="grid-play-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick(item);
                      }}
                    >
                      ▶️
                    </button>
                    
                    <button
                      className={`grid-favorite-button ${itemIsFavorite ? 'active' : ''}`}
                      onClick={(e) => toggleFavorite(item, e)}
                      title={itemIsFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                    >
                      {itemIsFavorite ? '❤️' : '🤍'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controlli paginazione */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="pagination-btn pagination-arrow"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
          >
            ← Precedente
          </button>
          
          <div className="pagination-numbers">
            {getPageNumbers().map((page, index) => (
              page === '...' ? (
                <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  className={`pagination-btn pagination-number ${
                    currentPage === page ? 'active' : ''
                  }`}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              )
            ))}
          </div>
          
          <button
            className="pagination-btn pagination-arrow"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
          >
            Successiva →
          </button>
        </div>
      )}
    </div>
  );
}


export default SearchResultsGrid;