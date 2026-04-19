"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Movie } from '@/types';
import { searchMovies } from '@/lib/data';
import CarouselItem from '../Carousel/CarouselItem';

interface SearchViewProps {
  isActive: boolean;
  onMovieSelect: (movie: Movie) => void;
  onReturnToSidebar?: () => void;
}

const SearchView: React.FC<SearchViewProps> = ({ isActive, onMovieSelect, onReturnToSidebar }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [focusArea, setFocusArea] = useState<'keyboard' | 'filters' | 'results'>('keyboard');
  const [keyboardPos, setKeyboardPos] = useState({ row: 0, col: 0 });
  const [filterIndex, setFilterIndex] = useState(0);
  const [resultIndex, setResultIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const lastTimeAtColZero = useRef<number>(0);
  const lastLeftPanelFocus = useRef<'keyboard' | 'filters'>('keyboard');
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusArea === 'results' && resultIndex < 4 && resultsContainerRef.current) {
      resultsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [focusArea, resultIndex]);

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

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const movies = await searchMovies(searchQuery);
      setResults(movies);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
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
      handleSearch(query);
      setFocusArea('results');
      setResultIndex(0);
    } else {
      setQuery(prev => prev + key);
    }
  }, [query, handleSearch]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return;

    const key = e.key;
    const keyCode = e.keyCode;

    // Normalización de teclas para controles remotos de TV
    const isUp = key === 'ArrowUp' || key === 'Up' || keyCode === 38;
    const isDown = key === 'ArrowDown' || key === 'Down' || keyCode === 40;
    const isLeft = key === 'ArrowLeft' || key === 'Left' || keyCode === 37;
    const isRight = key === 'ArrowRight' || key === 'Right' || keyCode === 39;
    const isEnter = key === 'Enter' || key === 'Select' || key === 'Ok' || keyCode === 13;
    const isBack = key === 'Backspace' || key === 'Escape' || key === 'Back' || keyCode === 8 || keyCode === 27 || keyCode === 461;

    if (focusArea === 'keyboard') {
      const maxRow = keyboardRows.length - 1;
      const maxCol = keyboardRows[keyboardPos.row].length - 1;

      if (isRight) {
        if (keyboardPos.col < maxCol) {
          setKeyboardPos(prev => ({ ...prev, col: prev.col + 1 }));
        } else if (results.length > 0) {
          setFocusArea('results');
          setResultIndex(0);
        }
      } else if (isLeft) {
        if (keyboardPos.col > 0) {
          setKeyboardPos(prev => ({ ...prev, col: prev.col - 1 }));
        } else if (onReturnToSidebar && Date.now() - lastTimeAtColZero.current > 500) {
          onReturnToSidebar();
        }
      } else if (isDown) {
        if (keyboardPos.row < maxRow) {
          setKeyboardPos(prev => ({ 
            row: prev.row + 1, 
            col: Math.min(prev.col, keyboardRows[prev.row + 1].length - 1) 
          }));
        } else {
          setFocusArea('filters');
          setFilterIndex(0);
        }
      } else if (isUp) {
        if (keyboardPos.row > 0) {
          setKeyboardPos(prev => ({ 
            row: prev.row - 1, 
            col: Math.min(prev.col, keyboardRows[prev.row - 1].length - 1) 
          }));
        }
      } else if (isEnter) {
        handleKeyPress(keyboardRows[keyboardPos.row][keyboardPos.col]);
      }
    } else if (focusArea === 'filters') {
      if (isRight) {
        if (filterIndex % 3 < 2 && filterIndex + 1 < quickFilters.length) {
          setFilterIndex(prev => prev + 1);
        } else if (results.length > 0) {
          setFocusArea('results');
          setResultIndex(0);
        }
      } else if (isLeft) {
        if (filterIndex % 3 > 0) {
          setFilterIndex(prev => prev - 1);
        } else if (onReturnToSidebar && Date.now() - lastTimeAtColZero.current > 500) {
          onReturnToSidebar();
        }
      } else if (isUp) {
        if (filterIndex >= 3) {
          setFilterIndex(prev => prev - 3);
        } else {
          setFocusArea('keyboard');
          setKeyboardPos({ row: keyboardRows.length - 1, col: filterIndex === 0 ? 1 : filterIndex === 1 ? 2 : 4 });
        }
      } else if (isDown) {
        if (filterIndex + 3 < quickFilters.length) {
          setFilterIndex(prev => prev + 3);
        }
      } else if (isEnter) {
        // Enviar filtro
        const filterQuery = quickFilters[filterIndex];
        setQuery(filterQuery);
        handleSearch(filterQuery);
        setFocusArea('results');
        setResultIndex(0);
      }
    } else if (focusArea === 'results') {
      const cols = 4;
      if (isRight) {
        setResultIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (isLeft) {
        if (resultIndex % cols === 0) {
          if (lastLeftPanelFocus.current === 'filters') {
            setFocusArea('filters');
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
      } else if (isUp) {
        if (resultIndex >= cols) {
          setResultIndex(prev => prev - cols);
        }
      } else if (isDown) {
        if (resultIndex + cols < results.length) {
          setResultIndex(prev => prev + cols);
        }
      } else if (isEnter) {
        onMovieSelect(results[resultIndex]);
      }
    }

    if (isUp || isDown || isLeft || isRight || isEnter || isBack) {
      e.preventDefault();
    }
  }, [isActive, focusArea, keyboardPos, filterIndex, resultIndex, results, query, handleKeyPress, onMovieSelect, handleSearch, onReturnToSidebar]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="search-view-container">
      {/* Left Panel: Search Interface */}
      <section
        className="search-left-panel flex flex-col justify-between h-full"
        style={{ width: '450px', paddingTop: '55px', paddingLeft: '50px', paddingRight: '48px', paddingBottom: '48px' }}
      >
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-[2.5rem] font-black tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 leading-none drop-shadow-sm">
                BUSCAR
              </h1>
              <p className="text-slate-400 text-xs mt-1 uppercase tracking-[0.1em] font-medium">
                Encuentra tus títulos favoritos
              </p>
            </div>
            
            <div className="text-2xl font-headline font-semibold text-[#FFD700] border-b-2 border-[#FFD700]/30 pb-2 flex items-center gap-[2px] min-h-[48px]">
              <span className="whitespace-pre text-white">{query}</span>
              <span className="w-[4px] h-8 bg-[#FFD700] animate-pulse shrink-0"></span>
            </div>
          </div>

          {/* Keyboard Grid */}
          <div className="grid grid-cols-6 gap-2 max-w-sm">
            {keyboardRows.map((row, rIdx) => (
              row.map((key, cIdx) => {
                const isFocused = focusArea === 'keyboard' && keyboardPos.row === rIdx && keyboardPos.col === cIdx;
                
                let colSpanClass = 'col-span-1';
                if (key === 'BUSCAR') colSpanClass = 'col-span-2';

                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className={`key-floating flex items-center justify-center rounded-md transition-all ${isFocused ? 'active-key scale-110' : ''} ${colSpanClass}`.trim().replace(/\s+/g, ' ')}
                  >
                    {key === 'BACKSPACE' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                        <line x1="18" y1="9" x2="12" y2="15"></line>
                        <line x1="12" y1="9" x2="18" y2="15"></line>
                      </svg>
                    ) : key === 'CLEAR' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    ) : key === 'ESPACIO' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                        <path d="M4 10v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path>
                      </svg>
                    ) : (
                      <span className={`text-sm font-bold opacity-80 ${key === 'BUSCAR' ? 'tracking-widest' : ''}`.trim()}>{key}</span>
                    )}
                  </div>
                );
              })
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4">
          <span className="text-xs uppercase tracking-widest text-on-surface-variant opacity-60 font-bold pl-1">Búsquedas Populares</span>
          <div className="grid grid-cols-3 gap-3">
            {quickFilters.map((filter, idx) => {
              const isFocused = focusArea === 'filters' && filterIndex === idx;
              return (
                <button
                  key={filter}
                  className={`px-4 h-[52px] rounded-xl text-sm font-bold tracking-wider transition-all duration-300 flex items-center justify-center border-2 ${
                    isFocused 
                      ? 'bg-primary-container text-on-primary-container scale-105 border-primary-container shadow-[0_0_20px_rgba(255,235,59,0.2)] z-10' 
                      : 'bg-surface-variant/20 border-surface-variant/30 text-on-surface-variant'
                  }`.trim().replace(/\s+/g, ' ')}
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
            {results.length > 0 ? `Resultados para "${query}"` : 'Resultados'}
          </h2>
          <span className="text-on-surface-variant text-sm font-label opacity-60">
            {results.length} Títulos encontrados
          </span>
        </div>

        {results.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {results.map((movie, idx) => (
              <CarouselItem
                key={movie.id}
                movie={movie}
                isActive={focusArea === 'results' && resultIndex === idx}
                row={Math.floor(idx / 4)}
                col={idx % 4}
              />
            ))}
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
