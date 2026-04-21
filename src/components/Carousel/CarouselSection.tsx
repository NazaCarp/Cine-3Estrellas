"use client";

import React, { useRef, useEffect } from 'react';
import CarouselItem from './CarouselItem';
import { Category, Movie } from '@/types';

interface CarouselSectionProps {
  rowIndex: number;
  category?: Category;
  title: string;
  movies: Movie[];
  totalMovies?: number;
  isActive: boolean;
  focusedCol: number;
  onItemFocus?: (row: number, col: number) => void;
  onItemClick?: (movie: Movie | null, category?: Category) => void;
  preventAutoScroll?: boolean;
}

const CarouselSection: React.FC<CarouselSectionProps> = React.memo(({
  rowIndex,
  category,
  title,
  movies,
  totalMovies,
  isActive,
  focusedCol,
  onItemFocus,
  onItemClick,
  preventAutoScroll = false,
}) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && !preventAutoScroll && sectionRef.current) {
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [isActive, preventAutoScroll]);

  useEffect(() => {
    const updateTransform = () => {
      if (trackRef.current) {
        // Calculate dynamic width based on the actual rendered item size
        const firstChild = trackRef.current.children[0] as HTMLElement;
        const baseItemWidth = firstChild ? firstChild.offsetWidth : 180;
        const itemWidth = baseItemWidth + 20; // Include CSS gap of 20px
        const containerWidth = trackRef.current.parentElement?.offsetWidth || 1000;
        
        // Mantener el ítem enfocado hacia el lado derecho de la vista
        const idealTranslate = -(focusedCol * itemWidth) + (containerWidth - itemWidth - 100);
        const finalTranslate = Math.min(0, idealTranslate);
        
        trackRef.current.style.transform = `translateX(${finalTranslate}px)`;
      }
    };

    updateTransform();
    window.addEventListener('resize', updateTransform);
    
    return () => {
      window.removeEventListener('resize', updateTransform);
    };
  }, [focusedCol]);

  if (movies.length === 0) return null;

  return (
    <div
      ref={sectionRef}
      className={`carousel-section${isActive ? ' active' : ''}`.trim()}
      id={`carousel-${rowIndex}`}
    >
      <h2 className="carousel-title">{title}</h2>
      <div className="carousel-track-wrapper">
        <div ref={trackRef} className="carousel-track">
          {movies.slice(0, 20).map((movie, cIndex) => (
            <CarouselItem
              key={`${movie.id}-${cIndex}`}
              movie={movie}
              row={rowIndex}
              col={cIndex}
              isActive={isActive && focusedCol === cIndex}
              disableAutoScroll={true}
              onFocus={onItemFocus}
              onClick={onItemClick}
              preventAutoScroll={preventAutoScroll}
            />
          ))}
          {movies.length > 0 && (
            <div 
              className={`see-more-card${isActive && focusedCol === Math.min(movies.length, 20) ? ' active' : ''}`.trim()}
              onPointerEnter={() => onItemFocus?.(rowIndex, Math.min(movies.length, 20))}
              onClick={() => onItemClick?.(null, category)}
            >
              <div className="icon-circle">
                <span className="material-symbols-outlined">add</span>
              </div>
              <div className="see-more-text">
                <span>Ver Más</span>
                {totalMovies && totalMovies > Math.min(movies.length, 20) && (
                  <small>+{totalMovies - Math.min(movies.length, 20)} títulos</small>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CarouselSection;
