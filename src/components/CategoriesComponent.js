import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { discoverByGenrePage } from '../services/tmdbApi';
import { getImageUrl } from '../services/tmdbApi';
import SmartImage from './SmartImage';
import storage from '../services/storage';
import { SkeletonGrid } from './Skeleton';
import { Play, Heart, Film, Tv, X, Star } from 'lucide-react';
import './CategoriesComponent.css';
import toast from 'react-hot-toast';

const MOVIE_GENRES = [
  { id: 28,    name: 'Azione',       emoji: '💥' },
  { id: 12,    name: 'Avventura',    emoji: '🗺️' },
  { id: 16,    name: 'Animazione',   emoji: '🎨' },
  { id: 35,    name: 'Commedia',     emoji: '😂' },
  { id: 80,    name: 'Crime',        emoji: '🔫' },
  { id: 99,    name: 'Documentario', emoji: '📽️' },
  { id: 18,    name: 'Drammatico',   emoji: '🎭' },
  { id: 10751, name: 'Famiglia',     emoji: '👨‍👩‍👧‍👦' },
  { id: 14,    name: 'Fantasy',      emoji: '🧙' },
  { id: 36,    name: 'Storico',      emoji: '📜' },
  { id: 27,    name: 'Horror',       emoji: '👻' },
  { id: 10402, name: 'Musical',      emoji: '🎵' },
  { id: 9648,  name: 'Mistero',      emoji: '🔍' },
  { id: 10749, name: 'Romantico',    emoji: '❤️' },
  { id: 878,   name: 'Fantascienza', emoji: '🚀' },
  { id: 10770, name: 'Film TV',      emoji: '📺' },
  { id: 53,    name: 'Thriller',     emoji: '😱' },
  { id: 10752, name: 'Guerra',       emoji: '⚔️' },
  { id: 37,    name: 'Western',      emoji: '🤠' },
];

const TV_GENRES = [
  { id: 10759, name: 'Azione e Avventura', emoji: '⚡' },
  { id: 16,    name: 'Animazione',         emoji: '🎨' },
  { id: 35,    name: 'Commedia',           emoji: '😄' },
  { id: 80,    name: 'Crime',              emoji: '🕵️' },
  { id: 99,    name: 'Documentario',       emoji: '🎥' },
  { id: 18,    name: 'Drammatico',         emoji: '🎬' },
  { id: 10751, name: 'Famiglia',           emoji: '👪' },
  { id: 10762, name: 'Bambini',            emoji: '👶' },
  { id: 9648,  name: 'Mistero',            emoji: '🔎' },
  { id: 10763, name: 'News',               emoji: '📰' },
  { id: 10764, name: 'Reality',            emoji: '🎤' },
  { id: 10765, name: 'Sci-Fi & Fantasy',   emoji: '🛸' },
  { id: 10766, name: 'Soap',               emoji: '💔' },
  { id: 10767, name: 'Talk Show',          emoji: '🗣️' },
  { id: 10768, name: 'Guerra & Politica',  emoji: '🏛️' },
  { id: 37,    name: 'Western',            emoji: '🌵' },
];

const SORT_OPTIONS = [
  { value: 'popularity', label: 'Popolarità' },
  { value: 'rating',     label: 'Voto' },
  { value: 'date',       label: 'Data' },
  { value: 'title',      label: 'Titolo A–Z' },
];

function applySort(items, sortBy, type) {
  const copy = [...items];
  switch (sortBy) {
    case 'rating':
      return copy.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    case 'date': {
      const key = type === 'tv' ? 'first_air_date' : 'release_date';
      return copy.sort((a, b) => new Date(b[key] || 0) - new Date(a[key] || 0));
    }
    case 'title':
      return copy.sort((a, b) =>
        (a.title || a.name || '').toLowerCase().localeCompare((b.title || b.name || '').toLowerCase())
      );
    default:
      return copy.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }
}

