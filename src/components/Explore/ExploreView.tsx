"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Movie } from '@/types';
import { fetchMoviesByGenre } from '@/lib/data';
import CarouselItem from '../Carousel/CarouselItem';

interface ExploreViewProps {
  isActive: boolean;
  onMovieSelect: (movie: Movie) => void;
  onReturnToSidebar?: () => void;
}

const genres = [
  { id: 878, name: 'Ciencia Ficción' },
  { id: 28, name: 'Acción' },
  { id: 27, name: 'Terror' },
  { id: 99, name: 'Documentales' },
  { id: 16, name: 'Animación' },
  { id: 18, name: 'Drama' },
  { id: 53, name: 'Suspenso' },
  { id: 35, name: 'Comedia' },
  { id: 80, name: 'Crimen' },
  { id: 12, name: 'Aventura' },
  { id: 14, name: 'Fantasía' },
  { id: 9648, name: 'Misterio' },
  { id: 10751, name: 'Familia' },
  { id: 36, name: 'Historia' },
  { id: 10402, name: 'Música' },
  { id: 10749, name: 'Romance' },
  { id: 10752, name: 'Bélica' },
  { id: 37, name: 'Western' },
  { id: 10770, name: 'Películas de TV' }
];

const sortOptions = [
  { id: 'popularity', label: 'Tendencias' },
  { id: 'vote_average', label: 'Mejor Valoradas' },
  { id: 'release_date', label: 'Lanz. Recientes' },
  { id: 'title', label: 'Alfabético (A-Z)' }
];

const starsOptions = [
  { id: 'all', label: 'Cualquier Puntaje', badge: '∞', num: '∞' },
  { id: '4', label: 'Bajas', badge: '4.0+', num: '4.0' },
  { id: '5', label: 'Regulares', badge: '5.0+', num: '5.0' },
  { id: '6', label: 'Aceptables', badge: '6.0+', num: '6.0' },
  { id: '7', label: 'Buenas', badge: '7.0+', num: '7.0' },
  { id: '8', label: 'Muy Buenas', badge: '8.0+', num: '8.0' },
  { id: '9', label: 'Obras Maestras', badge: '9.0+', num: '9.0' }
];

const yearOptions = [
  { id: 'all', label: 'Cualquier Año' },
  { id: '2024', label: 'Estrenos (2024+)' },
  { id: '2020', label: 'Modernas (2020+)' },
  { id: '2010', label: 'Última Década (2010+)' },
  { id: '2000', label: 'Clásicos 2000s' },
  { id: 'classic', label: 'Retro (Pre-2000)' }
];

