import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  searchMoviesPage,
  searchTVShowsPage,
  getTrendingMovies,
  getTrendingTVShows,
} from '../services/tmdbApi';
import SearchResultsGrid from './SearchResultsGrid';
import { NetworkErrorInline } from './NetworkError';
import { isNetworkError } from '../utils/networkUtils';
import { SkeletonCarousel } from './Skeleton';
import MovieCarousel from './MovieCarousel';
import { Search, X, Clock, Trash2, Film, Tv } from 'lucide-react';
import storage from '../services/storage';
import './SearchComponent.css';

const SORT_OPTIONS = [
  { value: 'popularity',   label: 'Popolarità' },
  { value: 'rating',       label: 'Voto' },
  { value: 'date',         label: 'Data' },
  { value: 'alphabetical', label: 'A–Z' },
];
const MAX_HISTORY  = 15;
const THUMB_BASE   = 'https://image.tmdb.org/t/p/w92';

// ── UTILITY: raggruppa per data ──────────────────────────────────────────────
function groupByDate(history) {
  const now       = new Date();
  const todayStr  = now.toDateString();
  const yestStr   = new Date(now - 86_400_000).toDateString();
  const weekAgo   = new Date(now - 7 * 86_400_000);
  const groups    = [];
  const buckets   = { oggi: [], ieri: [], settimana: [], altro: [] };

  history.forEach(item => {
    const d = new Date(item.timestamp);
    if      (d.toDateString() === todayStr) buckets.oggi.push(item);
    else if (d.toDateString() === yestStr)  buckets.ieri.push(item);
    else if (d >= weekAgo)                  buckets.settimana.push(item);
    else                                    buckets.altro.push(item);
  });

  if (buckets.oggi.length)      groups.push({ label: 'Oggi',           items: buckets.oggi });
  if (buckets.ieri.length)      groups.push({ label: 'Ieri',           items: buckets.ieri });
  if (buckets.settimana.length) groups.push({ label: 'Questa settimana', items: buckets.settimana });
  if (buckets.altro.length)     groups.push({ label: 'Più vecchio',    items: buckets.altro });
  return groups;
}