function CategoriesComponent() {
  const navigate = useNavigate();

  const [selectedGenre, setSelectedGenre]     = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [loadingMore, setLoadingMore]         = useState(false);
  const [items, setItems]                     = useState([]);
  const [currentPage, setCurrentPage]         = useState(0);
  const [totalPages, setTotalPages]           = useState(0);
  const [sortBy, setSortBy]                   = useState('popularity');
  const [categorySearch, setCategorySearch]   = useState('');
  const [localFavorites, setLocalFavorites]   = useState([]);

  const sentinelRef    = useRef(null);
  const hasMore        = currentPage < totalPages;
  const hasMoreRef     = useRef(hasMore);
  const loadingMoreRef = useRef(false);
  const pendingScroll  = useRef(null);
  hasMoreRef.current   = hasMore;

  useEffect(() => {
    storage.getFavorites().then(setLocalFavorites);
    const onFavChange = (e) => {
      if (e.detail?.favorites) setLocalFavorites(e.detail.favorites);
    };
    window.addEventListener('favoritesChanged', onFavChange);
    return () => window.removeEventListener('favoritesChanged', onFavChange);
  }, []);

  // Ripristina stato al ritorno dalla pagina dettaglio
  useEffect(() => {
    const raw = sessionStorage.getItem('cat_restore');
    if (!raw) return;
    sessionStorage.removeItem('cat_restore');

    const { genre, savedPage, scrollY } = JSON.parse(raw);
    pendingScroll.current = scrollY;
    restoreState(genre, savedPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scrolla alla posizione salvata una volta che gli item sono caricati
  useEffect(() => {
    if (pendingScroll.current !== null && items.length > 0) {
      const y = pendingScroll.current;
      pendingScroll.current = null;
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
    }
  }, [items.length]);

  const fetchPage = useCallback(async (genre, page) => {
    const { results, totalPages: tp } = await discoverByGenrePage(genre.id, genre.type, page);
    return { results, totalPages: tp };
  }, []);

  // Ricarica N pagine dalla cache per ripristinare lo stato precedente
  const restoreState = async (genre, savedPage) => {
    setSelectedGenre(genre);
    setLoading(true);
    try {
      const pages = await Promise.all(
        Array.from({ length: savedPage }, (_, i) => fetchPage(genre, i + 1))
      );
      const allItems = pages.flatMap(p => p.results);
      const tp = pages[pages.length - 1].totalPages;
      setItems(applySort(allItems, 'popularity', genre.type));
      setCurrentPage(savedPage);
      setTotalPages(tp);
    } catch { /* silently fail */ }
    setLoading(false);
  };

  const handleGenreClick = async (genre, type) => {
    if (selectedGenre?.id === genre.id && selectedGenre?.type === type) return;

    const genreObj = { ...genre, type };
    setSelectedGenre(genreObj);
    setLoading(true);
    setItems([]);
    setCurrentPage(0);
    setTotalPages(0);
    setSortBy('popularity');
    setCategorySearch('');

    try {
      const { results, totalPages: tp } = await fetchPage(genreObj, 1);
      setItems(applySort(results, 'popularity', type));
      setCurrentPage(1);
      setTotalPages(tp);
    } catch {
      setItems([]);
    }
    setLoading(false);
  };

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || !selectedGenre) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const nextPage = currentPage + 1;
      const { results } = await fetchPage(selectedGenre, nextPage);
      setItems(prev => applySort([...prev, ...results], sortBy, selectedGenre.type));
      setCurrentPage(nextPage);
    } catch { /* silently fail */ }

    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, [currentPage, selectedGenre, sortBy, fetchPage]);

  // Re-sort senza nuove API calls
  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setItems(prev => applySort([...prev], newSort, selectedGenre?.type));
  };

  // IntersectionObserver sul sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleItemClick = (item) => {
    // Salva stato per il ripristino al ritorno
    sessionStorage.setItem('cat_restore', JSON.stringify({
      genre: selectedGenre,
      savedPage: currentPage,
      scrollY: window.scrollY,
    }));
    navigate(selectedGenre?.type === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`);
  };

  const toggleFavorite = async (item, e) => {
    e.stopPropagation();
    const favorites = await storage.getFavorites();
    const itemType  = selectedGenre.type;
    const already   = favorites.some(f => f.id === item.id && f.type === itemType);
    const updated   = already
      ? favorites.filter(f => !(f.id === item.id && f.type === itemType))
      : [...favorites, { ...item, type: itemType }];
    await storage.saveFavorites(updated);
    toast(already ? 'Rimosso dai preferiti' : 'Aggiunto ai preferiti',
      { icon: already ? '💔' : '🧡' });
    setLocalFavorites(updated);
    window.dispatchEvent(new CustomEvent('favoritesChanged', { detail: { favorites: updated } }));
  };

  const isFav = (item) =>
    selectedGenre
      ? localFavorites.some(f => f.id === item.id && f.type === selectedGenre.type)
      : false;

  const visibleItems = categorySearch.trim()
    ? items.filter(i =>
        (i.title || i.name || '').toLowerCase().includes(categorySearch.toLowerCase())
      )
    : items;

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
              <span className="sidebar-emoji">{g.emoji}</span>
              <span>{g.name}</span>
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
              <span className="sidebar-emoji">{g.emoji}</span>
              <span>{g.name}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── CONTENT ── */}
      <div className="categories-content">
        {!selectedGenre && (
          <div className="categories-placeholder">
            <p>Seleziona una categoria dalla lista per esplorare</p>
          </div>
        )}

        {selectedGenre && !loading && (
          <div className="results-topbar">
            <h2 className="results-heading">
              <span className="results-emoji">{selectedGenre.emoji}</span>
              {selectedGenre.name}
              <span className="results-type-badge">
                {selectedGenre.type === 'movie' ? 'Film' : 'Serie TV'}
              </span>
              {items.length > 0 && (
                <span className="results-count">
                  {categorySearch
                    ? `${visibleItems.length} su ${items.length} titoli`
                    : `${items.length} titoli caricati`}
                </span>
              )}
            </h2>

            {items.length > 0 && (
              <div className="topbar-right">
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

                <div className="category-search-bar">
                  <input
                    className="category-search-input"
                    type="text"
                    placeholder={`Cerca in ${selectedGenre.name}...`}
                    value={categorySearch}
                    onChange={e => setCategorySearch(e.target.value)}
                  />
                  {categorySearch && (
                    <button className="category-search-clear" onClick={() => setCategorySearch('')} aria-label="Cancella ricerca">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {loading && <SkeletonGrid count={16} />}

        {!loading && visibleItems.length > 0 && (
          <div className="results-grid">
            {visibleItems.map(item => {
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
                        <button className="result-btn" onClick={(e) => { e.stopPropagation(); handleItemClick(item); }} aria-label="Dettagli">
                          <Play size={16} fill="currentColor" />
                        </button>
                        <button className={`result-btn ${fav ? 'result-btn-fav' : ''}`} onClick={(e) => toggleFavorite(item, e)} aria-label={fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}>
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

        {/* Sentinel per infinite scroll — disabilitato durante ricerca testuale */}
        {!categorySearch && <div ref={sentinelRef} style={{ height: 1 }} />}

        {loadingMore && (
          <div className="load-more-spinner-wrap">
            <div className="load-more-spinner" />
          </div>
        )}

        {!loading && !hasMore && items.length > 0 && (
          <p className="end-label">✓ Tutti i titoli di {selectedGenre?.name} caricati</p>
        )}

        {!loading && selectedGenre && items.length === 0 && !loading && (
          <div className="categories-placeholder">
            <p>Nessun contenuto trovato per questo genere.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CategoriesComponent;
