"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Movie } from '@/types';
import { getMovieDetailAction } from '@/app/actions/movieActions';
import VideoPlayer from './VideoPlayer';
import { normalizeCertification } from '@/lib/utils';
import CarouselItem from '../Carousel/CarouselItem';


interface MovieDetailProps {
  movie: Movie;
  onClose: () => void;
}

const MovieDetail: React.FC<MovieDetailProps> = ({ movie: initialMovie, onClose }) => {
  const [movie, setMovie] = useState<Movie>(initialMovie);
  const [loading, setLoading] = useState(true);
  const [rowFocus, setRowFocus] = useState<'actions' | 'similar'>('actions');
  const [focusedIndex, setFocusedIndex] = useState(0); // 0: Play, 1: Trailer, 2: Favorites, 100: Close
  const [similarFocusIndex, setSimilarFocusIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const similarRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadFullDetail() {
      setLoading(true);
      try {
        const fullMovie = await getMovieDetailAction(initialMovie);
        setMovie(fullMovie);
      } catch (err) {
        console.error("Error loading detail:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFullDetail();
  }, [initialMovie]);

  // Bloquear scroll del fondo
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Auto-scroll a similares
  useEffect(() => {
    if (rowFocus === 'similar' && similarRef.current) {
      similarRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (rowFocus === 'actions' && overlayRef.current) {
      overlayRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [rowFocus]);

  // Calcular el desplazamiento dinámicamente para que el foco quede hacia la derecha
  useEffect(() => {
    if (trackRef.current && trackRef.current.parentElement) {
      const firstChild = trackRef.current.children[0] as HTMLElement;
      const containerWidth = trackRef.current.parentElement.offsetWidth;
      
      if (firstChild) {
        const itemWidth = firstChild.offsetWidth + 20; // 180px + 20px gap
        
        // Calculamos cuánto desplazar para que el ítem quede a la derecha
        // Queremos que el ítem (similarFocusIndex) esté en el lado derecho del container.
        // Posición ideal = index * itemWidth - (containerWidth - itemWidth - 60)
        // El 60 es para dejar un pequeño margen a la derecha
        const idealTranslate = -(similarFocusIndex * itemWidth) + (containerWidth - itemWidth - 100);
        
        // Pero no queremos desplazar positivamente (que se vea vacío a la izquierda del primer ítem)
        setTranslateX(Math.min(0, idealTranslate));
      }
    }
  }, [similarFocusIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Detener la propagación inmediatamente para que el fondo NO reciba nada
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    if (isPlaying) return; // VideoPlayer handles its own keys


    if (rowFocus === 'actions') {
      switch (e.key) {
        case 'ArrowRight':
          if (focusedIndex < 1) setFocusedIndex(prev => prev + 1);
          break;
        case 'ArrowLeft':
          if (focusedIndex > 0 && focusedIndex !== 100) setFocusedIndex(prev => prev - 1);
          break;
        case 'ArrowUp':
          setFocusedIndex(100); 
          break;
        case 'ArrowDown':
          if (focusedIndex === 100) {
            setFocusedIndex(0);
          } else if (movie.similar && movie.similar.length > 0) {
            setRowFocus('similar');
            setSimilarFocusIndex(0);
          }
          break;
        case 'Enter':
          if (focusedIndex === 100) onClose();
          else if (focusedIndex === 0) setIsPlaying(true);
          break;

        case 'Escape':
        case 'Backspace':
          onClose();
          break;
      }
    } else if (rowFocus === 'similar') {
      switch (e.key) {
        case 'ArrowRight':
          setSimilarFocusIndex(prev => Math.min(prev + 1, (movie.similar?.length || 1) - 1));
          break;
        case 'ArrowLeft':
          setSimilarFocusIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'ArrowUp':
          setRowFocus('actions');
          break;
        case 'Enter':
          if (movie.similar?.[similarFocusIndex]) {
            console.log('Navegando a similar:', movie.similar[similarFocusIndex].title);
          }
          break;
        case 'Escape':
        case 'Backspace':
          onClose();
          break;
      }
    }
  }, [focusedIndex, isPlaying, movie, onClose, rowFocus, similarFocusIndex]);

  useEffect(() => {
    if (!isPlaying) {
      window.addEventListener('keydown', handleKeyDown, { capture: true });
      // Enfocar el contenedor para asegurar que recibe eventos (aunque sea en window, ayuda al navegador)
      overlayRef.current?.focus();
      return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }
  }, [handleKeyDown, isPlaying]);


  const backdropUrl = movie.backdrop_path 
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : `https://image.tmdb.org/t/p/original${movie.poster_path}`;

  const titleMatch = movie.title.match(/(.*)\s\((\d{4})\)$/);
  const titleName = titleMatch ? titleMatch[1] : movie.title;
  const titleYear = titleMatch ? titleMatch[2] : movie.release_date?.split('-')[0] || '';

  return (
    <div 
      className="movie-detail-overlay" 
      ref={overlayRef}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      <div 
        className="detail-backdrop" 
        style={{ backgroundImage: `url(${backdropUrl})` }}
      />
      <div className="detail-gradient" />
      
      <button 
        className={`detail-btn btn-close${focusedIndex === 100 ? ' focused' : ''}`}
        onClick={onClose}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="3" fill="none">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div className="detail-content">
        <h1 className="detail-title">{titleName}</h1>
        
        <div className="detail-meta">
          <div className="detail-rating">
            <span className="star-icon">★</span>
            {movie.vote_average?.toFixed(1) || '0.0'}
          </div>
          <span className="meta-separator">•</span>
          <span>{titleYear}</span>
          
          <span className="meta-separator">•</span>
          <span className={`detail-certification-badge ${loading && !movie.certification ? 'skeleton' : ''}`}>
            {normalizeCertification(movie.certification)}
          </span>

          {loading && !movie.runtime ? (
            <>
              <span className="meta-separator">•</span>
              <span className="skeleton" style={{ width: '60px', height: '1.2rem', display: 'inline-block' }} />
            </>
          ) : movie.runtime && (
            <>
              <span className="meta-separator">•</span>
              <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}min</span>
            </>
          )}
          
          <span className="meta-separator">•</span>
          <span className="detail-quality-tag">{movie.quality || 'HD'}</span>

          {(() => {
            const languages = movie.languages && movie.languages.length > 0 ? movie.languages : ['Latino'];
            
            return languages.map((lang, lidx) => {
              const lower = lang.toLowerCase();
              let flagCode = null;
              let isSub = false;

              if (lower.includes('lat')) flagCode = 'mx';
              else if (lower.includes('cast') || lower.includes('esp')) flagCode = 'es';
              else if (lower.includes('sub')) isSub = true;
              else if (movie.origin_country) flagCode = movie.origin_country.toLowerCase();

              return (
                <div key={`${lang}-${lidx}`} className="language-pill">
                  <div className="pill-icon">
                    {flagCode ? (
                      <img 
                        src={`https://flagcdn.com/w40/${flagCode}.png`} 
                        alt={flagCode.toUpperCase()}
                        className="pill-flag"
                      />
                    ) : isSub ? (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line>
                        <line x1="8" y1="23" x2="16" y2="23"></line>
                      </svg>
                    )}
                  </div>
                  <span className="pill-text">{lang.toUpperCase()}</span>
                </div>
              );
            });
          })()}
        </div>

        {movie.genres_names && movie.genres_names.length > 0 && (
          <div className="detail-genres">
            <span className="languages-label">Géneros:</span>
            {movie.genres_names.join(' • ')}
          </div>
        )}

        <p className={`detail-overview ${(loading && !movie.overview) ? 'skeleton' : ''}`}>
          {movie.overview || (loading ? 'Cargando contenido cinematográfico...' : 'Sinopsis no disponible.')}
        </p>

        <div className="detail-actions">
          <button className={`detail-btn btn-play${rowFocus === 'actions' && focusedIndex === 0 ? ' focused' : ''}`}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Reproducir
          </button>
          
          <button className={`detail-btn${rowFocus === 'actions' && focusedIndex === 1 ? ' focused' : ''}`}>
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            Favoritos
          </button>
        </div>

        {(loading && (!movie.similar || movie.similar.length === 0)) ? (
          <div className="detail-similar-section">
            <h3 className="similar-title">Películas Similares</h3>
            <div className="similar-track" style={{ gap: '20px' }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skeleton" style={{ flex: '0 0 180px', height: '280px', borderRadius: '12px' }} />
              ))}
            </div>
          </div>
        ) : movie.similar && movie.similar.length > 0 && (
          <div className="detail-similar-section" ref={similarRef}>
            <h3 className="similar-title">Películas Similares</h3>
            <div 
              ref={trackRef}
              className="similar-track" 
              style={{ transform: `translateX(${translateX}px)`, gap: '20px', transition: 'transform 0.4s ease' }}
            >
              {movie.similar.map((s, idx) => (
                <CarouselItem
                  key={s.id}
                  movie={s}
                  row={100} // Dummy row for Detail view
                  col={idx}
                  isActive={rowFocus === 'similar' && similarFocusIndex === idx}
                  disableAutoScroll={true}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {isPlaying && (
        <VideoPlayer 
          movie={movie} 
          onClose={() => setIsPlaying(false)} 
        />
      )}
    </div>
  );
};

export default MovieDetail;
