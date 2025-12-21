import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { discoverByGenre } from '../services/tmdbApi';
import { getImageUrl } from '../services/tmdbApi';
import SmartImage from './SmartImage';
import storage from '../services/storage';
import './CategoriesComponent.css';

// 🎬 LISTA CATEGORIE FILM
const MOVIE_GENRES = [
  { id: 28, name: 'Azione', emoji: '💥' },
  { id: 12, name: 'Avventura', emoji: '🗺️' },
  { id: 16, name: 'Animazione', emoji: '🎨' },
  { id: 35, name: 'Commedia', emoji: '😂' },
  { id: 80, name: 'Crime', emoji: '🔫' },
  { id: 99, name: 'Documentario', emoji: '📽️' },
  { id: 18, name: 'Drammatico', emoji: '🎭' },
  { id: 10751, name: 'Famiglia', emoji: '👨‍👩‍👧‍👦' },
  { id: 14, name: 'Fantasy', emoji: '🧙' },
  { id: 36, name: 'Storico', emoji: '📜' },
  { id: 27, name: 'Horror', emoji: '👻' },
  { id: 10402, name: 'Musical', emoji: '🎵' },
  { id: 9648, name: 'Mistero', emoji: '🔍' },
  { id: 10749, name: 'Romantico', emoji: '❤️' },
  { id: 878, name: 'Fantascienza', emoji: '🚀' },
  { id: 10770, name: 'Film TV', emoji: '📺' },
  { id: 53, name: 'Thriller', emoji: '😱' },
  { id: 10752, name: 'Guerra', emoji: '⚔️' },
  { id: 37, name: 'Western', emoji: '🤠' },
];

// 📺 LISTA CATEGORIE SERIE TV
const TV_GENRES = [
  { id: 10759, name: 'Azione e Avventura', emoji: '⚡' },
  { id: 16, name: 'Animazione', emoji: '🎨' },
  { id: 35, name: 'Commedia', emoji: '😄' },
  { id: 80, name: 'Crime', emoji: '🕵️' },
  { id: 99, name: 'Documentario', emoji: '🎥' },
  { id: 18, name: 'Drammatico', emoji: '🎬' },
  { id: 10751, name: 'Famiglia', emoji: '👪' },
  { id: 10762, name: 'Bambini', emoji: '👶' },
  { id: 9648, name: 'Mistero', emoji: '🔎' },
  { id: 10763, name: 'News', emoji: '📰' },
  { id: 10764, name: 'Reality', emoji: '🎤' },
  { id: 10765, name: 'Sci-Fi & Fantasy', emoji: '🛸' },
  { id: 10766, name: 'Soap', emoji: '💔' },
  { id: 10767, name: 'Talk Show', emoji: '🗣️' },
  { id: 10768, name: 'Guerra & Politica', emoji: '🏛️' },
  { id: 37, name: 'Western', emoji: '🌵' },
];

