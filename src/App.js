import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import SearchComponent from './components/SearchComponent';
import CategoriesComponent from './components/CategoriesComponent';
import VixSrcPlayer from './components/VixSrcPlayer';
import HeroSection from './components/HeroSection';
import MovieCarousel from './components/MovieCarousel';
import TVShowDetail from './components/TVShowDetail';
import MovieDetail from './components/MovieDetail'; 
import NavigationButtons from './components/NavigationButtons';
import { getTrendingMovies, getTrendingTVShows, getPopularMovies, getPopularTVShows } from './services/tmdbApi';
import './App.css';
import storage from './services/storage';

// 🎯 IMPORTA VERSIONE AUTOMATICAMENTE DA PACKAGE.JSON
import packageJson from '../package.json';

function App() {
  // Funzione per chiudere l'app
  const handleCloseApp = () => {
    if (window.electronAPI) {
      // Se siamo in Electron, chiudi l'app
      window.electronAPI.closeApp();
    } else {
      // Se siamo nel browser, chiudi la finestra/tab
      window.close();
    }
  };

  return (
    <Router>
      <div className="App">
        <header className="app-header">
          {/* 🆕 GRUPPO SINISTRA: Pulsanti Navigazione + Logo + Titolo */}
          <div className="app-left-group">
            <NavigationButtons />
            
            <div className="app-logo-section">
              {/* 🔧 LOGO CLICCABILE PER TORNARE ALLA HOME */}
              <a href="/" title="Torna alla Home">
                <img 
                  src="/images/cat-logo.png" 
                  alt="CatStreamApp Logo" 
                  className="app-logo"
                />
              </a>
              <h1>CatStreamApp</h1>
            </div>
          </div>
          
          {/* NAVIGATION TABS + CLOSE BUTTON */}
          <nav>
            <a href="/">Home</a>
            <a href="/categories">Categorie</a>
            <a href="/search">Cerca</a>
            <button 
              className="close-app-btn" 
              onClick={handleCloseApp}
              title="Chiudi applicazione"
            >
              ✕
            </button>
          </nav>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/movie/:id" element={<MovieDetailPage />} /> {/* 👈 AGGIUNTA ROUTE FILM */}
            <Route path="/tv/:id" element={<TVShowDetailPage />} />
            <Route path="/tv/:id/season/:season" element={<TVShowDetailPage />} />
            <Route path="/player/movie/:id" element={<MoviePlayer />} />
            <Route path="/player/tv/:id/:season/:episode" element={<TVPlayer />} />
          </Routes>
        </main>

        {/* 🎯 VERSIONE AUTOMATICA DA PACKAGE.JSON */}
        <div className="app-version">
          CatStreamApp v{packageJson.version}
        </div>
      </div>
    </Router>
  );
}

// ... resto del codice uguale (HomePage, SearchPage, etc.)

