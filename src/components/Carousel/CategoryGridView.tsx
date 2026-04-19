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

  const COLS = 6;
  const gridScrollRef = useRef<HTMLDivElement>(null);

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

    const key = e.key;
    const keyCode = e.keyCode;

    // Normalización de teclas para controles remotos de TV
    const isUp = key === 'ArrowUp' || key === 'Up' || keyCode === 38;
    const isDown = key === 'ArrowDown' || key === 'Down' || keyCode === 40;
    const isLeft = key === 'ArrowLeft' || key === 'Left' || keyCode === 37;
    const isRight = key === 'ArrowRight' || key === 'Right' || keyCode === 39;
    const isEnter = key === 'Enter' || key === 'Select' || key === 'Ok' || keyCode === 13;
    const isBack = key === 'Backspace' || key === 'Escape' || key === 'Back' || keyCode === 8 || keyCode === 27 || keyCode === 461;

    if (focusArea === 'header') {
      if (isDown) {
        setFocusArea('grid');
      } else if (isEnter || isBack) {
        onClose();
      }
    } else {
      // Grid Navigation
      const rowCapacity = movies.length;

      if (isRight) {
        if (focusIndex + 1 < rowCapacity) {
          setFocusIndex(prev => prev + 1);
        } else {
          loadMore();
        }
      } else if (isLeft) {
        if (focusIndex > 0) {
          setFocusIndex(prev => prev - 1);
        }
      } else if (isDown) {
        if (focusIndex + COLS < rowCapacity) {
          setFocusIndex(prev => prev + COLS);
        } else {
          loadMore();
        }
      } else if (isUp) {
        if (focusIndex >= COLS) {
          setFocusIndex(prev => prev - COLS);
        } else {
          setFocusArea('header');
        }
      } else if (isEnter) {
        if (movies[focusIndex]) {
          onMovieSelect(movies[focusIndex]);
        }
      } else if (isBack) {
        onClose();
      }
    }

    if (isUp || isDown || isLeft || isRight || isEnter || isBack) {
      e.preventDefault();
    }
  }, [isActive, focusArea, focusIndex, movies, onMovieSelect, onClose, loadMore]);

  // Predictive Loading Observer: Loads more content when user is within 3 rows of the bottom
  useEffect(() => {
    if (isActive && hasMore && !isLoading && focusArea === 'grid') {
      const rowCapacity = movies.length;
      const currentRow = Math.floor(focusIndex / COLS);
      const totalRows = Math.ceil(rowCapacity / COLS);
      
      if (currentRow >= totalRows - 3) {
        loadMore();
      }
    }
  }, [focusIndex, movies.length, hasMore, isLoading, isActive, focusArea, loadMore]);

  useEffect(() => {
    if (isActive) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isActive, handleKeyDown]);

  useEffect(() => {
    if (isActive && focusArea === 'grid') {
      const activeItem = gridScrollRef.current?.querySelector('.carousel-item.active');
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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
          <div className={`control-pill ${focusArea === 'header' ? 'focused' : ''}`.trim()}>
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
