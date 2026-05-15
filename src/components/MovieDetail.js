import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getMovieDetails, getBackdropUrl,
  getMovieCredits, getMovieVideos, getMovieCertification,
  getMovieRecommendations, getMovieReviews,
} from '../services/tmdbApi';
import ExpandableText from './ExpandableText';
import MovieCarousel from './MovieCarousel';
import NetworkError from './NetworkError';
import { isNetworkError } from '../utils/networkUtils';
import './MovieDetail.css';
import storage from '../services/storage';
import { SkeletonDetail } from './Skeleton';
import { Play, Heart, Film, Volume2, VolumeX, User, Star, ChevronDown } from 'lucide-react';

import { useTrailerCycle } from '../hooks/useTrailerCycle';


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
  const [pulsingFav, setPulsingFav]           = useState(false);
  const [networkError, setNetworkError] = useState(false);
  
  const [openSections, setOpenSections] = useState({ trailer: false, reviews: false, similar: false });
  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    setOpenSections({ trailer: false, reviews: false, similar: false });
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
    const data = await getMovieCredits(movieId);
    setCast(data.cast.slice(0, 20));
    setCrew(data.crew);
  };

  const loadVideos = async (movieId) => {
    const data = await getMovieVideos(movieId);
    const sorted = [...data.results].sort((a, b) => {
      if (a.type === 'Trailer' && b.type !== 'Trailer') return -1;
      if (a.type !== 'Trailer' && b.type === 'Trailer') return 1;
      if (a.official && !b.official) return -1;
      if (!a.official && b.official) return 1;
      return 0;
    });
    setVideos(sorted);
  };

  const loadCertification = async (movieId) => {
    const data = await getMovieCertification(movieId);
    const usRelease = data.results.find(r => r.iso_3166_1 === 'US');
    const itRelease = data.results.find(r => r.iso_3166_1 === 'IT');
    const cert = itRelease?.release_dates[0]?.certification ||
                 usRelease?.release_dates[0]?.certification || null;
    setCertification(cert);
  };

  const loadRecommendations = async (movieId) => {
    const data = await getMovieRecommendations(movieId);
    setRecommendations(data.results.slice(0, 12));
  };

  const loadReviews = async (movieId) => {
    const data = await getMovieReviews(movieId);
    setReviews(data.results.slice(0, 10));
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
    setPulsingFav(true);
    setTimeout(() => setPulsingFav(false), 500);
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

  // Hook sempre prima degli early return
  const { showIframe, trailerVisible, trailerSrc, isMuted, iframeRef, toggleMute } =
    useTrailerCycle(id, 'movie');

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
          HERO SECTION - BACKDROP + TRAILER LOOP
          ======================================== */}
      <div className="movie-hero">

        {/* Layer 1: immagine fissa */}
        <div
          className="movie-hero-bg"
          style={{ backgroundImage: `url(${getBackdropUrl(movieDetails.backdrop_path)})` }}
        />

        {/* Layer 2: trailer iframe (loop automatico) */}
        {showIframe && trailerSrc && (
          <div className={`movie-hero-trailer${trailerVisible ? ' visible' : ''}`}>
            <iframe
              ref={iframeRef}
              src={trailerSrc}
              frameBorder="0"
              allow="autoplay; encrypted-media"
              title="trailer"
            />
            <div className="movie-hero-trailer-mask" />
          </div>
        )}

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
            
            {/* Descrizione — 3 righe, si espande al hover come HeroSection */}
            {movieDetails.overview && (
              <p className="movie-overview">{movieDetails.overview}</p>
            )}
            
            {/* ========================================
                BOTTONI AZIONI
                ======================================== */}
            <div className="movie-actions">
              <button className="md-btn-play" onClick={playMovie}>
                <Play size={20} fill="currentColor" />
                Riproduci
              </button>
              <button
                className={`md-btn-fav${isFavoriteMovie ? ' active' : ''}${pulsingFav ? ' heart-pulse' : ''}`}
                onClick={toggleFavorites}
                aria-label={isFavoriteMovie ? 'Rimuovi dai Preferiti' : 'Aggiungi ai Preferiti'}
              >
                <Heart size={20} fill={isFavoriteMovie ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        </div>

        {/* Pulsante mute — compare solo quando il trailer è visibile */}
        {showIframe && trailerVisible && (
          <button className="detail-mute-btn" onClick={toggleMute} aria-label={isMuted ? 'Attiva audio' : 'Disattiva audio'}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}
      </div>

      {/* ========================================
          PAGINA SCORREVOLE: Info + Cast | Trailer | Recensioni
          ======================================== */}
      <div className="movie-scroll-content">

        {/* ── Riga principale: Info (sx) + Cast (dx) ── */}
        <div className="movie-main-row">

          {/* Metadata */}
          <div className="info-meta">
            <div className="info-group">
              {director && (
                <div className="info-row">
                  <span className="info-label">Regia</span>
                  <span className="info-value">{director.name}</span>
                </div>
              )}
              {getScreenwriter() && (
                <div className="info-row">
                  <span className="info-label">Sceneggiatura</span>
                  <span className="info-value">{getScreenwriter().name}</span>
                </div>
              )}
              {getProducers().length > 0 && (
                <div className="info-row">
                  <span className="info-label">Produttori</span>
                  <span className="info-value">{getProducers().map(p => p.name).join(', ')}</span>
                </div>
              )}
            </div>
            {(movieDetails.budget > 0 || movieDetails.revenue > 0) && (
              <div className="info-group">
                {movieDetails.budget > 0 && (
                  <div className="info-row">
                    <span className="info-label">Budget</span>
                    <span className="info-value">${(movieDetails.budget / 1_000_000).toFixed(0)}M</span>
                  </div>
                )}
                {movieDetails.revenue > 0 && (
                  <div className="info-row">
                    <span className="info-label">Incasso</span>
                    <span className="info-value">${(movieDetails.revenue / 1_000_000).toFixed(0)}M</span>
                  </div>
                )}
              </div>
            )}
            {movieDetails.spoken_languages?.length > 0 && (
              <div className="info-group">
                <div className="info-row">
                  <span className="info-label">Lingua originale</span>
                  <span className="info-value">
                    {movieDetails.spoken_languages.map(l => l.english_name).join(', ')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Cast — max 8 */}
          {cast.length > 0 && (
            <div className="movie-cast-col">
              <h2 className="section-label">Cast</h2>
              <div className="cast-compact-grid">
                {cast.slice(0, 8).map(actor => (
                  <div key={actor.id} className="cast-compact-item">
                    {actor.profile_path ? (
                      <img
                        className="cast-compact-photo"
                        src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                        alt={actor.name}
                        loading="lazy"
                      />
                    ) : (
                      <div className="cast-compact-photo cast-compact-placeholder">
                        <User size={20} />
                      </div>
                    )}
                    <div className="cast-compact-info">
                      <p className="cast-compact-name">{actor.name}</p>
                      <p className="cast-compact-char">{actor.character}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Trailer — a scomparsa ── */}
        {trailer && (
          <div className="movie-section">
            <button className="section-toggle" onClick={() => toggleSection('trailer')}>
              <span className="section-label">Trailer</span>
              <ChevronDown size={18} className={`section-chevron${openSections.trailer ? ' open' : ''}`} />
            </button>
            <div className={`section-body${openSections.trailer ? ' open' : ''}`}>
              <div className="section-body-inner">
                <div className="trailer-embed">
                  <iframe
                    src={`https://www.youtube.com/embed/${trailer.key}`}
                    title={trailer.name}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Recensioni — a scomparsa ── */}
        {reviews.length > 0 && (
          <div className="movie-section">
            <button className="section-toggle" onClick={() => toggleSection('reviews')}>
              <span className="section-label">Recensioni</span>
              <ChevronDown size={18} className={`section-chevron${openSections.reviews ? ' open' : ''}`} />
            </button>
            <div className={`section-body${openSections.reviews ? ' open' : ''}`}>
              <div className="section-body-inner">
                {reviews.slice(0, 5).map(review => (
                  <div key={review.id} className="review-card">
                    <div className="review-header">
                      <div className="review-author">
                        <strong>{review.author}</strong>
                        {review.author_details?.rating && (
                          <span className="review-rating">
                            <Star size={12} fill="currentColor" style={{ color: '#feca57' }} />
                            {review.author_details.rating}/10
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
            </div>
          </div>
        )}

      </div>

      {/* ── Film Simili — a scomparsa ── */}
      {recommendations.length > 0 && (
        <div className="movie-similar-section">
          <button className="section-toggle" onClick={() => toggleSection('similar')}>
            <span className="section-label">Film Simili</span>
            <ChevronDown size={18} className={`section-chevron${openSections.similar ? ' open' : ''}`} />
          </button>
          <div className={`section-body${openSections.similar ? ' open' : ''}`}>
            <div className="section-body-inner">
              <MovieCarousel title="" items={recommendations} type="movie" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MovieDetail;