import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useParams, useLocation, useNavigate } from 'react-router-dom';
import SearchComponent from './components/SearchComponent';
import CategoriesComponent from './components/CategoriesComponent';
import VixSrcPlayer from './components/VixSrcPlayer';
import HeroSection from './components/HeroSection';
import MovieCarousel from './components/MovieCarousel';
import TVShowDetail from './components/TVShowDetail';
import MovieDetail from './components/MovieDetail';
import NavigationButtons from './components/NavigationButtons';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import ContinueWatchingCarousel from './components/ContinueWatchingCarousel';
import UpdateNotification from './components/UpdateNotification';
import { X, Heart, Flame, TrendingUp, Star } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { SkeletonCarousel } from './components/Skeleton';
import { getTrendingMovies, getTrendingTVShows, getPopularMovies, getPopularTVShows } from './services/tmdbApi';
import { cacheService } from './services/cacheService';
import './App.css';
import storage from './services/storage';

// 🎯 IMPORTA VERSIONE AUTOMATICAMENTE DA PACKAGE.JSON
import packageJson from '../package.json';

function App() {
  React.useEffect(() => {
    cacheService.cleanExpiredCache();
  }, []);

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
          <div className="app-left-group">
            <NavigationButtons />
            <NavLink to="/" end className="app-logo-link">
              <img
                src="/images/cat-logo.png"
                alt="CatStreamApp"
                className="app-logo"
              />
              <span className="app-brand-name">CatStreamApp</span>
            </NavLink>
          </div>

          <nav className="app-nav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/categories">Categorie</NavLink>
            <NavLink to="/search">Cerca</NavLink>
          </nav>

          <button
            className="close-app-btn"
            onClick={handleCloseApp}
            title="Chiudi applicazione"
            aria-label="Chiudi applicazione"
          >
            <X size={22} />
          </button>
        </header>

        <main className="app-main">
          <ErrorBoundary>
            <AnimatedRoutes />
          </ErrorBoundary>
        </main>

        {/* 🎯 VERSIONE AUTOMATICA DA PACKAGE.JSON */}
        <div className="app-version">
          CatStreamApp v{packageJson.version}
        </div>

        <UpdateNotification />

        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 2000,
            style: {
              background: '#2a2a2a',
              color: '#ffffff',
              border: '1px solid #333',
              borderRadius: '8px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#ff6b35', secondary: '#fff' } },
          }}
        />
      </div>
    </Router>
  );
}

function KeyboardShortcuts() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;
      if (isTyping) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        navigate('/search');
        return;
      }

      if (e.key === 'Backspace' && window.electronAPI) {
        e.preventDefault();
        window.electronAPI.goBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.key} style={{ animation: 'page-enter 0.25s ease-out' }}>
      <ScrollToTop />
      <KeyboardShortcuts />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/movie/:id" element={<MovieDetailPage />} />
        <Route path="/tv/:id" element={<TVShowDetailPage />} />
        <Route path="/tv/:id/season/:season" element={<TVShowDetailPage />} />
        <Route path="/player/movie/:id" element={<MoviePlayer />} />
        <Route path="/player/tv/:id/:season/:episode" element={<TVPlayer />} />
      </Routes>
    </div>
  );
}

function HomePage() {
  const [trendingMovies, setTrendingMovies] = React.useState([]);
  const [trendingTV, setTrendingTV]         = React.useState([]);
  const [popularMovies, setPopularMovies]   = React.useState([]);
  const [popularTV, setPopularTV]           = React.useState([]);
  const [favorites, setFavorites]           = React.useState([]);
  const [loadingContent, setLoadingContent] = React.useState(true);

  const pendingScroll = React.useRef(null);

  const loadFavorites = async () => {
    const savedFavorites = await storage.getFavorites();
    setFavorites(savedFavorites);
  };

  // Scroll restoration
  React.useEffect(() => {
    const saved = sessionStorage.getItem('home_scroll_y');
    if (saved) {
      sessionStorage.removeItem('home_scroll_y');
      pendingScroll.current = parseInt(saved, 10);
    }
    return () => {
      sessionStorage.setItem('home_scroll_y', Math.round(window.scrollY).toString());
    };
  }, []);

  // Ripristina scroll dopo che i contenuti sono caricati
  React.useEffect(() => {
    if (pendingScroll.current !== null && !loadingContent) {
      const y = pendingScroll.current;
      pendingScroll.current = null;
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
    }
  }, [loadingContent]);

  React.useEffect(() => {
    let isMounted = true;

    const loadContent = async () => {
      await loadFavorites();

      const [trending_movies, trending_tv, popular_movies, popular_tv] = await Promise.all([
        getTrendingMovies(),
        getTrendingTVShows(),
        getPopularMovies(),
        getPopularTVShows()
      ]);

      if (!isMounted) return;
      setTrendingMovies(trending_movies);
      setTrendingTV(trending_tv);
      setPopularMovies(popular_movies);
      setPopularTV(popular_tv);
      setLoadingContent(false);
    };

    loadContent();

    const handleFavoritesChange = (event) => {
      if (isMounted) setFavorites(event.detail.favorites);
    };

    window.addEventListener('favoritesChanged', handleFavoritesChange);
    return () => {
      isMounted = false;
      window.removeEventListener('favoritesChanged', handleFavoritesChange);
    };
  }, []);

  const handleFavoritesUpdate = (newFavorites) => {
    setFavorites(newFavorites);
  };

  return (
    <div className="homepage">
      <HeroSection />

      <ContinueWatchingCarousel />

      {favorites.length > 0 && (
        <MovieCarousel
          title="I tuoi Preferiti"
          icon={Heart}
          items={favorites}
          type="mixed"
          onFavoritesChange={handleFavoritesUpdate}
        />
      )}

      {loadingContent ? (
        <>
          <SkeletonCarousel />
          <SkeletonCarousel />
          <SkeletonCarousel />
          <SkeletonCarousel />
        </>
      ) : (
        <>
          <MovieCarousel
            title="Film di Tendenza"
            icon={Flame}
            items={trendingMovies}
            type="movie"
            onFavoritesChange={handleFavoritesUpdate}
          />
          <MovieCarousel
            title="Serie TV di Tendenza"
            icon={TrendingUp}
            items={trendingTV}
            type="tv"
            onFavoritesChange={handleFavoritesUpdate}
          />
          <MovieCarousel
            title="Film Popolari"
            icon={Star}
            items={popularMovies}
            type="movie"
            onFavoritesChange={handleFavoritesUpdate}
          />
          <MovieCarousel
            title="Serie TV Popolari"
            icon={Star}
            items={popularTV}
            type="tv"
            onFavoritesChange={handleFavoritesUpdate}
          />
        </>
      )}
    </div>
  );
}

function SearchPage() {
  return (
    <div className="search-page">
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