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

  const currentTranslateRef = useRef(0);

  useEffect(() => {
    const updateTransform = () => {
      if (trackRef.current) {
        const firstChild = trackRef.current.children[0] as HTMLElement;
        if (!firstChild) return;

        const baseItemWidth = firstChild.offsetWidth;
        const itemWidth = baseItemWidth + 20; // Include CSS gap
        const containerWidth = trackRef.current.parentElement?.offsetWidth || 1000;
        
        const margin = 80; // Margen de cortesía
        
        const itemLeft = focusedCol * itemWidth;
        const itemRight = itemLeft + itemWidth;
        
        let newTranslate = currentTranslateRef.current;
        
        // Definir la "ventana" visible actual
        const viewLeft = -newTranslate;
        const viewRight = viewLeft + containerWidth;
        
        // Lógica de scroll inteligente:
        // Si el ítem se sale por la IZQUIERDA (o entra en el margen)
        if (itemLeft < viewLeft + margin) {
          newTranslate = -(itemLeft - margin);
        } 
        // Si el ítem se sale por la DERECHA (o entra en el margen)
        else if (itemRight > viewRight - margin) {
          newTranslate = -(itemRight - containerWidth + margin);
        }
        
        // Límites: No permitir scroll más allá del inicio (0) 
        // o del final (scrollWidth - containerWidth)
        const totalWidth = trackRef.current.scrollWidth;
        const maxScroll = -(totalWidth - containerWidth);
        
        if (focusedCol === 0) {
          newTranslate = 0;
        } else {
          newTranslate = Math.min(0, Math.max(newTranslate, Math.min(0, maxScroll)));
        }

        currentTranslateRef.current = newTranslate;
        trackRef.current.style.transform = `translateX(${newTranslate}px)`;
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