// ── COMPONENTE ────────────────────────────────────────────────────────────────
function SearchComponent() {
  const inputRef       = useRef(null);
  const dropdownRef    = useRef(null);
  const loadingMoreRef = useRef(false);
  const historyRef     = useRef([]);     // copia stabile per evitare stale closure

  const [query, setQuery]               = useState('');
  const [movieResults, setMovieResults] = useState([]);
  const [tvResults, setTvResults]       = useState([]);
  const [loading, setLoading]           = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [hasSearched, setHasSearched]   = useState(false);
  const [contentType, setContentType]   = useState('all');
  const [sortOrder, setSortOrder]       = useState('popularity');
  const [networkError, setNetworkError] = useState(false);

  const [moviePage, setMoviePage]             = useState(1);
  const [tvPage, setTvPage]                   = useState(1);
  const [movieTotalPages, setMovieTotalPages] = useState(0);
  const [tvTotalPages, setTvTotalPages]       = useState(0);

  // Stato vuoto
  const [trendingMovies, setTrendingMovies]   = useState([]);
  const [trendingTV, setTrendingTV]           = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);

  // Cronologia
  const [searchHistory, setSearchHistory]     = useState([]);
  const [confirmClear, setConfirmClear]       = useState(false);

  // Dropdown autocomplete
  const [showDropdown, setShowDropdown]       = useState(false);
  const [dropdownIndex, setDropdownIndex]     = useState(-1);

  // Tieni historyRef sincronizzato
  useEffect(() => { historyRef.current = searchHistory; }, [searchHistory]);

  // ── INIT ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    storage.getSearchHistory().then(h => { setSearchHistory(h); historyRef.current = h; });
    Promise.all([getTrendingMovies(), getTrendingTVShows()]).then(([m, tv]) => {
      setTrendingMovies(m);
      setTrendingTV(tv);
      setLoadingTrending(false);
    });
    inputRef.current?.focus();
  }, []);

  // Chiudi dropdown cliccando fuori
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── CRONOLOGIA ──────────────────────────────────────────────────────────────
  const addToHistory = (q, firstResult) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const filtered = historyRef.current.filter(
      h => h.query.toLowerCase() !== trimmed.toLowerCase()
    );
    const updated = [{
      query: trimmed,
      timestamp: Date.now(),
      poster: firstResult?.poster_path || null,
      type:   firstResult?.type || null,
    }, ...filtered].slice(0, MAX_HISTORY);
    setSearchHistory(updated);
    historyRef.current = updated;
    storage.saveSearchHistory(updated);
  };

  const removeFromHistory = async (q, e) => {
    e.stopPropagation();
    const updated = historyRef.current.filter(h => h.query !== q);
    setSearchHistory(updated);
    historyRef.current = updated;
    await storage.saveSearchHistory(updated);
  };

  const clearHistory = async () => {
    setSearchHistory([]);
    historyRef.current = [];
    setConfirmClear(false);
    await storage.saveSearchHistory([]);
  };

  const handleClearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    } else {
      clearHistory();
    }
  };

  // ── DROPDOWN ────────────────────────────────────────────────────────────────
  const dropdownItems = query.trim()
    ? historyRef.current.filter(h =>
        h.query.toLowerCase().includes(query.toLowerCase()) &&
        h.query.toLowerCase() !== query.toLowerCase()
      ).slice(0, 6)
    : [];

  const selectDropdownItem = (item) => {
    setQuery(item.query);
    setShowDropdown(false);
    setDropdownIndex(-1);
    performSearch(item.query);
  };

  const handleInputKeyDown = (e) => {
    if (!showDropdown || dropdownItems.length === 0) {
      if (e.key === 'Enter') performSearch(query);
      if (e.key === 'Escape') setShowDropdown(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownIndex(i => Math.min(i + 1, dropdownItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDropdownIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (dropdownIndex >= 0) selectDropdownItem(dropdownItems[dropdownIndex]);
      else performSearch(query);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setDropdownIndex(-1);
    }
  };

  // ── PAGINAZIONE ─────────────────────────────────────────────────────────────
  const resetPagination = () => {
    setMoviePage(1); setTvPage(1);
    setMovieTotalPages(0); setTvTotalPages(0);
    setMovieResults([]); setTvResults([]);
  };

  // ── RICERCA ─────────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const performSearch = useCallback(async (searchQuery) => {
    const q = searchQuery.trim();
    if (!q) {
      resetPagination();
      setHasSearched(false);
      setLoading(false);
      setNetworkError(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setNetworkError(false);
    setShowDropdown(false);
    resetPagination();

    try {
      const [mRes, tRes] = await Promise.all([
        searchMoviesPage(q, 1),
        searchTVShowsPage(q, 1),
      ]);

      // Salva in cronologia SOLO se ci sono risultati
      const hasResults = mRes.results.length > 0 || tRes.results.length > 0;
      if (hasResults) {
        const first = mRes.results[0] || tRes.results[0];
        addToHistory(q, first);
      }

      setMovieResults(mRes.results);
      setTvResults(tRes.results);
      setMoviePage(1); setMovieTotalPages(mRes.totalPages);
      setTvPage(1);    setTvTotalPages(tRes.totalPages);
    } catch (error) {
      if (isNetworkError(error)) setNetworkError(true);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length >= 1) performSearch(query);
      else { resetPagination(); setHasSearched(false); setLoading(false); setNetworkError(false); }
    }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, performSearch]);

  // ── LOAD MORE ───────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const canMovie = moviePage < movieTotalPages;
    const canTV    = tvPage < tvTotalPages;
    if (!canMovie && !canTV) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const fetches = [];
      if (canMovie) fetches.push(searchMoviesPage(query, moviePage + 1).then(r => ({ kind: 'movie', ...r, next: moviePage + 1 })));
      if (canTV)    fetches.push(searchTVShowsPage(query, tvPage + 1).then(r => ({ kind: 'tv',    ...r, next: tvPage + 1 })));
      (await Promise.all(fetches)).forEach(r => {
        if (r.kind === 'movie') { setMovieResults(p => [...p, ...r.results]); setMoviePage(r.next); setMovieTotalPages(r.totalPages); }
        else                   { setTvResults(p => [...p, ...r.results]);    setTvPage(r.next);    setTvTotalPages(r.totalPages); }
      });
    } catch { /* silently fail */ }

    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, [moviePage, tvPage, movieTotalPages, tvTotalPages, query]);

  const clearSearch = () => {
    setQuery('');
    resetPagination();
    setHasSearched(false);
    setLoading(false);
    setNetworkError(false);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  // ── FILTRA E ORDINA ─────────────────────────────────────────────────────────
  const getFiltered = (results, type) => contentType !== 'all' && contentType !== type ? [] : results;
  const getSorted   = (items) => {
    const c = [...items];
    switch (sortOrder) {
      case 'alphabetical': return c.sort((a, b) => (a.title || a.name || '').toLowerCase().localeCompare((b.title || b.name || '').toLowerCase()));
      case 'date':         return c.sort((a, b) => new Date(b.release_date || b.first_air_date || 0) - new Date(a.release_date || a.first_air_date || 0));
      case 'rating':       return c.sort((a, b) => b.vote_average - a.vote_average);
      default:             return c.sort((a, b) => b.popularity - a.popularity);
    }
  };

  const combinedItems = getSorted([...getFiltered(movieResults, 'movie'), ...getFiltered(tvResults, 'tv')]);
  const hasMore       = moviePage < movieTotalPages || tvPage < tvTotalPages;
  const historyGroups = groupByDate(searchHistory);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="search-component">

      {/* HEADER STICKY */}
      <div className="search-header">
        <div className="search-bar-row">

          {/* Input + Dropdown */}
          <div className="search-input-wrapper" ref={dropdownRef}>
            <Search size={18} className="search-icon-inside" />
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Cerca film, serie TV, attori..."
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDropdown(true); setDropdownIndex(-1); }}
              onFocus={() => { if (query.trim()) setShowDropdown(true); }}
              onKeyDown={handleInputKeyDown}
            />
            {query && (
              <button className="search-clear-inline" onClick={clearSearch} aria-label="Cancella">
                <X size={16} />
              </button>
            )}

            {/* Dropdown autocomplete */}
            {showDropdown && dropdownItems.length > 0 && (
              <ul className="search-dropdown">
                {dropdownItems.map((item, i) => (
                  <li
                    key={item.query + item.timestamp}
                    className={`dropdown-item ${i === dropdownIndex ? 'focused' : ''}`}
                    onMouseDown={() => selectDropdownItem(item)}
                    onMouseEnter={() => setDropdownIndex(i)}
                  >
                    {item.poster ? (
                      <img
                        src={`${THUMB_BASE}${item.poster}`}
                        alt=""
                        className="dropdown-thumb"
                        loading="lazy"
                      />
                    ) : (
                      <div className="dropdown-thumb-placeholder">
                        {item.type === 'tv' ? <Tv size={14} /> : <Film size={14} />}
                      </div>
                    )}
                    <span className="dropdown-query">{item.query}</span>
                    <Search size={13} className="dropdown-icon-right" />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tipo */}
          <div className="type-pills">
            {[['all','Tutti'],['movie','Film'],['tv','Serie TV']].map(([val, label]) => (
              <button key={val} className={`type-pill ${contentType === val ? 'active' : ''}`} onClick={() => setContentType(val)}>
                {label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select className="sort-select" value={sortOrder} onChange={e => setSortOrder(e.target.value)} aria-label="Ordina per">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* ERRORE RETE */}
      {networkError && !loading && (
        <NetworkErrorInline message="Impossibile caricare i risultati." onRetry={() => performSearch(query)} />
      )}

      {/* STATO VUOTO */}
      {!hasSearched && !loading && (
        <div className="search-empty-state">

          {/* CRONOLOGIA */}
          <section className="history-section">
            <div className="section-header">
              <h2 className="section-title"><Clock size={17} /> Cronologia</h2>
              {searchHistory.length > 0 && (
                <button
                  className={`history-clear-btn ${confirmClear ? 'confirm' : ''}`}
                  onClick={handleClearAll}
                >
                  <Trash2 size={13} />
                  {confirmClear ? 'Conferma cancellazione' : 'Cancella tutto'}
                </button>
              )}
            </div>

            {historyGroups.length > 0 ? (
              historyGroups.map(group => (
                <div key={group.label} className="history-group">
                  <p className="history-group-label">{group.label}</p>
                  <ul className="history-list">
                    {group.items.map(item => (
                      <li key={item.query + item.timestamp} className="history-item">
                        <button className="history-item-text" onClick={() => { setQuery(item.query); performSearch(item.query); }}>
                          {item.poster ? (
                            <img src={`${THUMB_BASE}${item.poster}`} alt="" className="history-thumb" loading="lazy" />
                          ) : (
                            <div className="history-thumb-placeholder">
                              {item.type === 'tv' ? <Tv size={13} /> : item.type === 'movie' ? <Film size={13} /> : <Search size={13} />}
                            </div>
                          )}
                          <span className="history-query">{item.query}</span>
                          <span className="history-date">{new Date(item.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                        </button>
                        <button className="history-item-remove" onClick={(e) => removeFromHistory(item.query, e)} aria-label="Rimuovi">
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="history-empty">Le tue ricerche recenti appariranno qui</p>
            )}
          </section>

          {/* TRENDING */}
          <section className="trending-section">
            {loadingTrending ? (
              <><SkeletonCarousel /><SkeletonCarousel /></>
            ) : (
              <>
                {trendingMovies.length > 0 && <MovieCarousel title="Film di Tendenza" items={trendingMovies} type="movie" />}
                {trendingTV.length > 0      && <MovieCarousel title="Serie TV di Tendenza" items={trendingTV} type="tv" />}
              </>
            )}
          </section>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="search-results-area">
          <div className="search-skeleton-grid">
            {Array.from({ length: 16 }).map((_, i) => <div key={i} className="skeleton skeleton-grid-card" />)}
          </div>
        </div>
      )}

      {/* RISULTATI */}
      {hasSearched && !loading && !networkError && (
        <div className="search-results-area">
          {combinedItems.length > 0 ? (
            <SearchResultsGrid items={combinedItems} query={query} hasMore={hasMore} onLoadMore={handleLoadMore} loadingMore={loadingMore} />
          ) : (
            <div className="search-no-results">
              <p className="no-results-title">Nessun risultato per "{query}"</p>
              <p className="no-results-sub">Prova con termini diversi o cambia il filtro tipo</p>
              <button className="no-results-btn" onClick={clearSearch}>Nuova ricerca</button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default SearchComponent;
