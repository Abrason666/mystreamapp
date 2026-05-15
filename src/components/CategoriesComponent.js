import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { discoverByGenrePage, searchInGenre, getImageUrl } from '../services/tmdbApi';
import SmartImage from './SmartImage';
import storage from '../services/storage';
import { SkeletonGrid } from './Skeleton';
import { Play, Heart, Film, Tv, X, Star, Check, Search } from 'lucide-react';
import './CategoriesComponent.css';

const MOVIE_GENRES = [
  { id: 28,    name: 'Azione' },
  { id: 12,    name: 'Avventura' },
  { id: 16,    name: 'Animazione' },
  { id: 35,    name: 'Commedia' },
  { id: 80,    name: 'Crime' },
  { id: 99,    name: 'Documentario' },
  { id: 18,    name: 'Drammatico' },
  { id: 10751, name: 'Famiglia' },
  { id: 14,    name: 'Fantasy' },
  { id: 36,    name: 'Storico' },
  { id: 27,    name: 'Horror' },
  { id: 10402, name: 'Musical' },
  { id: 9648,  name: 'Mistero' },
  { id: 10749, name: 'Romantico' },
  { id: 878,   name: 'Fantascienza' },
  { id: 10770, name: 'Film TV' },
  { id: 53,    name: 'Thriller' },
  { id: 10752, name: 'Guerra' },
  { id: 37,    name: 'Western' },
];