const ExploreView: React.FC<ExploreViewProps> = ({ isActive, onMovieSelect, onReturnToSidebar }) => {
  const [selectedGenreIndex, setSelectedGenreIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<'genres' | 'results' | 'filters' | 'menu'>('genres');
  const [genreFocusIndex, setGenreFocusIndex] = useState(0);
  const [resultFocusIndex, setResultFocusIndex] = useState(0);
  const [filterFocusIndex, setFilterFocusIndex] = useState(0);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Pagination & Filters State
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<'none' | 'stars' | 'year' | 'sort'>('none');
  const [menuFocusIndex, setMenuFocusIndex] = useState<number>(0);
  const [activeSort, setActiveSort] = useState<string>('popularity');
  const [activeStars, setActiveStars] = useState<string>('all');
  const [activeYear, setActiveYear] = useState<string>('all');
  const [totalMatches, setTotalMatches] = useState<number>(0);
  
  const lastTimeAtLeftEdge = useRef<number>(0);
  const latestRequestRef = useRef<number>(0);
  const genreRefs = useRef<(HTMLLIElement | null)[]>([]);
  const sidebarRef = useRef<HTMLElement>(null);

  const loadMoviesInit = useCallback(async (genreId: number, sort: string, stars: string, year: string) => {
    const requestId = Date.now() + Math.random();
    latestRequestRef.current = requestId;

    setIsLoading(true);
    try {
      const { movies: results, count } = await fetchMoviesByGenre([genreId], 1, 60, sort, stars, year);
      
      // Racing Condition Guard
      if (latestRequestRef.current === requestId) {
        setMovies(results);
        setTotalMatches(count);
        setHasMore(results.length === 60);
        setResultFocusIndex(0);
      }
    } catch (error) {
      console.error('Error loading movies:', error);
    } finally {
      if (latestRequestRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadMoreMovies = useCallback(async (genreId: number, pageNum: number, sort: string, stars: string, year: string) => {
    const requestId = Date.now() + Math.random();
    latestRequestRef.current = requestId;

    setIsLoadingMore(true);
    try {
      const { movies: results } = await fetchMoviesByGenre([genreId], pageNum, 60, sort, stars, year);
      
      if (latestRequestRef.current === requestId) {
        setMovies(prev => {
          const newMovies = results.filter(nm => !prev.some(pm => pm.id === nm.id));
          return [...prev, ...newMovies];
        });
        setHasMore(results.length === 60);
      }
    } catch (error) {
      console.error('Error loading more movies:', error);
    } finally {
      if (latestRequestRef.current === requestId) {
        setIsLoadingMore(false);
      }
    }
  }, []);

  const lastParamsRef = useRef<string>("");

  useEffect(() => {
    if (isActive && genres.length > selectedGenreIndex) {
      const genreId = genres[selectedGenreIndex].id;
      const currentParams = `${genreId}-${activeSort}-${activeStars}-${activeYear}`;
      
      if (currentParams !== lastParamsRef.current) {
        setPage(1);
        setMovies([]); // Clear movies only if params actually changed
        loadMoviesInit(genreId, activeSort, activeStars, activeYear);
        lastParamsRef.current = currentParams;
      }
    }
  }, [isActive, selectedGenreIndex, activeSort, activeStars, activeYear, loadMoviesInit, genres]);

  useEffect(() => {
    if (isActive && page > 1 && genres.length > selectedGenreIndex) {
      loadMoreMovies(genres[selectedGenreIndex].id, page, activeSort, activeStars, activeYear);
    }
  }, [page, isActive, loadMoreMovies, genres, selectedGenreIndex, activeSort, activeStars, activeYear]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return;

    // Overlay Interception
    if (focusArea === 'menu') {
      const options = activeMenu === 'sort' ? sortOptions : activeMenu === 'stars' ? starsOptions : yearOptions;
      
      switch (e.key) {
        case 'ArrowDown':
          if (activeMenu !== 'stars') setMenuFocusIndex(prev => Math.min(prev + 1, options.length - 1));
          break;
        case 'ArrowUp':
          if (activeMenu !== 'stars') {
            setMenuFocusIndex(prev => {
              if (prev === 0) {
                setActiveMenu('none');
                setFocusArea('filters');
                return 0;
              }
              return prev - 1;
            });
          } else {
            setActiveMenu('none');
            setFocusArea('filters');
          }
          break;
        case 'ArrowLeft':
          if (activeMenu === 'stars') {
             setMenuFocusIndex(prev => Math.max(prev - 1, 0));
          } else {
             setActiveMenu('none');
             setFocusArea('filters');
          }
          break;
        case 'ArrowRight':
          if (activeMenu === 'stars') {
             setMenuFocusIndex(prev => Math.min(prev + 1, options.length - 1));
          } else {
             setActiveMenu('none');
             setFocusArea('filters');
          }
          break;
        case 'Escape':
        case 'Backspace':
          setActiveMenu('none');
          setFocusArea('filters');
          break;
        case 'Enter':
          if (activeMenu === 'sort') {
            setActiveSort(options[menuFocusIndex].id);
          } else if (activeMenu === 'stars') {
            setActiveStars(options[menuFocusIndex].id);
          } else {
            setActiveYear(options[menuFocusIndex].id);
          }
          setActiveMenu('none');
          setFocusArea('filters');
          break;
      }
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace'].includes(e.key)) {
        e.preventDefault();
      }
      return;
    }

    if (focusArea === 'genres') {
      switch (e.key) {
        case 'ArrowDown':
          setGenreFocusIndex(prev => {
            const next = Math.min(prev + 1, genres.length - 1);
            setSelectedGenreIndex(next);
            return next;
          });
          break;
        case 'ArrowUp':
          setGenreFocusIndex(prev => {
            const next = Math.max(prev - 1, 0);
            setSelectedGenreIndex(next);
            return next;
          });
          break;
        case 'ArrowRight':
          if (movies.length > 0) {
            setFocusArea('results');
            setResultFocusIndex(0);
          }
          break;
        case 'ArrowLeft':
            const now = Date.now();
            if (now - lastTimeAtLeftEdge.current > 500) {
              onReturnToSidebar?.();
            }
          break;
      }
    } else if (focusArea === 'results') {
      const cols = 6;
      switch (e.key) {
        case 'ArrowRight':
          setResultFocusIndex(prev => Math.min(prev + 1, movies.length - 1));
          break;
        case 'ArrowLeft':
          if (resultFocusIndex % cols === 0) {
            setFocusArea('genres');
          } else {
            setResultFocusIndex(prev => Math.max(prev - 1, 0));
          }
          break;
        case 'ArrowDown':
          if (resultFocusIndex + cols < movies.length) {
            setResultFocusIndex(prev => prev + cols);
            const nextRow = Math.floor((resultFocusIndex + cols) / cols);
            const totalRows = Math.ceil(movies.length / cols);
            // Infinite scroll trigger: load next page when 2 rows away from the bottom
            if (hasMore && !isLoadingMore && (nextRow >= totalRows - 2)) {
               setPage(p => p + 1);
            }
          } else {
            const currentRow = Math.floor(resultFocusIndex / cols);
            const lastRow = Math.floor((movies.length - 1) / cols);
            if (currentRow < lastRow) {
              setResultFocusIndex(movies.length - 1);
            }
            // If already at the bottom and more exists, try forcing load
            if (hasMore && !isLoadingMore) {
               setPage(p => p + 1);
            }
          }
          break;
        case 'ArrowUp':
          if (resultFocusIndex >= cols) {
            setResultFocusIndex(prev => prev - cols);
          } else {
            setFocusArea('filters');
            setFilterFocusIndex(0);
          }
          break;
        case 'Enter':
          onMovieSelect(movies[resultFocusIndex]);
          break;
      }
    } else if (focusArea === 'filters') {
      switch (e.key) {
        case 'ArrowRight':
          if (filterFocusIndex < 2) setFilterFocusIndex(prev => prev + 1);
          break;
        case 'ArrowLeft':
          if (filterFocusIndex > 0) {
            setFilterFocusIndex(prev => prev - 1);
          } else {
            setFocusArea('genres');
          }
          break;
        case 'ArrowDown':
          if (movies.length > 0) {
            setFocusArea('results');
            setResultFocusIndex(0);
          }
          break;
        case 'Enter':
          const menuToOpen = filterFocusIndex === 0 ? 'stars' : filterFocusIndex === 1 ? 'year' : 'sort';
          setActiveMenu(menuToOpen);
          let currentOption = activeSort;
          let optionsList = sortOptions;
          if (menuToOpen === 'stars') { currentOption = activeStars; optionsList = starsOptions; }
          else if (menuToOpen === 'year') { currentOption = activeYear; optionsList = yearOptions; }
          setMenuFocusIndex(Math.max(0, optionsList.findIndex(o => o.id === currentOption)));
          setFocusArea('menu');
          break;
      }
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
      e.preventDefault();
    }
  }, [isActive, focusArea, genreFocusIndex, resultFocusIndex, filterFocusIndex, movies, selectedGenreIndex, onReturnToSidebar, onMovieSelect, activeMenu, menuFocusIndex, activeSort, activeStars, activeYear, hasMore, isLoadingMore]);

  useEffect(() => {
    if (focusArea === 'genres') {
        lastTimeAtLeftEdge.current = Date.now();
    } else {
        lastTimeAtLeftEdge.current = 0;
    }
  }, [focusArea]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Sidebar Auto-Scroll Logic
  useEffect(() => {
    if (focusArea === 'genres') {
      if (genreFocusIndex === 0 && sidebarRef.current) {
        sidebarRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (genreRefs.current[genreFocusIndex]) {
        genreRefs.current[genreFocusIndex]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [genreFocusIndex, focusArea]);

  // Inline menu renderer to ensure pixel-perfect spatial relationship mapping
  const renderMenu = (menuType: 'stars' | 'year' | 'sort') => {
    if (activeMenu !== menuType) return null;
    const options = menuType === 'stars' ? starsOptions : menuType === 'year' ? yearOptions : sortOptions;
    const activeVal = menuType === 'stars' ? activeStars : menuType === 'year' ? activeYear : activeSort;
    
    return (
      <div 
        className="explore-menu-container absolute left-1/2 z-50 cursor-default"
        style={{ top: 'calc(100% + 1rem)' }}
      >
        {/* CSS Triangles for the 'speech bubble' pointer effect */}
        <div className="absolute -top-[7px] left-0 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-transparent border-b-[#FFD700] z-20"></div>
        <div className="absolute -top-[6px] left-0 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-transparent border-b-[#0f0f11] z-30"></div>
        
        <div 
          className="explore-menu-box rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,1)] relative z-10"
          style={{ 
            backgroundColor: '#0f0f11',
            border: '1px solid #FFD700',
            width: '21rem',
            padding: '1rem',
            transform: `translateX(${menuType === 'stars' ? '-50%' : menuType === 'year' ? '-75%' : '-90%'})`
          }}
        >
          {menuType === 'stars' ? (
            <div className="py-2 px-1 pb-1">
              <div className="flex flex-col items-center mb-5">
                <span className="text-[10px] uppercase font-bold text-[#FFD700] mb-0.5 tracking-[0.2em]">{(options[menuFocusIndex] as any).label}</span>
                <span className="text-3xl font-black text-white leading-none">{(options[menuFocusIndex] as any).badge}</span>
              </div>
              
              <div className="relative h-1.5 w-full bg-white/10 rounded-full mb-3 mt-8">
                 <div 
                     className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#B8860B] to-[#FFD700] rounded-full transition-all duration-300 ease-out"
                     style={{ width: `${(menuFocusIndex / (options.length - 1)) * 100}%` }}
                 ></div>
                 
                 <div 
                     className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(255,215,0,0.6)] transition-all duration-300 ease-out z-10"
                     style={{ left: `calc(${(menuFocusIndex / (options.length - 1)) * 100}% - 8px)` }}
                 ></div>
              </div>
              
              <div className="flex justify-between w-full text-[10px] font-bold text-white/40 tracking-wider">
                {(options as any[]).map((opt, i) => (
                  <span key={opt.id} className={`transition-colors duration-300 ${menuFocusIndex >= i ? 'text-white/80' : 'text-white/20'}`}>
                    {(opt as any).num}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={{ paddingBottom: '0.8rem', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem' }}>
                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.25em] m-0">
                  {menuType === 'year' ? 'Rango de Año' : 'Orden de Catálogo'}
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {options.map((opt, i) => {
                  const isFocused = menuFocusIndex === i;
                  const isSelected = activeVal === opt.id;
                  
                  return (
                    <div 
                      key={opt.id}
                      className={`transition-colors duration-200 rounded-xl ${
                        isFocused ? 'bg-white text-black font-bold shadow-md' : 'bg-transparent text-slate-300'
                      }`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem' }}
                    >
                      <span className={`text-[12px] uppercase tracking-[0.1em] ${isSelected ? 'font-black' : 'font-semibold'}`}>
                        {opt.label}
                      </span>
                      
                      {isSelected && (
                        <svg className={`w-4 h-4 ${isFocused ? 'text-black' : 'text-[#FFD700]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3.5">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-dark text-slate-100 font-roboto">
      {/* Secondary Sidebar: Genres */}
      <aside 
        ref={sidebarRef}
        className="explore-sidebar w-60 h-screen border-r border-white/5 bg-background-dark overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col pt-12 pb-6 shrink-0 transition-opacity duration-300"
      >
        <div className="explore-sidebar-header mb-8" style={{ marginTop: '40px', paddingLeft: '2rem', paddingRight: '2rem' }}>
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/50 border-b border-white/10 pb-3">Géneros</h2>
        </div>
        <ul className="flex flex-col">
          {genres.map((genre, index) => {
            const isSelected = selectedGenreIndex === index;
            const isFocused = focusArea === 'genres' && genreFocusIndex === index;
            
            return (
              <li
                ref={el => { genreRefs.current[index] = el; }}
                key={genre.id}
                style={{ 
                  color: isSelected ? '#FFD700' : (isFocused ? '#ffffff' : '#94a3b8'),
                  backgroundColor: isFocused 
                    ? 'rgba(255, 255, 255, 0.1)' 
                    : (isSelected ? 'rgba(255, 215, 0, 0.08)' : 'transparent'),
                  borderLeft: isSelected 
                    ? '4px solid #FFD700' 
                    : (isFocused ? '4px solid rgba(255, 255, 255, 0.4)' : '4px solid transparent'),
                  fontWeight: isSelected || isFocused ? 'bold' : 'normal',
                  transform: isFocused ? 'translateX(4px)' : 'none',
                  paddingTop: '0.85rem',
                  paddingBottom: '0.85rem',
                  paddingLeft: '2rem',
                  paddingRight: '2rem',
                  boxShadow: isFocused ? 'inset 0 0 20px rgba(255,255,255,0.05)' : 'none'
                }}
                className={`text-sm cursor-pointer transition-all duration-200 font-roboto flex items-center ${
                  isSelected ? '' : 'hover:text-white hover:bg-white/5'
                }`.trim().replace(/\s+/g, ' ')}
                onClick={() => setSelectedGenreIndex(index)}
              >
                <span className={`transition-all duration-200 ${isFocused ? 'scale-110' : 'scale-100'}`}>
                  {genre.name}
                </span>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-black/20 flex flex-col" style={{ scrollPaddingTop: '120px' }}>
        <header 
          style={{ paddingTop: '20px', paddingLeft: '40px', paddingRight: '40px', paddingBottom: '1rem' }}
          className="explore-header sticky top-0 z-40 bg-background-dark/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between"
        >
          <div className="flex flex-col gap-1">
            <h1 className="explore-title text-[2.5rem] font-black tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 leading-none drop-shadow-sm">
              EXPLORAR
            </h1>
            <p className="explore-subtitle text-[#FFD700] text-xs mt-2 uppercase font-bold pl-1 flex items-center gap-x-4 flex-wrap">
              <span className="tracking-[0.2em] font-black">{genres[selectedGenreIndex].name}</span>
              {!isLoading && (
                <>
                  {activeStars !== 'all' && (
                    <>
                      <span className="text-white/20 font-normal">•</span>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#FFD700] -mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                        <span className="text-[#FFD700] font-black tracking-[0.2em] leading-none">{activeStars}+</span>
                      </div>
                    </>
                  )}
                  {activeYear !== 'all' && (
                    <>
                      <span className="text-white/20 font-normal">•</span>
                      <span className="text-[#FFD700] font-black tracking-[0.2em] leading-none">
                        {activeYear === 'classic' ? 'RETRO' : `${activeYear}+`}
                      </span>
                    </>
                  )}
                  <span className="text-white/20 font-normal">|</span> 
                  <span className="text-slate-300 font-bold tracking-[0.2em] leading-none">{totalMatches} TÍTULOS</span>
                </>
              )}
            </p>
          </div>
          <div className="explore-filters-group flex items-center gap-6 text-xs font-bold uppercase tracking-[0.15em] relative pr-2">
            <div 
              className={`relative flex items-center gap-2.5 transition-all duration-300 ${
                (focusArea === 'filters' && filterFocusIndex === 0) || activeMenu === 'stars'
                  ? 'text-[#FFD700] scale-110' 
                  : 'text-slate-500 hover:text-slate-300'
              }`.trim().replace(/\s+/g, ' ')}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              <span>Estrellas</span>
              {renderMenu('stars')}
            </div>
            
            <div 
              className={`relative flex items-center gap-2.5 transition-all duration-300 ${
                (focusArea === 'filters' && filterFocusIndex === 1) || activeMenu === 'year'
                  ? 'text-[#FFD700] scale-110' 
                  : 'text-slate-500 hover:text-slate-300'
              }`.trim().replace(/\s+/g, ' ')}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span>Año</span>
              {renderMenu('year')}
            </div>

            <div 
              className={`relative flex items-center gap-2.5 transition-all duration-300 ${
                (focusArea === 'filters' && filterFocusIndex === 2) || activeMenu === 'sort'
                  ? 'text-[#FFD700] scale-110' 
                  : 'text-slate-500 hover:text-slate-300'
              }`.trim().replace(/\s+/g, ' ')}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v14" /></svg>
              <span>Ordenar</span>
              {renderMenu('sort')}
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col" style={{ paddingLeft: '40px', paddingRight: '40px', paddingTop: '1.5rem', paddingBottom: '4rem' }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64 opacity-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
            </div>
          ) : movies.length > 0 ? (
            <div className="explore-results-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-8">
              {movies.map((movie, index) => (
                <CarouselItem
                  key={movie.id}
                  movie={movie}
                  isActive={focusArea === 'results' && resultFocusIndex === index}
                  row={Math.floor(index / 6)}
                  col={index % 6}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 opacity-20">
               <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
               <p className="text-xl font-bold uppercase tracking-widest">Sin resultados</p>
            </div>
          )}
        </div>
      </main>

    </div>
  );
};

export default ExploreView;
