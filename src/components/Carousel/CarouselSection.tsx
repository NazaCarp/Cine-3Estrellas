"use client";

import React, { useRef, useEffect } from 'react';
import CarouselItem from './CarouselItem';
import { Movie } from '@/types';

interface CarouselSectionProps {
  rowIndex: number;
  title: string;
  movies: Movie[];
  totalMovies?: number;
  isActive: boolean;
  focusedCol: number;
}

const CarouselSection: React.FC<CarouselSectionProps> = React.memo(({
  rowIndex,
  title,
  movies,
  totalMovies,
  isActive,
  focusedCol,
}) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && sectionRef.current) {
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [isActive]);

  useEffect(() => {
    const updateTransform = () => {
      if (trackRef.current) {
        // Calculate dynamic width based on the actual rendered item size
        const firstChild = trackRef.current.children[0] as HTMLElement;
        const baseItemWidth = firstChild ? firstChild.offsetWidth : 180;
        const itemWidth = baseItemWidth + 20; // Include CSS gap of 20px
        
        const translateX = -(focusedCol * itemWidth);
        trackRef.current.style.transform = `translateX(${translateX}px)`;
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
            />
          ))}
          {movies.length > 0 && (
            <div className={`see-more-card${isActive && focusedCol === Math.min(movies.length, 20) ? ' active' : ''}`.trim()}>
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
