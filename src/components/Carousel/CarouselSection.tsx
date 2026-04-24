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
        block: 'nearest',
      });
    }
  }, [isActive, preventAutoScroll]);

  const currentTranslateRef = useRef(0);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartTranslate = useRef(0);
  const hasMoved = useRef(false);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);


  useEffect(() => {
    const updateTransform = () => {
      if (trackRef.current && !isDragging.current) {
        const firstChild = trackRef.current.children[0] as HTMLElement;
        if (!firstChild) return;

        const baseItemWidth = firstChild.offsetWidth;
        const itemWidth = baseItemWidth + 20;
        const containerWidth = trackRef.current.parentElement?.clientWidth || 1000;
        const totalWidth = trackRef.current.scrollWidth;
        
        const margin = 100; // Margen de cortesía
        
        const itemLeft = focusedCol * itemWidth;
        const itemRight = itemLeft + itemWidth;
        
        let newTranslate = currentTranslateRef.current;
        const viewLeft = -newTranslate;
        const viewRight = viewLeft + containerWidth;
        
        if (itemLeft < viewLeft + margin) {
          newTranslate = -(itemLeft - margin);
        } else if (itemRight > viewRight - margin) {
          newTranslate = -(itemRight - containerWidth + margin);
        }
        
        const maxScroll = -(totalWidth - containerWidth);
        
        if (focusedCol === 0) {
          newTranslate = 0;
        } else {
          newTranslate = Math.min(0, Math.max(newTranslate, Math.min(0, maxScroll)));
        }

        currentTranslateRef.current = newTranslate;
        trackRef.current.style.transition = 'transform 0.5s cubic-bezier(0.2, 0, 0, 1)';
        trackRef.current.style.transform = `translateX(${newTranslate}px)`;
      }
    };

    updateTransform();
    window.addEventListener('resize', updateTransform);
    return () => window.removeEventListener('resize', updateTransform);
  }, [focusedCol]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!trackRef.current) return;
    isDragging.current = true;
    hasMoved.current = false;
    dragStartX.current = e.clientX;
    dragStartTranslate.current = currentTranslateRef.current;
    lastX.current = e.clientX;
    lastTime.current = Date.now();
    velocity.current = 0;
    trackRef.current.style.transition = 'none';

  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !trackRef.current) return;
    
    const deltaX = e.clientX - dragStartX.current;
    
    if (!hasMoved.current && Math.abs(deltaX) > 15) {
      hasMoved.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    
    if (hasMoved.current) {
      const now = Date.now();
      const dt = now - lastTime.current;
      if (dt > 0) {
        // Calculate velocity (pixels per ms)
        const currentV = (e.clientX - lastX.current) / dt;
        // Average with previous velocity for smoothing
        velocity.current = velocity.current * 0.4 + currentV * 0.6;
      }
      lastX.current = e.clientX;
      lastTime.current = now;

      let newTranslate = dragStartTranslate.current + deltaX;
      
      const containerWidth = trackRef.current.parentElement?.clientWidth || 0;
      const totalWidth = trackRef.current.scrollWidth;
      const maxScroll = -(totalWidth - containerWidth);
      
      if (newTranslate > 0) newTranslate /= 3;
      if (newTranslate < maxScroll) newTranslate = maxScroll + (newTranslate - maxScroll) / 3;
      
      trackRef.current.style.transform = `translateX(${newTranslate}px)`;
    }

  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current || !trackRef.current) return;
    isDragging.current = false;
    
    if (hasMoved.current) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      
      const style = window.getComputedStyle(trackRef.current);
      const matrix = new WebKitCSSMatrix(style.transform);
      let currentPos = matrix.m41;
      
      const containerWidth = trackRef.current.parentElement?.clientWidth || 0;
      const totalWidth = trackRef.current.scrollWidth;
      const maxScroll = -(totalWidth - containerWidth);
      
      // Calculate momentum (velocity * damping factor)
      // If velocity is low, it just snaps to the nearest bound
      const momentumFactor = 250; 
      let finalTranslate = currentPos + (velocity.current * momentumFactor);
      
      // Clamp final position
      finalTranslate = Math.min(0, Math.max(finalTranslate, maxScroll));
      
      currentTranslateRef.current = finalTranslate;
      // Use a longer, smoother transition for momentum
      trackRef.current.style.transition = 'transform 0.7s cubic-bezier(0.1, 0.45, 0.1, 1)';
      trackRef.current.style.transform = `translateX(${finalTranslate}px)`;
    }


    setTimeout(() => {
      hasMoved.current = false;
    }, 100);
  };

  if (movies.length === 0) return null;

  return (
    <div
      ref={sectionRef}
      className={`carousel-section${isActive ? ' active' : ''}`.trim()}
      id={`carousel-${rowIndex}`}
    >
      <h2 className="carousel-title">{title}</h2>
      <div 
        className="carousel-track-wrapper"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: 'grab', touchAction: 'none' }}
      >
        <div ref={trackRef} className="carousel-track" style={{ transition: 'transform 0.5s cubic-bezier(0.2, 0, 0, 1)' }}>
          {movies.slice(0, 20).map((movie, cIndex) => (
            <CarouselItem
              key={`${movie.id}-${cIndex}`}
              movie={movie}
              row={rowIndex}
              col={cIndex}
              isActive={isActive && focusedCol === cIndex}
              disableAutoScroll={true}
              onFocus={(r, c) => !isDragging.current && onItemFocus?.(r, c)}
              onClick={(m) => !hasMoved.current && onItemClick?.(m)}
              preventAutoScroll={preventAutoScroll}
            />
          ))}
          {movies.length > 0 && (
            <div 
              className={`see-more-card${isActive && focusedCol === Math.min(movies.length, 20) ? ' active' : ''}`.trim()}
              onPointerEnter={() => !isDragging.current && onItemFocus?.(rowIndex, Math.min(movies.length, 20))}
              onClick={() => !hasMoved.current && onItemClick?.(null, category)}
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
          <div className="carousel-spacer" style={{ flex: '0 0 100px', width: '100px' }} />
        </div>
      </div>
    </div>
  );
});

export default CarouselSection;
