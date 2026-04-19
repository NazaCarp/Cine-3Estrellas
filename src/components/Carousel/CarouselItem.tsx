"use client";

import React from 'react';
import { Movie } from '@/types';

interface CarouselItemProps {
  movie: Movie;
  row: number;
  col: number;
  isActive: boolean;
}

const CarouselItem: React.FC<CarouselItemProps> = React.memo(({ movie, isActive }) => {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : 'https://via.placeholder.com/300x450?text=No+Image';

  const titleMatch = movie.title.match(/(.*)\s\((\d{4})\)$/);
  const titleName = titleMatch ? titleMatch[1] : movie.title;
  const titleYear = titleMatch ? titleMatch[2] : '';

  const titleRef = React.useRef<HTMLSpanElement>(null);
  const [duration, setDuration] = React.useState(0);
  const [dist, setDist] = React.useState(0);

  const itemRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [isActive]);

  React.useEffect(() => {
    let timeoutId: number;

    if (isActive && titleRef.current) {
      const textWidth = titleRef.current.scrollWidth;
      const containerWidth = titleRef.current.parentElement?.getBoundingClientRect().width || 160;
      const displacement = Math.max(0, textWidth - containerWidth);
      
      if (displacement > 5) {
        // Velocidad constante de 40px/s para un movimiento ágil pero legible
        const pixelsPerSecond = 40;
        const travelTimeMs = (displacement / pixelsPerSecond) * 1000;
        const pauseTimeMs = 400; // Pausa de 400ms para un arranque instantáneo
        
        setDuration(travelTimeMs / 1000);
        
        const cycle = (isForward: boolean) => {
          setDist(isForward ? -displacement : 0);
          timeoutId = window.setTimeout(() => cycle(!isForward), travelTimeMs + pauseTimeMs);
        };
        
        // Pausa inicial antes de mover
        timeoutId = window.setTimeout(() => cycle(true), pauseTimeMs);
      } else {
        setDuration(0);
        setDist(0);
      }
    } else {
      setDuration(0);
      setDist(0);
    }

    return () => clearTimeout(timeoutId);
  }, [isActive]);

  return (
    <div ref={itemRef} className={`carousel-item${isActive ? ' active' : ''}`}>
      <div className="poster-wrapper">
        <img
          className="item-bg"
          src={posterUrl}
          alt={movie.title}
          loading="lazy"
        />
      </div>
      <div className="item-text">
        <div className="title-marquee">
          <span 
            ref={titleRef} 
            style={{ 
              transform: `translateX(${dist}px)`,
              transition: duration > 0 ? `transform ${duration}s linear` : 'none'
            }}
          >
            {titleName}
          </span>
        </div>
        <div className="item-meta">
          <span className="item-rating">
            <span className="star-icon">★</span>
            {movie.vote_average?.toFixed(1)}
          </span>
          {titleYear && <>
            <span className="meta-separator">•</span>
            <span className="item-year">{titleYear}</span>
          </>}
        </div>
      </div>
    </div>
  );
});

export default CarouselItem;
