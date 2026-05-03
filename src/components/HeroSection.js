import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTrendingMovies, getBackdropUrl } from '../services/tmdbApi';
import ExpandableText from './ExpandableText';
import UpcomingBadge from './UpcomingBadge';
import './HeroSection.css';
import storage from '../services/storage';
import { SkeletonHero } from './Skeleton';
import toast from 'react-hot-toast';
import { Info, Play, Heart, ChevronLeft, ChevronRight, Pause } from 'lucide-react';

function HeroSection() {
  const [heroItems, setHeroItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [favoriteStates, setFavoriteStates] = useState({});
  const [isPaused, setIsPaused] = useState(false);
  
  const navigate = useNavigate();

  // 🔧 HELPER: Determina se l'item è un film o una serie TV
  const getItemType = (item) => {
    // Se ha media_type esplicito, usalo
    if (item.media_type) {
      return item.media_type === 'movie' ? 'movie' : 'tv';
    }
    // Altrimenti: i film hanno "title", le serie TV hanno "name"
    return item.title ? 'movie' : 'tv';
  };

  // 🔧 HELPER: Ottieni il titolo (film usano "title", serie TV usano "name")
  const getItemTitle = (item) => {
    return item.title || item.name || 'Titolo non disponibile';
  };

  // 🔧 HELPER: Ottieni la data di uscita (film: release_date, TV: first_air_date)
  const getItemDate = (item) => {
    return item.release_date || item.first_air_date;
  };

  useEffect(() => {
    let isMounted = true;

    const loadHeroItems = async () => {
      setLoading(true);

      try {
        const trending = await getTrendingMovies();
        if (!isMounted) return;

        const itemsWithType = trending.slice(0, 5).map(item => ({
          ...item,
          media_type: item.media_type || 'movie'
        }));
        setHeroItems(itemsWithType);

        const favorites = await storage.getFavorites();
        if (!isMounted) return;

        const favStates = {};
        favorites.forEach(fav => {
          favStates[`${fav.type}_${fav.id}`] = true;
        });
        setFavoriteStates(favStates);
      } catch (error) {
        console.error('❌ Errore caricamento hero:', error);
      }

      if (isMounted) setLoading(false);
    };

    loadHeroItems();
    return () => { isMounted = false; };
  }, []);

  // Auto-slide ogni 8 secondi (se non in pausa)
  useEffect(() => {
    if (!isPaused && heroItems.length > 0) {
      const interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % heroItems.length);
      }, 8000);
      
      return () => clearInterval(interval);
    }
  }, [heroItems.length, isPaused]);

  // 🎬 PLAY: Avvia il player (film o serie TV)
  const playItem = (item) => {
    const type = getItemType(item);
    
    if (type === 'movie') {
      navigate(`/player/movie/${item.id}`);
    } else {
      // Per le serie TV, vai al primo episodio (S1E1)
      navigate(`/player/tv/${item.id}/1/1`);
    }
  };

  // ℹ️ DETTAGLI: Vai alla pagina dettagli (film o serie TV)
  const goToDetails = (item) => {
    const type = getItemType(item);
    
    if (type === 'movie') {
      navigate(`/movie/${item.id}`);
    } else {
      navigate(`/tv/${item.id}`);
    }
  };

  // ❤️ PREFERITI: Aggiungi/Rimuovi dai preferiti
  const toggleFavorites = async (item) => {
    const type = getItemType(item);
    const favorites = await storage.getFavorites();
    
    const isCurrentlyFavorite = favorites.some(fav => 
      fav.id === item.id && fav.type === type
    );
    
    let updatedFavorites;
    
    if (isCurrentlyFavorite) {
      updatedFavorites = favorites.filter(fav => 
        !(fav.id === item.id && fav.type === type)
      );
      console.log(`💔 ${type === 'movie' ? 'Film' : 'Serie TV'} rimosso dai favoriti:`, getItemTitle(item));
    } else {
      const favoriteItem = { ...item, type: type };
      updatedFavorites = [...favorites, favoriteItem];
      console.log(`❤️ ${type === 'movie' ? 'Film' : 'Serie TV'} aggiunto ai favoriti:`, getItemTitle(item));
    }
    
    await storage.saveFavorites(updatedFavorites);

    toast(isCurrentlyFavorite
      ? `Rimosso dai preferiti`
      : `Aggiunto ai preferiti`,
      { icon: isCurrentlyFavorite ? '💔' : '🧡' }
    );

    const key = `${type}_${item.id}`;
    setFavoriteStates(prev => ({
      ...prev,
      [key]: !isCurrentlyFavorite
    }));
    
    // Notifica altri componenti
    window.dispatchEvent(new CustomEvent('favoritesChanged', { 
      detail: { favorites: updatedFavorites } 
    }));
  };

  if (loading) return <SkeletonHero />;

  // === EMPTY STATE ===
  if (heroItems.length === 0) {
    return (
      <div className="hero-loading">
        <p>Nessun contenuto disponibile</p>
      </div>
    );
  }

  // === RENDER ===
  const currentItem = heroItems[currentIndex];
  const currentType = getItemType(currentItem);
  const currentTitle = getItemTitle(currentItem);
  const currentDate = getItemDate(currentItem);
  
  // Chiave unica per controllare stato favoriti
  const favoriteKey = `${currentType}_${currentItem.id}`;
  const isFavorite = favoriteStates[favoriteKey] || false;

  return (
    <div className="hero-carousel">
      <div 
        className="hero-section"
        style={{ background: `url(${getBackdropUrl(currentItem.backdrop_path)})` }}
      >
        <div className="hero-overlay">
          <div className="hero-content">
            {/* TITOLO */}
            <h1 className="hero-title">{currentTitle}</h1>
            
            {/* BADGE "IN ARRIVO" (solo per film con data futura) */}
            <UpcomingBadge releaseDate={currentDate} />
            
            {/* DESCRIZIONE CON EXPANDABLETEXT */}
            <div className="hero-description">
              <ExpandableText
                text={currentItem.overview}
                maxLength={200}
                className="hero-overview-text"
                expandText="Leggi tutto"
                collapseText="Riduci"
              />
            </div>
            
            {/* METADATA */}
            <div className="hero-metadata">
              <span className="hero-rating">⭐ {currentItem.vote_average?.toFixed(1)}</span>
              <span className="hero-year">
                {currentDate ? new Date(currentDate).getFullYear() : 'N/A'}
              </span>
              <span className="hero-genre">
                {currentType === 'movie' ? 'Film' : 'Serie TV'}
              </span>
            </div>
            
            {/* 🆕 BOTTONI AZIONI - INLINE: Dettagli + Riproduci + Cuore */}
            <div className="hero-actions">
              {/* 1️⃣ VAI AI DETTAGLI - Stile primario */}
              <button
                className="btn btn-primary btn-lg"
                onClick={() => goToDetails(currentItem)}
              >
                <Info size={18} />
                <span className="btn-text">Vai ai Dettagli</span>
              </button>

              <button
                className="btn btn-primary btn-lg"
                onClick={() => playItem(currentItem)}
              >
                <Play size={18} fill="currentColor" />
                <span className="btn-text">Riproduci</span>
              </button>

              <button
                className={`btn btn-secondary btn-lg btn-favorite ${isFavorite ? 'remove' : ''}`}
                onClick={() => toggleFavorites(currentItem)}
                title={isFavorite ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti'}
                aria-label={isFavorite ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti'}
              >
                <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        </div>
        
        {/* CONTROLLI NAVIGAZIONE */}
        <div className="hero-navigation">
          <button
            className="hero-nav-btn"
            onClick={() => setCurrentIndex(prev => (prev - 1 + heroItems.length) % heroItems.length)}
            aria-label="Contenuto precedente"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            className="hero-nav-btn"
            onClick={() => setCurrentIndex(prev => (prev + 1) % heroItems.length)}
            aria-label="Contenuto successivo"
          >
            <ChevronRight size={28} />
          </button>
        </div>
        
        {/* BOTTONE PAUSA/PLAY */}
        <button
          className="hero-pause-btn"
          onClick={() => setIsPaused(!isPaused)}
          aria-label={isPaused ? 'Riprendi carosello' : 'Metti in pausa carosello'}
        >
          {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
        </button>
      </div>
      
      {/* INDICATORI */}
      <div className="hero-indicators">
        {heroItems.map((_, index) => (
          <button
            key={index}
            className={`indicator ${index === currentIndex ? 'active' : ''}`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Vai al contenuto ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default HeroSection;