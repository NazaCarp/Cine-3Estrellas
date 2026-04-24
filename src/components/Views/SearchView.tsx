"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Movie } from '@/types';
import { searchMovies } from '@/lib/data';
import CarouselItem from '../Carousel/CarouselItem';

interface SearchViewProps {
  isActive: boolean;
  onMovieSelect: (movie: Movie) => void;
  onReturnToSidebar?: () => void;
  preventAutoScroll?: boolean;
}

const SearchView: React.FC<SearchViewProps> = ({ isActive, onMovieSelect, onReturnToSidebar, preventAutoScroll = false }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [focusArea, setFocusArea] = useState<'keyboard' | 'filters' | 'results'>('keyboard');
  const [keyboardPos, setKeyboardPos] = useState({ row: 0, col: 0 });
  const [filterIndex, setFilterIndex] = useState(0);
  const [resultIndex, setResultIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const lastTimeAtColZero = useRef<number>(0);
  const lastLeftPanelFocus = useRef<'keyboard' | 'filters'>('keyboard');
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusArea === 'results' && resultIndex < 5 && !preventAutoScroll && resultsContainerRef.current) {
      resultsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [focusArea, resultIndex, preventAutoScroll]);

  useEffect(() => {
    if (focusArea === 'keyboard' || focusArea === 'filters') {
      lastLeftPanelFocus.current = focusArea;
    }
  }, [focusArea]);

  const isAtLeftEdge = (focusArea === 'keyboard' && keyboardPos.col === 0) || 
                       (focusArea === 'filters' && filterIndex % 3 === 0);

  useEffect(() => {
    if (isAtLeftEdge) {
      lastTimeAtColZero.current = Date.now();
    } else {
      lastTimeAtColZero.current = 0;
    }
  }, [isAtLeftEdge]);

  const keyboardRows = [
    ['A', 'B', 'C', 'D', 'E', 'F'],
    ['G', 'H', 'I', 'J', 'K', 'L'],
    ['M', 'N', 'Ñ', 'O', 'P', 'Q'],
    ['R', 'S', 'T', 'U', 'V', 'W'],
    ['X', 'Y', 'Z', '1', '2', '3'],
    ['4', '5', '6', '7', '8', '9'],
    ['0', 'CLEAR', 'ESPACIO', 'BACKSPACE', 'BUSCAR']
  ];

  const quickFilters = ['Harry Potter', 'Star Wars', 'Marvel', 'Batman', 'Disney', 'Pixar'];

  const handleSearch = useCallback(async (searchQuery: string, newPage: number = 1) => {
    if (!searchQuery.trim()) return;
    
    if (newPage === 1) {
      setIsSearching(true);
      setResults([]);
      setLastSearchedQuery(searchQuery);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const { movies, count } = await searchMovies(searchQuery, newPage);
      
      setResults(prev => {
        if (newPage === 1) return movies;
        // Deduplicate: only add movies that aren't already in the list
        const newMovies = movies.filter(nm => !prev.some(pm => pm.id === nm.id));
        return [...prev, ...newMovies];
      });
      setTotalResults(count);
      setHasMore(newPage * 60 < count); 
      setPage(newPage);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  }, []);

  const handleKeyPress = useCallback((key: string) => {
    if (key === 'ESPACIO') {
      setQuery(prev => prev + ' ');
    } else if (key === 'BACKSPACE') {
      setQuery(prev => prev.slice(0, -1));
    } else if (key === 'CLEAR') {
      setQuery("");
    } else if (key === 'BUSCAR') {
      handleSearch(query, 1);
      setFocusArea('results');
      setResultIndex(0);
    } else {
      setQuery(prev => prev + key);
    }
  }, [query, handleSearch]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return;

    if (e.key === 'Enter' && e.ctrlKey) {
      handleSearch(query);
      setFocusArea('results');
      setResultIndex(0);
      return;
    }

    // Handle physical keyboard typing
    // Enter handles search execution
    if (e.key === 'Enter' && focusArea !== 'keyboard' && focusArea !== 'results') {
      handleSearch(query, 1);
      setFocusArea('results');
      setResultIndex(0);
      inputRef.current?.blur();
      return;
    }

    // Handle physical keyboard navigation and other specific keys
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace'].includes(e.key)) {
      // Allow the input to handle typing naturally if focused
      return;
    }

    if (focusArea === 'keyboard') {
      const maxRow = keyboardRows.length - 1;
      const maxCol = keyboardRows[keyboardPos.row].length - 1;

      switch (e.key) {
        case 'ArrowRight':
          if (keyboardPos.col < maxCol) {
            setKeyboardPos(prev => ({ ...prev, col: prev.col + 1 }));
          } else if (results.length > 0) {
            setFocusArea('results');
            // Try to set result target vertically relative to row (0..6 -> maybe proportional?) Just 0 is fine for now, or match row roughly.
            // Let's just pick index 0.
            setResultIndex(0);
          }
          break;
        case 'ArrowLeft':
          if (keyboardPos.col > 0) {
            setKeyboardPos(prev => ({ ...prev, col: prev.col - 1 }));
          } else if (onReturnToSidebar && Date.now() - lastTimeAtColZero.current > 500) {
            onReturnToSidebar();
          }
          break;
        case 'ArrowDown':
          if (keyboardPos.row < maxRow) {
            setKeyboardPos(prev => ({ 
              row: prev.row + 1, 
              col: Math.min(prev.col, keyboardRows[prev.row + 1].length - 1) 
            }));
          } else {
            setFocusArea('filters');
            setFilterIndex(0);
          }
          break;
        case 'ArrowUp':
          if (keyboardPos.row > 0) {
            setKeyboardPos(prev => ({ 
              row: prev.row - 1, 
              col: Math.min(prev.col, keyboardRows[prev.row - 1].length - 1) 
            }));
          }
          break;
        case 'Enter':
          handleKeyPress(keyboardRows[keyboardPos.row][keyboardPos.col]);
          break;
      }
    } else if (focusArea === 'filters') {
      switch (e.key) {
        case 'ArrowRight':
          if (filterIndex % 3 < 2 && filterIndex + 1 < quickFilters.length) {
            setFilterIndex(prev => prev + 1);
          } else if (results.length > 0) {
            setFocusArea('results');
            setResultIndex(0);
          }
          break;
        case 'ArrowLeft':
          if (filterIndex % 3 > 0) {
            setFilterIndex(prev => prev - 1);
          } else if (onReturnToSidebar && Date.now() - lastTimeAtColZero.current > 500) {
            onReturnToSidebar();
          }
          break;
        case 'ArrowUp':
          if (filterIndex >= 3) {
            setFilterIndex(prev => prev - 3);
          } else {
            setFocusArea('keyboard');
            setKeyboardPos({ row: keyboardRows.length - 1, col: filterIndex === 0 ? 1 : filterIndex === 1 ? 2 : 4 });
          }
          break;
        case 'ArrowDown':
          if (filterIndex + 3 < quickFilters.length) {
            setFilterIndex(prev => prev + 3);
          }
          break;
      }
    } else if (focusArea === 'results') {
      const cols = 5;
      switch (e.key) {
        case 'ArrowRight':
          setResultIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowLeft':
          if (resultIndex % cols === 0) {
            if (lastLeftPanelFocus.current === 'filters') {
              setFocusArea('filters');
              // Return to the rightmost column of the filter's current row
              setFilterIndex(prev => Math.min(prev + (2 - (prev % 3)), quickFilters.length - 1));
            } else {
              setFocusArea('keyboard');
              setKeyboardPos(prev => ({
                ...prev,
                col: keyboardRows[prev.row].length - 1
              }));
            }
          } else {
            setResultIndex(prev => Math.max(prev - 1, 0));
          }
          break;
        case 'ArrowUp':
          if (resultIndex >= cols) {
            setResultIndex(prev => prev - cols);
          }
          break;
        case 'ArrowDown':
          if (resultIndex + cols < results.length) {
            setResultIndex(prev => prev + cols);
          }
          break;
        case 'Enter':
          onMovieSelect(results[resultIndex]);
          break;
      }
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
      e.preventDefault();
    }
  }, [isActive, focusArea, keyboardPos, filterIndex, resultIndex, results, query, handleKeyPress, onMovieSelect]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Infinite Scroll Trigger (Scroll-based for Touch/Mouse)
  const handleScroll = useCallback(() => {
    if (!resultsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = resultsContainerRef.current;
    
    // Trigger when user is within 1200px of the bottom (earlier prefetch)
    if (scrollHeight - scrollTop - clientHeight < 1200 && hasMore && !isLoadingMore && !isSearching) {
      handleSearch(query, page + 1);
    }
  }, [hasMore, isLoadingMore, isSearching, query, page, handleSearch]);

  useEffect(() => {
    const el = resultsContainerRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Infinite Scroll Trigger (Focus-based for TV/Remote)
  useEffect(() => {
    if (focusArea === 'results' && 
        results.length > 0 && 
        resultIndex >= results.length - 30 && // Trigger 6 rows before the end (earlier prefetch)
        hasMore && 
        !isLoadingMore && 
        !isSearching) {
      handleSearch(query, page + 1);
    }
  }, [focusArea, resultIndex, results.length, hasMore, isLoadingMore, isSearching, query, page, handleSearch]);

  return (
    <div className="search-view-container">
      {/* Left Panel: Search Interface */}
      <section className="search-left-panel flex flex-col justify-between">
        <div className="flex flex-col flex-1 overflow-visible gap-10">
          <div className="flex flex-col gap-4">
            <div className="search-title-group flex flex-col gap-1">
              <h1 className="text-[2.5rem] font-black tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 leading-none drop-shadow-sm">
                BUSCAR
              </h1>
              <p className="text-slate-400 text-xs mt-1 uppercase tracking-[0.1em] font-medium">
                Encuentra tus títulos favoritos
              </p>
            </div>
            
            <div 
              className="search-input-area relative text-2xl font-headline font-semibold text-[#FFD700] border-b-2 border-[#FFD700]/30 pb-2 flex items-center gap-[2px] min-h-[48px] cursor-text"
              onClick={() => inputRef.current?.focus()}
            >
              {/* Hidden input to capture system keyboard events and touch focus */}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                onFocus={() => {
                  setFocusArea('keyboard');
                  setKeyboardPos({ row: 6, col: 4 });
                }}
                className="absolute inset-0 opacity-0 w-full h-full z-10 cursor-text"
                aria-label="Search"
              />

              <span className="whitespace-pre text-white select-text cursor-text relative z-0 pointer-events-none" style={{ WebkitUserSelect: 'text', userSelect: 'text' }}>{query}</span>
              <span className="w-[4px] h-8 bg-[#FFD700] animate-pulse shrink-0 relative z-0 pointer-events-none"></span>
            </div>
          </div>

          {/* Keyboard Grid */}
          <div className="search-keyboard-grid grid grid-cols-6 gap-2 max-w-sm">
            {keyboardRows.map((row, rIdx) => (
              row.map((key, cIdx) => {
                const isFocused = focusArea === 'keyboard' && keyboardPos.row === rIdx && keyboardPos.col === cIdx;
                
                let colSpanClass = 'col-span-1';
                if (key === 'BUSCAR') colSpanClass = 'col-span-2';

                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className={`key-floating flex items-center justify-center rounded-md transition-all ${isFocused ? 'active-key scale-110' : ''} ${colSpanClass}`.trim().replace(/\s+/g, ' ')}
                    onPointerEnter={() => {
                      setFocusArea('keyboard');
                      setKeyboardPos({ row: rIdx, col: cIdx });
                    }}
                    onClick={() => handleKeyPress(key)}
                  >
                    {key === 'BACKSPACE' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isFocused ? 'opacity-100' : 'opacity-80'}>
                        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                        <line x1="18" y1="9" x2="12" y2="15"></line>
                        <line x1="12" y1="9" x2="18" y2="15"></line>
                      </svg>
                    ) : key === 'CLEAR' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isFocused ? 'opacity-100' : 'opacity-80'}>
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    ) : key === 'ESPACIO' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isFocused ? 'opacity-100' : 'opacity-80'}>
                        <path d="M4 10v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path>
                      </svg>
                    ) : (
                      <span className={`text-sm font-bold ${isFocused ? 'opacity-100' : 'opacity-80'} ${key === 'BUSCAR' ? 'tracking-widest' : ''}`.trim()}>{key}</span>
                    )}
                  </div>
                );
              })
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 mt-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant opacity-50 font-black pl-1">Búsquedas Populares</span>
          <div className="grid grid-cols-3 gap-2">
            {quickFilters.map((filter, idx) => {
              const isFocused = focusArea === 'filters' && filterIndex === idx;
              return (
                <button
                  key={filter}
                  className={`px-3 h-[40px] rounded-lg text-[11px] font-bold tracking-widest transition-all duration-300 flex items-center justify-center border ${
                    isFocused 
                      ? 'bg-primary-container text-on-primary-container scale-105 border-primary-container shadow-lg z-10' 
                      : 'bg-surface-variant/10 border-surface-variant/20 text-on-surface-variant'
                  }`.trim().replace(/\s+/g, ' ')}
                  onPointerEnter={() => {
                    setFocusArea('filters');
                    setFilterIndex(idx);
                  }}
                  onClick={() => {
                    setQuery(filter);
                    handleSearch(filter, 1);
                    setFocusArea('results');
                    setResultIndex(0);
                  }}
                >
                  {filter}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Right Panel: Results */}
      <section ref={resultsContainerRef} className="search-results-panel">
        <div className="flex items-baseline justify-between" style={{ marginBottom: '50px' }}>
          <h2 className="font-headline text-2xl font-bold">
            {isSearching ? 'Buscando...' : results.length > 0 ? `Resultados para "${lastSearchedQuery}"` : 'Resultados'}
          </h2>
          <span className="text-on-surface-variant text-sm font-label opacity-60">
            {isSearching ? 'Por favor, espera un momento' : `${totalResults} Títulos encontrados`}
          </span>
        </div>

        {isSearching ? (
          <div className="search-results-grid grid grid-cols-5 gap-8">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="aspect-[2/3] w-full bg-white/5 rounded-2xl relative overflow-hidden">
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
                    style={{ 
                      animation: 'shimmer 2s infinite',
                      width: '200%'
                    }}
                  ></div>
                </div>
                <div className="h-4 w-3/4 bg-white/10 rounded-md animate-pulse"></div>
                <div className="h-3 w-1/2 bg-white/5 rounded-md animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="search-results-grid grid grid-cols-5 gap-8">
            {results.map((movie, index) => (
              <CarouselItem
                key={`${movie.id}-${index}`}
                movie={movie}
                isActive={focusArea === 'results' && resultIndex === index}
                row={Math.floor(index / 5)}
                col={index % 5}
                onFocus={(row, col) => {
                  setFocusArea('results');
                  setResultIndex(index);
                }}
                onClick={(movie) => onMovieSelect(movie)}
                preventAutoScroll={preventAutoScroll}
              />
            ))}
            
            {isLoadingMore && [...Array(5)].map((_, i) => (
              <div key={`loading-more-${i}`} className="flex flex-col gap-3">
                <div className="aspect-[2/3] w-full bg-white/5 rounded-2xl relative overflow-hidden">
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
                    style={{ 
                      animation: 'shimmer 2s infinite',
                      width: '200%'
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        ) : lastSearchedQuery.trim() !== "" ? (
          <div className="flex flex-col items-center justify-center h-[60%] gap-6">
            <span className="material-symbols-outlined text-8xl opacity-20" style={{ fontSize: '80px' }}>sentiment_dissatisfied</span>
            <div className="text-center">
              <p className="text-2xl font-headline font-bold opacity-40">No se encontraron resultados</p>
              <p className="text-sm opacity-30 mt-2">Intenta buscar con otras palabras clave</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[60%] opacity-20 gap-6">
            <span className="material-symbols-outlined text-8xl" style={{ fontSize: '80px' }}>search</span>
            <p className="text-2xl font-headline font-bold">Busca tus películas favoritas</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default SearchView;