function CategoriesComponent() {
  const navigate = useNavigate();
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [localFavorites, setLocalFavorites] = useState([]);
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // 📄 INFINITE SCROLL - Pattern Netflix
  const [displayedResults, setDisplayedResults] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const RESULTS_PER_LOAD = 40; // 40 risultati per caricamento

  // Carica favoriti
  useEffect(() => {
    const loadFavorites = async () => {
      const favorites = await storage.getFavorites();
      setLocalFavorites(favorites);
    };
    
    loadFavorites();
    
    // Ascolta cambiamenti favoriti
    const handleFavoritesChange = () => loadFavorites();
    window.addEventListener('favoritesChanged', handleFavoritesChange);
    
    return () => {
      window.removeEventListener('favoritesChanged', handleFavoritesChange);
    };
  }, []);

  // 🚀 CARICA CONTENUTI INIZIALI
  const handleGenreClick = async (genre, type) => {
    const genreData = { ...genre, type };
    setSelectedGenre(genreData);
    setLoading(true);
    setHasSearched(true);

    try {
      console.log(`🎬 Caricando categoria: ${genre.name} (${type})`);
      
      // 🔥 CARICA 10 PAGINE per avere pool di risultati
      const maxPages = 10;
      const promises = [];
      
      for (let page = 1; page <= maxPages; page++) {
        promises.push(discoverByGenre(genre.id, type, page));
      }
      
      const allPages = await Promise.all(promises);
      const allContent = allPages.flat();
      
      setAllResults(allContent);
      
      // Mostra solo i primi 40
      const initialResults = allContent.slice(0, RESULTS_PER_LOAD);
      setDisplayedResults(initialResults);
      setHasMore(allContent.length > RESULTS_PER_LOAD);
      
      console.log(`✅ Caricati ${allContent.length} contenuti totali`);
      console.log(`📄 Mostrati inizialmente: ${initialResults.length} risultati`);
    } catch (error) {
      console.error('Errore caricamento categoria:', error);
      setDisplayedResults([]);
      setAllResults([]);
      setHasMore(false);
    }

    setLoading(false);
  };

  const clearSelection = () => {
    setSelectedGenre(null);
    setDisplayedResults([]);
    setAllResults([]);
    setHasSearched(false);
    setLoading(false);
    setHasMore(false);
  };

  const handleItemClick = (item) => {
    const itemType = selectedGenre.type;
    
    console.log('🎬 Apertura:', item.title || item.name, 'Tipo:', itemType);
    
    if (itemType === 'tv') {
      navigate(`/tv/${item.id}`);
    } else {
      navigate(`/movie/${item.id}`); // 👈 CAMBIATO da /player/movie/:id
    }
  };

  // Aggiungi/Rimuovi dai favoriti
  const addToFavorites = async (item, e) => {
    e.stopPropagation();
    
    const favorites = await storage.getFavorites();
    const itemType = selectedGenre.type;
    
    const isAlreadyFavorite = favorites.some(fav => fav.id === item.id && fav.type === itemType);
    
    let updatedFavorites;
    
    if (isAlreadyFavorite) {
      updatedFavorites = favorites.filter(fav => !(fav.id === item.id && fav.type === itemType));
      console.log('💔 Rimosso dai favoriti:', item.title || item.name);
    } else {
      const favoriteItem = { ...item, type: itemType };
      updatedFavorites = [...favorites, favoriteItem];
      console.log('❤️ Aggiunto ai favoriti:', item.title || item.name);
    }
    
    await storage.saveFavorites(updatedFavorites);
    setLocalFavorites(updatedFavorites);
    
    window.dispatchEvent(new CustomEvent('favoritesChanged', { 
      detail: { favorites: updatedFavorites } 
    }));
    
    setForceUpdate(prev => prev + 1);
  };

  const isFavorite = (item) => {
    const itemType = selectedGenre.type;
    return localFavorites.some(fav => fav.id === item.id && fav.type === itemType);
  };

  // 📄 CARICA ALTRI - Pattern Netflix
  const loadMore = () => {
    setLoadingMore(true);
    
    const currentCount = displayedResults.length;
    const nextBatch = allResults.slice(currentCount, currentCount + RESULTS_PER_LOAD);
    
    // Aggiungi nuovi risultati a quelli esistenti
    setDisplayedResults(prev => [...prev, ...nextBatch]);
    
    // Controlla se ci sono ancora risultati
    const newCount = currentCount + nextBatch.length;
    setHasMore(newCount < allResults.length);
    
    setLoadingMore(false);
    
    console.log(`📄 Caricati altri ${nextBatch.length} risultati (${newCount}/${allResults.length})`);
  };

  return (
    <div className="categories-component">
      {/* Header */}
      <div className="categories-header">
        <h2>🎭 Esplora per Categoria</h2>
        {selectedGenre && (
          <button onClick={clearSelection} className="clear-category-btn">
            ❌ Chiudi
          </button>
        )}
      </div>

      {/* GRID CATEGORIE DIVISE: FILM / SERIE TV */}
      {!hasSearched && (
        <>
          {/* SEZIONE FILM */}
          <div className="category-section">
            <h3 className="category-section-title">
              🎬 Film
            </h3>
            <div className="categories-grid">
              {MOVIE_GENRES.map((genre) => (
                <button
                  key={`movie-${genre.id}`}
                  className="category-card"
                  onClick={() => handleGenreClick(genre, 'movie')}
                >
                  <span className="category-emoji">{genre.emoji}</span>
                  <span className="category-name">{genre.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* SEZIONE SERIE TV */}
          <div className="category-section">
            <h3 className="category-section-title">
              📺 Serie TV
            </h3>
            <div className="categories-grid">
              {TV_GENRES.map((genre) => (
                <button
                  key={`tv-${genre.id}`}
                  className="category-card"
                  onClick={() => handleGenreClick(genre, 'tv')}
                >
                  <span className="category-emoji">{genre.emoji}</span>
                  <span className="category-name">{genre.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Loading State */}
      {loading && (
        <div className="categories-loading">
          <div className="loading-spinner"></div>
          <p>Caricamento {selectedGenre?.name}...</p>
        </div>
      )}

      {/* GRIGLIA RISULTATI (non carousel) */}
      {hasSearched && !loading && (
        <div className="categories-results">
          {displayedResults.length > 0 ? (
            <>
              <div className="results-header">
                <h3 className="results-title">
                  {selectedGenre.emoji} {selectedGenre.name}
                  <span className="results-count">({allResults.length} risultati totali)</span>
                </h3>
              </div>
              
              <div className="results-grid">
                {displayedResults.map((item) => {
                  const isItemFavorite = isFavorite(item);
                  return (
                    <div
                      key={`${item.id}-${forceUpdate}`}
                      className="result-card"
                      onClick={() => handleItemClick(item)}
                    >
                      <div className="result-image-container">
                        <SmartImage
                          src={getImageUrl(item.poster_path)}
                          alt={item.title || item.name}
                          title={item.title || item.name}
                          type="poster"
                          className="result-image"
                        />
                        
                        <div className="result-overlay">
                          <div className="result-info">
                            <h4 className="result-title">{item.title || item.name}</h4>
                            <p className="result-rating">⭐ {item.vote_average?.toFixed(1) || 'N/A'}</p>
                            <p className="result-year">
                              {item.release_date || item.first_air_date 
                                ? new Date(item.release_date || item.first_air_date).getFullYear()
                                : 'N/A'
                              }
                            </p>
                          </div>
                          
                          <div className="result-actions">
                            <button 
                              className="result-play-button"
                              onClick={() => handleItemClick(item)}
                              title="Riproduci"
                            >
                              ▶️
                            </button>
                            
                            <button 
                              className={`result-favorite-button ${isItemFavorite ? 'active' : ''}`}
                              onClick={(e) => addToFavorites(item, e)}
                              title={isItemFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                            >
                              {isItemFavorite ? '❤️' : '🤍'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 📄 BOTTONE CARICA ALTRI - Pattern Netflix */}
              <div className="load-more-container">
                {hasMore ? (
                  <button 
                    className="load-more-btn"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <div className="load-more-spinner"></div>
                        <span>Caricamento...</span>
                      </>
                    ) : (
                      <>
                        <span>Carica Altri</span>
                        <span className="load-more-count">
                          ({displayedResults.length} di {allResults.length})
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="end-results">
                    <span className="end-results-icon">✓</span>
                    <span className="end-results-text">
                      Hai visto tutti i {allResults.length} risultati
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="no-results">
              <h3>😔 Nessun contenuto trovato</h3>
              <p>Prova con un'altra categoria</p>
              <button onClick={clearSelection} className="try-again-button">
                🔄 Torna alle Categorie
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CategoriesComponent;