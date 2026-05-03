import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMovieDetails, getBackdropUrl } from '../services/tmdbApi';
import ExpandableText from './ExpandableText';
import MovieCarousel from './MovieCarousel';
import NetworkError from './NetworkError';
import { isNetworkError } from '../utils/networkUtils';
import './MovieDetail.css';
import storage from '../services/storage';
import axios from 'axios';
import { SkeletonDetail } from './Skeleton';
import toast from 'react-hot-toast';
import { Play, Heart, Info, Users, Video, Star, Film } from 'lucide-react';

const API_KEY = process.env.REACT_APP_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [movieDetails, setMovieDetails] = useState(null);
  const [cast, setCast] = useState([]);
  const [crew, setCrew] = useState([]);
  const [videos, setVideos] = useState([]);
  const [certification, setCertification] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFavoriteMovie, setIsFavoriteMovie] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  
  const [activeTab, setActiveTab] = useState('info');

  // 🔧 RESET DELLA TAB QUANDO CAMBIA IL FILM
  useEffect(() => {
    setActiveTab('info');
  }, [id]);

  const loadFavoriteStatus = useCallback(async () => {
    const favorites = await storage.getFavorites();
    const isFavorite = favorites.some(fav => fav.id === parseInt(id) && fav.type === 'movie');
    setIsFavoriteMovie(isFavorite);
  }, [id]);

  useEffect(() => {
    const loadMovieData = async () => {
      setLoading(true);
      setNetworkError(false);
      
      try {
        const details = await getMovieDetails(id);
        setMovieDetails(details);
        
        await Promise.all([
          loadCredits(id),
          loadVideos(id),
          loadCertification(id),
          loadRecommendations(id),
          loadReviews(id)
        ]);
        
        await loadFavoriteStatus();
      } catch (error) {
        console.error('❌ Errore caricamento film:', error);
        if (isNetworkError(error)) {
          setNetworkError(true);
        }
      }
      
      setLoading(false);
    };

    loadMovieData();
  }, [id, loadFavoriteStatus]);

  const loadCredits = async (movieId) => {
    try {
      const response = await axios.get(`${BASE_URL}/movie/${movieId}/credits`, {
        params: { api_key: API_KEY, language: 'it-IT' }
      });
      
      setCast(response.data.cast.slice(0, 20));
      setCrew(response.data.crew);
      
      console.log(`✅ Cast: ${response.data.cast.length} attori`);
    } catch (error) {
      console.error('❌ Errore caricamento credits:', error);
    }
  };

  const loadVideos = async (movieId) => {
    try {
      const response = await axios.get(`${BASE_URL}/movie/${movieId}/videos`, {
        params: { api_key: API_KEY, language: 'it-IT' }
      });
      
      const sortedVideos = response.data.results.sort((a, b) => {
        if (a.type === 'Trailer' && b.type !== 'Trailer') return -1;
        if (a.type !== 'Trailer' && b.type === 'Trailer') return 1;
        if (a.official && !b.official) return -1;
        if (!a.official && b.official) return 1;
        return 0;
      });
      
      setVideos(sortedVideos);
      console.log(`✅ Video: ${sortedVideos.length} trovati`);
    } catch (error) {
      console.error('❌ Errore caricamento video:', error);
    }
  };

  const loadCertification = async (movieId) => {
    try {
      const response = await axios.get(`${BASE_URL}/movie/${movieId}/release_dates`, {
        params: { api_key: API_KEY }
      });
      
      const usRelease = response.data.results.find(r => r.iso_3166_1 === 'US');
      const itRelease = response.data.results.find(r => r.iso_3166_1 === 'IT');
      
      const cert = (itRelease?.release_dates[0]?.certification || 
                    usRelease?.release_dates[0]?.certification || 
                    null);
      
      setCertification(cert);
      console.log(`✅ Certificazione: ${cert || 'N/A'}`);
    } catch (error) {
      console.error('❌ Errore caricamento certificazione:', error);
    }
  };

  const loadRecommendations = async (movieId) => {
    try {
      const response = await axios.get(`${BASE_URL}/movie/${movieId}/recommendations`, {
        params: { api_key: API_KEY, language: 'it-IT' }
      });
      
      setRecommendations(response.data.results.slice(0, 12));
      console.log(`✅ Raccomandazioni: ${response.data.results.length}`);
    } catch (error) {
      console.error('❌ Errore caricamento raccomandazioni:', error);
    }
  };

  const loadReviews = async (movieId) => {
    try {
      const response = await axios.get(`${BASE_URL}/movie/${movieId}/reviews`, {
        params: { api_key: API_KEY, language: 'en-US' }
      });
      
      setReviews(response.data.results.slice(0, 10));
      console.log(`✅ Recensioni: ${response.data.results.length}`);
    } catch (error) {
      console.error('❌ Errore caricamento recensioni:', error);
    }
  };


  const toggleFavorites = async () => {
    const favorites = await storage.getFavorites();
    let updatedFavorites;
    
    if (isFavoriteMovie) {
      updatedFavorites = favorites.filter(fav => 
        !(fav.id === parseInt(id) && fav.type === 'movie'));
      setIsFavoriteMovie(false);
    } else {
      const favoriteItem = { ...movieDetails, type: 'movie' };
      updatedFavorites = [...favorites, favoriteItem];
      setIsFavoriteMovie(true);
    }
    
    storage.saveFavorites(updatedFavorites);
    toast(isFavoriteMovie ? 'Rimosso dai preferiti' : 'Aggiunto ai preferiti',
      { icon: isFavoriteMovie ? '💔' : '🧡' }
    );
    window.dispatchEvent(new CustomEvent('favoritesChanged', {
      detail: { favorites: updatedFavorites }
    }));
  };

  const playMovie = () => {
    navigate(`/player/movie/${id}`);
  };

  const handleRetry = () => {
    window.location.reload();
  };

  const getDirector = () => crew.find(p => p.job === 'Director');
  const getScreenwriter = () => crew.find(p => p.job === 'Screenplay');
  const getProducers = () => crew.filter(p => p.job === 'Producer').slice(0, 3);

  if (loading) return <SkeletonDetail />;

  if (networkError) {
    return <NetworkError onRetry={handleRetry} />;
  }

  if (!movieDetails && !loading) {
    return (
      <div className="movie-detail-error">
        <h2>Film non trovato</h2>
        <p>Il film che stai cercando non esiste o non è disponibile.</p>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">
          ← Torna Indietro
        </button>
      </div>
    );
  }

  // 🆕 Se movieDetails è null ma non stiamo caricando, mostra loading
  if (!movieDetails) {
    return (
      <div className="movie-detail-loading">
        <div className="loading-spinner"></div>
        <p>Caricamento...</p>
      </div>
    );
  }

  const director = getDirector();
  const trailer = videos.find(v => v.type === 'Trailer');

  return (
    <div className="movie-detail">
      {/* ========================================
          HERO SECTION - IMMAGINE DI BACKGROUND
          ======================================== */}
      <div 
        className="movie-hero"
        style={{ backgroundImage: `url(${getBackdropUrl(movieDetails.backdrop_path)})` }}
      >
        <div className="movie-hero-overlay">
          <div className="movie-hero-content">
            
            {/* Titolo Principale */}
            <h1 className="movie-title">{movieDetails.title}</h1>
            
            {/* Metadata Inline: Anno · Durata · Certificazione */}
            <div className="movie-metadata-inline">
              <span>{new Date(movieDetails.release_date).getFullYear()}</span>
              <span>•</span>
              <span>{movieDetails.runtime} min</span>
              {certification && (
                <>
                  <span>•</span>
                  <span className="certification-badge">{certification}</span>
                </>
              )}
              <span>•</span>
              <span>⭐ {movieDetails.vote_average.toFixed(1)}</span>
            </div>
            
            {/* Generi Inline */}
            {movieDetails.genres?.length > 0 && (
              <div className="movie-genres-inline">
                {movieDetails.genres.map(genre => (
                  <span key={genre.id} className="genre-pill">
                    {genre.name}
                  </span>
                ))}
              </div>
            )}
            
            {/* Tagline */}
            {movieDetails.tagline && (
              <p className="movie-tagline">"{movieDetails.tagline}"</p>
            )}
            
            {/* Descrizione */}
            <div className="movie-description">
              <ExpandableText
                text={movieDetails.overview}
                maxLength={200}
                className="movie-overview-text"
                expandText="Leggi tutto"
                collapseText="Riduci"
              />
            </div>
            
            {/* Regista */}
            {director && (
              <div className="movie-director-inline">
                <span className="director-label">Regia:</span>
                <span className="director-name">{director.name}</span>
              </div>
            )}
            
            {/* ========================================
                BOTTONI AZIONI - ALLINEATI A TVSHOW
                ======================================== */}
            <div className="movie-actions">
              <button className="btn btn-primary btn-lg" onClick={playMovie}>
                <Play size={18} fill="currentColor" />
                <span className="btn-text">Riproduci</span>
              </button>

              <button
                className={`btn btn-secondary btn-lg btn-favorite ${isFavoriteMovie ? 'remove' : ''}`}
                onClick={toggleFavorites}
                title={isFavoriteMovie ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti'}
                aria-label={isFavoriteMovie ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti'}
              >
                <Heart size={18} fill={isFavoriteMovie ? 'currentColor' : 'none'} />
                <span className="btn-text">
                  {isFavoriteMovie ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          TABS NAVIGATION
          ======================================== */}
      <div className="movie-tabs-container">
        <div className="movie-tabs">
          <button className={`tab-button ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
            <Info size={15} /> Info
          </button>
          <button className={`tab-button ${activeTab === 'cast' ? 'active' : ''}`} onClick={() => setActiveTab('cast')}>
            <Users size={15} /> Cast
          </button>
          {videos.length > 0 && (
            <button className={`tab-button ${activeTab === 'trailer' ? 'active' : ''}`} onClick={() => setActiveTab('trailer')}>
              <Video size={15} /> Trailer
            </button>
          )}
          {reviews.length > 0 && (
            <button className={`tab-button ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
              <Star size={15} /> Recensioni
            </button>
          )}
          {recommendations.length > 0 && (
            <button className={`tab-button ${activeTab === 'similar' ? 'active' : ''}`} onClick={() => setActiveTab('similar')}>
              <Film size={15} /> Film Simili
            </button>
          )}
        </div>
      </div>

      {/* ========================================
          TAB CONTENT
          ======================================== */}
      <div className="movie-tab-content">
        
        {/* === INFO TAB === */}
        {activeTab === 'info' && (
          <div className="tab-panel tab-info">
            <div className="info-grid">

              {/* Crew Principale */}
              <div className="info-card">
                <h3>🎬 Crew Principale</h3>
                <div className="crew-list">
                  {director && (
                    <div className="crew-item">
                      <span className="crew-role">Regia:</span>
                      <span className="crew-name">{director.name}</span>
                    </div>
                  )}
                  {getScreenwriter() && (
                    <div className="crew-item">
                      <span className="crew-role">Sceneggiatura:</span>
                      <span className="crew-name">{getScreenwriter().name}</span>
                    </div>
                  )}
                  {getProducers().length > 0 && (
                    <div className="crew-item">
                      <span className="crew-role">Produttori:</span>
                      <span className="crew-name">
                        {getProducers().map(p => p.name).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>                
              
              {/* Box Office */}
              {(movieDetails.budget > 0 || movieDetails.revenue > 0) && (
                <div className="info-card">
                  <h3>💰 Box Office</h3>
                  {movieDetails.budget > 0 && (
                    <div className="info-row">
                      <span className="info-label">Budget:</span>
                      <span className="info-value">${(movieDetails.budget / 1000000).toFixed(0)}M</span>
                    </div>
                  )}
                  {movieDetails.revenue > 0 && (
                    <div className="info-row">
                      <span className="info-label">Incasso:</span>
                      <span className="info-value">${(movieDetails.revenue / 1000000).toFixed(0)}M</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Lingue */}
              {movieDetails.spoken_languages?.length > 0 && (
                <div className="info-card">
                  <h3>🌍 Lingua originale</h3>
                  <p className="info-text">
                    {movieDetails.spoken_languages.map(l => l.english_name).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === CAST TAB === */}
        {activeTab === 'cast' && (
          <div className="tab-panel tab-cast">
            <div className="cast-grid">
              {cast.map(actor => (
                <div key={actor.id} className="cast-item">
                  <div className="cast-photo">
                    {actor.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                        alt={actor.name}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="cast-photo-placeholder">
                        <span>👤</span>
                      </div>
                    )}
                  </div>
                  <div className="cast-details">
                    <p className="cast-actor-name">{actor.name}</p>
                    <p className="cast-character-name">{actor.character}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === TRAILER TAB === */}
        {activeTab === 'trailer' && (
          <div className="tab-panel tab-trailer">
            {trailer && (
              <div className="video-container">
                <iframe
                  width="100%"
                  height="600"
                  src={`https://www.youtube.com/embed/${trailer.key}`}
                  title={trailer.name}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}
            
            {/* Altri video */}
            {videos.length > 1 && (
              <div className="other-videos">
                <h3>Altri Video</h3>
                <div className="videos-grid">
                  {videos.slice(1, 6).map(video => (
                    <div key={video.id} className="video-thumb">
                      <iframe
                        width="100%"
                        height="200"
                        src={`https://www.youtube.com/embed/${video.key}`}
                        title={video.name}
                        frameBorder="0"
                        allowFullScreen
                      ></iframe>
                      <p className="video-title">{video.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === REVIEWS TAB === */}
        {activeTab === 'reviews' && (
          <div className="tab-panel tab-reviews">
            {reviews.map(review => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <div className="review-author">
                    <strong>{review.author}</strong>
                    {review.author_details?.rating && (
                      <span className="review-rating">
                        ⭐ {review.author_details.rating}/10
                      </span>
                    )}
                  </div>
                  <span className="review-date">
                    {new Date(review.created_at).toLocaleDateString('it-IT')}
                  </span>
                </div>
                <div className="review-content">
                  <ExpandableText
                    text={review.content}
                    maxLength={300}
                    expandText="Leggi tutto"
                    collapseText="Riduci"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === SIMILAR MOVIES TAB === */}
        {activeTab === 'similar' && recommendations.length > 0 && (
          <div className="tab-panel tab-similar">
            <MovieCarousel 
              title="🎬 Film Simili"
              items={recommendations}
              type="movie"
            />
          </div>
        )}
        
      </div>
    </div>
  );
}

export default MovieDetail;