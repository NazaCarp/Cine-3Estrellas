"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Category, Movie } from '@/types';
import { fetchMoviesByCategory } from '@/lib/data';
import CarouselItem from './CarouselItem';

interface CategoryGridViewProps {
  category: Category;
  isActive: boolean;
  onClose: () => void;
  onMovieSelect: (movie: Movie) => void;
}

const CategoryGridView: React.FC<CategoryGridViewProps> = ({ 
  category, 
  isActive, 
  onClose, 
  onMovieSelect 
}) => {
  const [movies, setMovies] = useState<Movie[]>(category.movies || []);
  const [focusArea, setFocusArea] = useState<'grid' | 'header'>('grid');
  const [focusIndex, setFocusIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState((category.movies?.length || 0) >= 60);
  const [totalCount, setTotalCount] = useState(category.total_movies || 0);

  const COLS = 7;
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const isKeyboardAction = useRef(false);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    const nextPage = page + 1;
    const { movies: newMovies, count } = await fetchMoviesByCategory(category, nextPage);
    
    if (newMovies.length > 0) {
      setMovies(prev => {
        // Prevent duplicates by checking existing movie IDs
        const existingIds = new Set(prev.map(m => m.id));
        const unique = newMovies.filter(nm => !existingIds.has(nm.id));
        return [...prev, ...unique];
      });
      setPage(nextPage);
      setHasMore(newMovies.length === 60);
      setTotalCount(count);
    } else {
      setHasMore(false);
    }
    setIsLoading(false);
  }, [category, page, isLoading, hasMore]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return;
    isKeyboardAction.current = true;

    if (focusArea === 'header') {
      switch (e.key) {
        case 'ArrowDown':
          setFocusArea('grid');
          break;
        case 'Enter':
        case 'Backspace':
        case 'Escape':
          onClose();
          break;
      }
    } else {
      // Grid Navigation
      const rowCapacity = movies.length;

      switch (e.key) {
        case 'ArrowRight':
          if (focusIndex + 1 < rowCapacity) {
            setFocusIndex(prev => prev + 1);
          } else {
            loadMore();
          }
          break;
        case 'ArrowLeft':
          if (focusIndex > 0) {
            setFocusIndex(prev => prev - 1);
          }
          break;
        case 'ArrowDown':
          if (focusIndex + COLS < rowCapacity) {
            setFocusIndex(prev => prev + COLS);
          } else {
            loadMore();
          }
          break;
        case 'ArrowUp':
          if (focusIndex >= COLS) {
            setFocusIndex(prev => prev - COLS);
          } else {
            setFocusArea('header');
          }
          break;
        case 'Enter':
          if (movies[focusIndex]) {
            onMovieSelect(movies[focusIndex]);
          }
          break;
        case 'Backspace':
        case 'Escape':
          onClose();
          break;
      }
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace', 'Escape'].includes(e.key)) {
      e.preventDefault();
    }
  }, [isActive, focusArea, focusIndex, movies, onMovieSelect, onClose, loadMore, hasMore, isLoading]);

  // Predictive Loading Observer: Loads more content when user is within 3 rows of the bottom
  useEffect(() => {
    if (isActive && hasMore && !isLoading && focusArea === 'grid') {
      const rowCapacity = movies.length;
      const currentRow = Math.floor(rowCapacity / COLS);
      const totalRows = Math.ceil(rowCapacity / COLS);
      
      if (currentRow >= totalRows - 6) {
        loadMore();
      }
    }
  }, [focusIndex, movies.length, hasMore, isLoading, isActive, focusArea, loadMore]);

  useEffect(() => {
    if (isActive) {
      const html = document.documentElement;
      html.classList.add('no-scroll');
      return () => {
        html.classList.remove('no-scroll');
      };
    }
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isActive, handleKeyDown]);

  // Infinite Scroll Trigger (Scroll-based for Touch/Mouse)
  const handleScroll = useCallback(() => {
    if (!gridScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = gridScrollRef.current;
    
    // Trigger when user is within 1200px of the bottom (earlier prefetch)
    if (scrollHeight - scrollTop - clientHeight < 1200 && hasMore && !isLoading) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  useEffect(() => {
    const el = gridScrollRef.current;
    if (el && isActive) {
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, isActive]);

  useEffect(() => {
    if (isActive && focusArea === 'grid' && isKeyboardAction.current) {
      const activeItem = gridScrollRef.current?.querySelector('.carousel-item.active');
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      isKeyboardAction.current = false;
    }
  }, [focusIndex, isActive, focusArea]);

  if (!isActive) return null;

  return (
    <div className="category-grid-overlay">
      <header className="grid-header-immersive">
        <div className="grid-title-group">
          <div className="grid-metadata-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>movie</span>
            {totalCount.toLocaleString()} títulos disponibles
          </div>
          <h1 className="grid-title-premium">{category.name}</h1>
        </div>

        <div className="grid-controls-premium">
          <div 
            className={`control-pill ${focusArea === 'header' ? 'focused' : ''}`.trim()}
            onPointerEnter={() => {
              setFocusArea('header');
            }}
            onClick={onClose}
          >
            <span className="material-symbols-outlined">west</span>
            VOLVER
          </div>
        </div>
      </header>

      <div ref={gridScrollRef} className="grid-scroll-area custom-scrollbar">
        <div className="category-grid-immersive">
          {movies.map((movie, index) => (
            <CarouselItem 
              key={`${movie.id}-${index}`}
              movie={movie}
              row={0}
              col={index}
              isActive={focusArea === 'grid' && focusIndex === index}
              disableAutoScroll={true} // El grid maneja su propio scroll
              onFocus={(row, col) => {
                isKeyboardAction.current = false; // Si viene de pointer, desactivar scroll
                setFocusArea('grid');
                setFocusIndex(index);
              }}
              onClick={(movie) => onMovieSelect(movie)}
            />
          ))}
          {isLoading && (
            <div className="grid-loading-premium">
              Buscando más contenido...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryGridView;