function HomePage() {
  const [trendingMovies, setTrendingMovies] = React.useState([]);
  const [trendingTV, setTrendingTV] = React.useState([]);
  const [popularMovies, setPopularMovies] = React.useState([]);
  const [popularTV, setPopularTV] = React.useState([]);
  const [favorites, setFavorites] = React.useState([]);

  const loadFavorites = async () => {
    const savedFavorites = await storage.getFavorites();
    setFavorites(savedFavorites);
  };

  React.useEffect(() => {
    const loadContent = async () => {
      // Prima carica i favoriti
      await loadFavorites();
      
      // Poi carica il resto
      const [trending_movies, trending_tv, popular_movies, popular_tv] = await Promise.all([
        getTrendingMovies(),
        getTrendingTVShows(),
        getPopularMovies(),
        getPopularTVShows()
      ]);
      
      setTrendingMovies(trending_movies);
      setTrendingTV(trending_tv);
      setPopularMovies(popular_movies);
      setPopularTV(popular_tv);
    };

    loadContent();

    const handleFavoritesChange = (event) => {
      setFavorites(event.detail.favorites);
    };
    
    window.addEventListener('favoritesChanged', handleFavoritesChange);
    return () => window.removeEventListener('favoritesChanged', handleFavoritesChange);
  }, []);

  const handleFavoritesUpdate = (newFavorites) => {
    setFavorites(newFavorites);
  };

  return (
    <div className="homepage">
      <HeroSection />
      
      {favorites.length > 0 && (
        <MovieCarousel 
          title="I tuoi Preferiti ❤️" 
          items={favorites} 
          type="mixed"
          onFavoritesChange={handleFavoritesUpdate}
        />
      )}
      
      <MovieCarousel 
        title="Film di Tendenza 🔥" 
        items={trendingMovies} 
        type="movie"
        onFavoritesChange={handleFavoritesUpdate}
      />
      
      <MovieCarousel 
        title="Serie TV di Tendenza 📺" 
        items={trendingTV} 
        type="tv"
        onFavoritesChange={handleFavoritesUpdate}
      />
      
      <MovieCarousel 
        title="Film Popolari 🎬" 
        items={popularMovies} 
        type="movie"
        onFavoritesChange={handleFavoritesUpdate}
      />
      
      <MovieCarousel 
        title="Serie TV Popolari 🌟" 
        items={popularTV} 
        type="tv"
        onFavoritesChange={handleFavoritesUpdate}
      />
    </div>
  );
}

function SearchPage() {
  return (
    <div className="search-page">
      <h2>Cerca Film e Serie TV</h2>
      <SearchComponent />
    </div>
  );
}

// 🎬 NUOVA PAGINA CATEGORIE
function CategoriesPage() {
  return (
    <div className="categories-page">
      <CategoriesComponent />
    </div>
  );
}

// 🎬 PAGINA DETTAGLI FILM - 👈 AGGIUNTA FUNZIONE
function MovieDetailPage() {
  React.useEffect(() => {
    document.body.classList.add('movie-detail-mode');
    return () => document.body.classList.remove('movie-detail-mode');
  }, []);
  
  return <MovieDetail />;
}

function TVShowDetailPage() {
  const { season: seasonParam } = useParams();
  
  React.useEffect(() => {
    document.body.classList.add('tv-detail-mode');
    return () => document.body.classList.remove('tv-detail-mode');
  }, []);
  
  return <TVShowDetail initialSeason={seasonParam} />;
}

function MoviePlayer() {
  const { id } = useParams();
  const [movieTitle, setMovieTitle] = React.useState('Caricamento...');
  
  React.useEffect(() => {
    document.body.classList.add('player-mode');
    
    const loadMovieTitle = async () => {
      try {
        const { getMovieDetails } = await import('./services/tmdbApi');
        const details = await getMovieDetails(id);
        if (details) {
          setMovieTitle(details.title);
        }
      } catch (error) {
        console.error('Errore caricamento titolo film:', error);
        setMovieTitle('Film Selezionato');
      }
    };
    
    loadMovieTitle();
    
    return () => document.body.classList.remove('player-mode');
  }, [id]);
  
  return (
    <div className="player-page">
      <VixSrcPlayer 
        tmdbId={id}
        type="movie"
        title={movieTitle}
      />
    </div>
  );
}

function TVPlayer() {
  const { id, season, episode } = useParams();
  const [showTitle, setShowTitle] = React.useState('Caricamento...');
  
  React.useEffect(() => {
    document.body.classList.add('player-mode');
    
    const loadShowTitle = async () => {
      try {
        const { getTVDetails } = await import('./services/tmdbApi');
        const details = await getTVDetails(id);
        if (details) {
          setShowTitle(`${details.name} - S${season}E${episode}`);
        }
      } catch (error) {
        console.error('Errore caricamento titolo serie:', error);
        setShowTitle('Serie TV Selezionata');
      }
    };
    
    loadShowTitle();
    
    return () => document.body.classList.remove('player-mode');
  }, [id, season, episode]);
  
  return (
    <div className="player-page">
      <VixSrcPlayer 
        tmdbId={id}
        type="tv"
        season={season}
        episode={episode}
        title={showTitle}
      />
    </div>
  );
}

export default App;