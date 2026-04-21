"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Movie } from '@/types';

interface HeroCarouselProps {
  movies: Movie[];
  isActiveActions: boolean;
  isActiveIndicators: boolean;
  focusedCol?: number;
  onSlideChange?: (index: number) => void;
  onActionFocus?: (col: number) => void;
  onActionClick?: (movie: Movie) => void;
  onIndicatorFocus?: (col: number) => void;
  preventAutoScroll?: boolean;
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({ 
  movies, 
  isActiveActions, 
  isActiveIndicators, 
  focusedCol, 
  onSlideChange,
  onActionFocus,
  onActionClick,
  onIndicatorFocus,
  preventAutoScroll = false
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Notify parent of slide change so keyboard focus state stays synced
  useEffect(() => {
    if (onSlideChange) {
      onSlideChange(currentIndex);
    }
  }, [currentIndex, onSlideChange]);

  // Sync keyboard navigation on indicators to change slides immediately
  useEffect(() => {
    if (isActiveIndicators && focusedCol !== undefined) {
      if (focusedCol >= 0 && focusedCol < movies.length && focusedCol !== currentIndex) {
        setCurrentIndex(focusedCol);
      }
    }
  }, [isActiveIndicators, focusedCol, movies.length, currentIndex]);


  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % movies.length);
  }, [movies.length]);

  const isActive = isActiveActions || isActiveIndicators;

  // Scroll to top when the hero gets focus to ensure the user can see the whole poster
  useEffect(() => {
    if (isActive && !preventAutoScroll) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [isActive, preventAutoScroll]);

  useEffect(() => {
    // Pausar la rotación si el usuario está enfocado en él (para que pueda leer la sinopsis o elegir un botón)
    if (isActive) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => clearInterval(interval);
  }, [isActive, nextSlide]);

  if (!movies || movies.length === 0) return null;

  const currentMovie = movies[currentIndex];
  
  // Clean title: remove trailing " (YYYY)"
  const titleMatch = currentMovie.title.match(/(.*)\s\((\d{4})\)$/);
  const cleanTitle = titleMatch ? titleMatch[1] : currentMovie.title;

  // Helper to extract year
  const getYear = (date?: string) => {
    if (!date) return "";
    return date.split('-')[0];
  };

  // Helper to format runtime (e.g. 142 -> 2h 22m)
  const formatRuntime = (minutes?: number) => {
    if (!minutes) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className={`hero-carousel ${isActive ? 'focus' : ''}`.trim()}>
      {movies.map((movie, index) => {
        const isCurrent = index === currentIndex;
        
        // Match title for each movie in the loop to be safe, 
        // though we only strictly need it for the visible one
        const mTitleMatch = movie.title.match(/(.*)\s\((\d{4})\)$/);
        const mTitle = mTitleMatch ? mTitleMatch[1] : movie.title;

        const backdropUrl = movie.backdrop_path
          ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
          : 'https://via.placeholder.com/1200x600?text=No+Backdrop';

        return (
          <div
            key={movie.id}
            className={`hero-slide${isCurrent ? ' active' : ''}`.trim()}
            style={{ backgroundImage: `url(${backdropUrl})` }}
          >
            <div className="hero-overlay">
              <div className="hero-content">
                <span className="hero-trending">#{index + 1} EN TENDENCIA</span>
                <h2 className="hero-title">{mTitle}</h2>
                <div className="hero-meta">
                  {movie.quality && (
                    <>
                      <span className="hero-quality">{movie.quality}</span>
                      <span className="meta-separator">•</span>
                    </>
                  )}
                  <span className="hero-rating">★ {movie.vote_average?.toFixed(1)}</span>
                  <span className="meta-separator">•</span>
                  <span className="hero-year">{getYear(movie.release_date)}</span>
                  {movie.runtime && (
                    <>
                      <span className="meta-separator">•</span>
                      <span className="hero-runtime">{formatRuntime(movie.runtime)}</span>
                    </>
                  )}
                </div>
                {movie.overview && (
                  <p className="hero-overview">
                    {movie.overview}
                  </p>
                )}
                {movie.genres_names && movie.genres_names.length > 0 && (
                  <div className="hero-genres-text">
                    <span className="genres-label">Géneros:</span> {movie.genres_names.slice(0, 3).join(', ')}
                  </div>
                )}
                <div className="hero-actions">
                  <button 
                    className={`btn-primary${isActiveActions && focusedCol === 0 ? ' focused' : ''}`.trim()}
                    onPointerEnter={() => onActionFocus?.(0)}
                    onClick={() => onActionClick?.(movie)}
                  >
                    Ver ahora
                  </button>
                  <button 
                    className={`btn-secondary${isActiveActions && focusedCol === 1 ? ' focused' : ''}`.trim()}
                    onPointerEnter={() => onActionFocus?.(1)}
                    onClick={() => onActionClick?.(movie)}
                  >
                    Más info
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="hero-indicators">
        {movies.map((_, index) => {
          const dotClasses = ['indicator-dot'];
          if (index === currentIndex) dotClasses.push('active');
          if (isActiveIndicators && focusedCol === index) dotClasses.push('focused');

          return (
            <div
              key={index}
              className={dotClasses.join(' ')}
              onPointerEnter={() => onIndicatorFocus?.(index)}
              onClick={() => {
                setCurrentIndex(index);
                onIndicatorFocus?.(index);
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default HeroCarousel;
