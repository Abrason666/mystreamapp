import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTrendingMovies, getBackdropUrl } from '../services/tmdbApi';
import ExpandableText from './ExpandableText';
import UpcomingBadge from './UpcomingBadge'; // 🆕 Import UpcomingBadge
import './HeroSection.css';
import storage from '../services/storage';

function HeroSection() {
  const [heroMovies, setHeroMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [favoriteStates, setFavoriteStates] = useState({});
  const [isPaused, setIsPaused] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔍 Debug storage:');
    console.log('- window.electronAPI:', window.electronAPI);
    console.log('- storage.isElectron():', storage.checkIfElectron());
    console.log('- Tipo ambiente:', storage.isElectron ? 'Electron' : 'Browser');
    
    const loadHeroMovies = async () => {
      setLoading(true);
      
      try {
        const trending = await getTrendingMovies();
        console.log(`✅ Film caricati per hero: ${trending.length}`);
        setHeroMovies(trending.slice(0, 5));
        
        const favorites = await storage.getFavorites();
        const favStates = {};
        favorites.forEach(fav => {
          if (fav.type === 'movie') {
            favStates[fav.id] = true;
          }
        });
        setFavoriteStates(favStates);
      } catch (error) {
        console.error('❌ Errore caricamento hero:', error);
      }
      
      setLoading(false);
    };

    loadHeroMovies();
  }, []);

  useEffect(() => {
    if (!isPaused && heroMovies.length > 0) {
      const interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % heroMovies.length);
      }, 8000);
      
      return () => clearInterval(interval);
    }
  }, [heroMovies.length, isPaused]);

  const playMovie = (movie) => {
    navigate(`/player/movie/${movie.id}`);
  };

  const toggleFavorites = async (movie) => {
    const favorites = await storage.getFavorites();
    const isCurrentlyFavorite = favorites.some(fav => 
      fav.id === movie.id && fav.type === 'movie'
    );
    
    let updatedFavorites;
    
    if (isCurrentlyFavorite) {
      updatedFavorites = favorites.filter(fav => 
        !(fav.id === movie.id && fav.type === 'movie'));
      console.log('💔 Film rimosso dai favoriti:', movie.title);
    } else {
      const favoriteItem = { ...movie, type: 'movie' };
      updatedFavorites = [...favorites, favoriteItem];
      console.log('❤️ Film aggiunto ai favoriti:', movie.title);
    }
    
    await storage.saveFavorites(updatedFavorites);
    
    setFavoriteStates(prev => ({
      ...prev,
      [movie.id]: !isCurrentlyFavorite
    }));
    
    window.dispatchEvent(new CustomEvent('favoritesChanged', { 
      detail: { favorites: updatedFavorites } 
    }));
  };

  if (loading) {
    return (
      <div className="hero-loading">
        <div className="loading-spinner"></div>
        <p>Caricamento contenuti in evidenza...</p>
      </div>
    );
  }

  if (heroMovies.length === 0) {
    return (
      <div className="hero-loading">
        <p>Nessun contenuto disponibile</p>
      </div>
    );
  }

  const currentMovie = heroMovies[currentIndex];
  const isFavorite = favoriteStates[currentMovie.id] || false;

  return (
    <div className="hero-carousel">
      <div 
        className="hero-section"
        style={{ background: `url(${getBackdropUrl(currentMovie.backdrop_path)})` }}
      >
        <div className="hero-overlay">
          <div className="hero-content">
            <h1 className="hero-title">{currentMovie.title}</h1>
            
            {/* 🆕 BADGE "IN ARRIVO" */}
            <UpcomingBadge releaseDate={currentMovie.release_date} />
            
            {/* 🆕 DESCRIZIONE CON EXPANDABLETEXT + SCROLLBAR */}
            <div className="hero-description">
              <ExpandableText
                text={currentMovie.overview}
                maxLength={200}
                className="hero-overview-text"
                expandText="Leggi tutto"
                collapseText="Riduci"
              />
            </div>
            
            <div className="hero-metadata">
              <span className="hero-rating">⭐ {currentMovie.vote_average.toFixed(1)}</span>
              <span className="hero-year">{new Date(currentMovie.release_date).getFullYear()}</span>
              <span className="hero-genre">Film</span>
            </div>
            
            <div className="hero-actions">
              <button 
                className="btn btn-primary btn-lg"
                onClick={() => playMovie(currentMovie)}
              >
                <span className="btn-icon">▶️</span>
                <span className="btn-text">Riproduci</span>
              </button>
              
              <button 
                className={`btn btn-secondary btn-lg ${isFavorite ? 'remove' : ''}`}
                onClick={() => toggleFavorites(currentMovie)}
              >
                <span className="btn-icon">{isFavorite ? '💔' : '➕'}</span>
                <span className="btn-text">
                  {isFavorite ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti'}
                </span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Controlli navigazione */}
        <div className="hero-navigation">
          <button 
            className="hero-nav-btn" 
            onClick={() => setCurrentIndex(prev => (prev - 1 + heroMovies.length) % heroMovies.length)}
            aria-label="Film precedente"
          >
            ‹
          </button>
          <button 
            className="hero-nav-btn" 
            onClick={() => setCurrentIndex(prev => (prev + 1) % heroMovies.length)}
            aria-label="Film successivo"
          >
            ›
          </button>
        </div>
        
        {/* Bottone Pausa/Play */}
        <button 
          className="hero-pause-btn"
          onClick={() => setIsPaused(!isPaused)}
          aria-label={isPaused ? "Riprendi carosello" : "Metti in pausa carosello"}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
      </div>
      
      {/* Indicatori */}
      <div className="hero-indicators">
        {heroMovies.map((_, index) => (
          <button
            key={index}
            className={`indicator ${index === currentIndex ? 'active' : ''}`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Vai al film ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default HeroSection;