const TV_GENRES = [
  { id: 10759, name: 'Azione e Avventura' },
  { id: 16,    name: 'Animazione' },
  { id: 35,    name: 'Commedia' },
  { id: 80,    name: 'Crime' },
  { id: 99,    name: 'Documentario' },
  { id: 18,    name: 'Drammatico' },
  { id: 10751, name: 'Famiglia' },
  { id: 10762, name: 'Bambini' },
  { id: 9648,  name: 'Mistero' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk Show' },
  { id: 10768, name: 'Guerra & Politica' },
  { id: 37,    name: 'Western' },
];

const SORT_OPTIONS = [
  { value: 'popularity', label: 'Popolarità' },
  { value: 'rating',     label: 'Voto' },
  { value: 'date',       label: 'Data di uscita' },
];

function CategoriesComponent() {
  const navigate = useNavigate();

  const [selectedGenre, setSelectedGenre]   = useState(null);
  const [loading, setLoading]               = useState(false);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [items, setItems]                   = useState([]);
  const [currentPage, setCurrentPage]       = useState(0);
  const [totalPages, setTotalPages]         = useState(0);
  const [sortBy, setSortBy]                 = useState('popularity');
  const [searchQuery, setSearchQuery]       = useState('');
  const [activeQuery, setActiveQuery]       = useState('');
  const [localFavorites, setLocalFavorites] = useState([]);
  const [pulsingId, setPulsingId]           = useState(null);

  const sentinelRef         = useRef(null);
  const contentRef          = useRef(null);
  const loadingMoreRef      = useRef(false);
  const searchDebounceTimer = useRef(null);
  const pendingScroll       = useRef(null);

  const isSearchMode = activeQuery.length > 0;
  const hasMore      = currentPage < totalPages;
  const hasMoreRef   = useRef(hasMore);
  hasMoreRef.current = hasMore;

  // Nasconde la scrollbar di window + pulisce debounce su unmount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      clearTimeout(searchDebounceTimer.current);
    };
  }, []);

  // ── Preferiti ────────────────────────────────────────────────────────────
  useEffect(() => {
    storage.getFavorites().then(setLocalFavorites);
    const onFavChange = (e) => {
      if (e.detail?.favorites) setLocalFavorites(e.detail.favorites);
    };
    window.addEventListener('favoritesChanged', onFavChange);
    return () => window.removeEventListener('favoritesChanged', onFavChange);
  }, []);

  // ── Ripristino stato al ritorno ───────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem('cat_restore');
    if (!raw) return;
    sessionStorage.removeItem('cat_restore');
    const { genre, savedPage, scrollY, savedSort } = JSON.parse(raw);
    pendingScroll.current = scrollY;
    restoreState(genre, savedPage, savedSort || 'popularity');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pendingScroll.current !== null && items.length > 0) {
      const y = pendingScroll.current;
      pendingScroll.current = null;
      requestAnimationFrame(() => contentRef.current?.scrollTo({ top: y, behavior: 'instant' }));
    }
  }, [items.length]);

  // ── Fetch centrale ────────────────────────────────────────────────────────
  const fetchData = useCallback(async ({ genre, page, sort, query, reset }) => {
    if (reset) {
      setLoading(true);
      setItems([]);
      setCurrentPage(0);
      setTotalPages(0);
    } else {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    try {
      const data = query.trim()
        ? await searchInGenre(query.trim(), genre.id, genre.type, page)
        : await discoverByGenrePage(genre.id, genre.type, page, sort);

      setItems(prev => reset ? data.results : [...prev, ...data.results]);
      setCurrentPage(page);
      setTotalPages(data.totalPages);
    } catch { /* silently fail */ }

    if (reset) {
      setLoading(false);
    } else {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  // ── Ripristina N pagine dalla cache ───────────────────────────────────────
  const restoreState = async (genre, savedPage, savedSort) => {
    setSelectedGenre(genre);
    setSortBy(savedSort);
    setLoading(true);
    try {
      const pages = await Promise.all(
        Array.from({ length: savedPage }, (_, i) =>
          discoverByGenrePage(genre.id, genre.type, i + 1, savedSort)
        )
      );
      setItems(pages.flatMap(p => p.results));
      setCurrentPage(savedPage);
      setTotalPages(pages[pages.length - 1]?.totalPages || 0);
    } catch { /* silently fail */ }
    setLoading(false);
  };

  // ── Cambio genere ─────────────────────────────────────────────────────────
  const handleGenreClick = (genre, type) => {
    if (selectedGenre?.id === genre.id && selectedGenre?.type === type) return;
    const genreObj = { ...genre, type };
    setSelectedGenre(genreObj);
    setSortBy('popularity');
    setSearchQuery('');
    setActiveQuery('');
    clearTimeout(searchDebounceTimer.current);
    fetchData({ genre: genreObj, page: 1, sort: 'popularity', query: '', reset: true });
  };

  // ── Cambio ordinamento (server-side) ──────────────────────────────────────
  const handleSortChange = (newSort) => {
    if (!selectedGenre || isSearchMode) return;
    setSortBy(newSort);
    fetchData({ genre: selectedGenre, page: 1, sort: newSort, query: '', reset: true });
  };

  // ── Ricerca con debounce (vera chiamata TMDB filtrata per genere) ──────────
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    clearTimeout(searchDebounceTimer.current);

    if (!value.trim()) {
      setActiveQuery('');
      if (selectedGenre) {
        fetchData({ genre: selectedGenre, page: 1, sort: sortBy, query: '', reset: true });
      }
      return;
    }

    searchDebounceTimer.current = setTimeout(() => {
      setActiveQuery(value.trim());
      fetchData({ genre: selectedGenre, page: 1, sort: sortBy, query: value.trim(), reset: true });
    }, 400);
  };

  // ── Infinite scroll ───────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || !selectedGenre || loadingMoreRef.current) return;
    fetchData({
      genre: selectedGenre,
      page:  currentPage + 1,
      sort:  sortBy,
      query: activeQuery,
      reset: false,
    });
  }, [selectedGenre, currentPage, sortBy, activeQuery, fetchData]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { root: contentRef.current, threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // ── Navigazione ───────────────────────────────────────────────────────────
  const saveRestoreState = () => {
    sessionStorage.setItem('cat_restore', JSON.stringify({
      genre: selectedGenre,
      savedPage: currentPage,
      scrollY: contentRef.current?.scrollTop || 0,
      savedSort: sortBy,
    }));
  };

  const handleItemClick = (item) => {
    saveRestoreState();
    navigate(selectedGenre?.type === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`);
  };

  const handlePlayClick = async (item, e) => {
    e.stopPropagation();
    saveRestoreState();
    if (selectedGenre?.type === 'tv') {
      const cw = await storage.getContinueWatching(item.id);
      navigate(cw?.seasonNumber
        ? `/player/tv/${item.id}/${cw.seasonNumber}/${cw.episodeNumber}`
        : `/player/tv/${item.id}/1/1`
      );
    } else {
      navigate(`/player/movie/${item.id}`);
    }
  };

  // ── Preferiti ────────────────────────────────────────────────────────────
  const toggleFavorite = async (item, e) => {
    e.stopPropagation();
    const favorites = await storage.getFavorites();
    const itemType  = selectedGenre.type;
    const already   = favorites.some(f => f.id === item.id && f.type === itemType);
    const updated   = already
      ? favorites.filter(f => !(f.id === item.id && f.type === itemType))
      : [...favorites, { ...item, type: itemType }];
    await storage.saveFavorites(updated);
    setLocalFavorites(updated);
    window.dispatchEvent(new CustomEvent('favoritesChanged', { detail: { favorites: updated } }));
    setPulsingId(item.id);
    setTimeout(() => setPulsingId(null), 500);
  };

  const isFav = (item) =>
    selectedGenre
      ? localFavorites.some(f => f.id === item.id && f.type === selectedGenre.type)
      : false;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="categories-layout">

      {/* ── SIDEBAR ── */}
      <aside className="categories-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <Film size={16} /><span>Film</span>
          </div>
          {MOVIE_GENRES.map(g => (
            <button
              key={`m-${g.id}`}
              className={`sidebar-genre-btn ${selectedGenre?.id === g.id && selectedGenre?.type === 'movie' ? 'active' : ''}`}
              onClick={() => handleGenreClick(g, 'movie')}
            >
              {g.name}
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <Tv size={16} /><span>Serie TV</span>
          </div>
          {TV_GENRES.map(g => (
            <button
              key={`t-${g.id}`}
              className={`sidebar-genre-btn ${selectedGenre?.id === g.id && selectedGenre?.type === 'tv' ? 'active' : ''}`}
              onClick={() => handleGenreClick(g, 'tv')}
            >
              {g.name}
            </button>
          ))}
        </div>
      </aside>

      {/* ── CONTENT ── */}
      <div className="categories-content" ref={contentRef}>
        {!selectedGenre && (
          <div className="categories-placeholder">
            <p>Seleziona una categoria dalla lista per esplorare</p>
          </div>
        )}

        {selectedGenre && !loading && (
          <div className="results-topbar">
            <h2 className="results-heading">
              {selectedGenre.name}
              <span className="results-type-badge">
                {selectedGenre.type === 'movie' ? 'Film' : 'Serie TV'}
              </span>
            </h2>

            {items.length > 0 && (
              <div className="topbar-right">
                {items.length > 0 && (
                  <span className="results-count">
                    {isSearchMode ? `${items.length} risultati` : `${items.length} caricati`}
                  </span>
                )}
                {!isSearchMode && (
                  <div className="sort-bar">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        className={`sort-btn ${sortBy === opt.value ? 'active' : ''}`}
                        onClick={() => handleSortChange(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="category-search-bar">
                  <Search size={14} className="category-search-icon" />
                  <input
                    className="category-search-input"
                    type="text"
                    placeholder={`Cerca in ${selectedGenre.name}…`}
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="category-search-clear"
                      onClick={() => handleSearchChange('')}
                      aria-label="Cancella ricerca"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {loading && <SkeletonGrid count={16} />}

        {!loading && items.length > 0 && (
          <div className="results-grid">
            {items.map(item => {
              const fav = isFav(item);
              return (
                <div key={item.id} className="result-card" onClick={() => handleItemClick(item)}>
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
                        <p className="result-meta">
                          <Star size={11} fill="currentColor" style={{ color: '#feca57', verticalAlign: 'middle' }} />
                          {' '}{item.vote_average?.toFixed(1) || 'N/A'}
                          {' · '}
                          {(item.release_date || item.first_air_date)
                            ? new Date(item.release_date || item.first_air_date).getFullYear()
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="result-actions">
                        <button className="result-btn" onClick={(e) => handlePlayClick(item, e)} aria-label="Riproduci">
                          <Play size={16} fill="currentColor" />
                        </button>
                        <button
                          className={`result-btn ${fav ? 'result-btn-fav' : ''} ${pulsingId === item.id ? 'heart-pulse' : ''}`}
                          onClick={(e) => toggleFavorite(item, e)}
                          aria-label={fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                        >
                          <Heart size={16} fill={fav ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sentinel infinite scroll */}
        <div ref={sentinelRef} style={{ height: 1 }} />

        {loadingMore && (
          <div className="load-more-spinner-wrap">
            <div className="load-more-spinner" />
          </div>
        )}

        {!loading && !hasMore && items.length > 0 && !isSearchMode && (
          <p className="end-label">
            <Check size={14} /> Tutti i titoli di {selectedGenre?.name} caricati
          </p>
        )}

        {!loading && selectedGenre && items.length === 0 && (
          <div className="categories-placeholder">
            <p>{isSearchMode ? `Nessun risultato per "${activeQuery}" in ${selectedGenre.name}.` : 'Nessun contenuto trovato per questo genere.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CategoriesComponent;
