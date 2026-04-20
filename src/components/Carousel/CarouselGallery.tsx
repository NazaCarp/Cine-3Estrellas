"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import HeroCarousel from './HeroCarousel';
import CarouselSection from './CarouselSection';
import Sidebar from '../Navigation/Sidebar';
import MovieDetail from '../Detail/MovieDetail';
import { Category, Movie } from '@/types';
import SearchView from '../Views/SearchView';
import ExploreView from '../Explore/ExploreView';
import CategoryGridView from './CategoryGridView';

interface CarouselGalleryProps {
  initialCategories: Category[];
}

const CarouselGallery: React.FC<CarouselGalleryProps> = ({ initialCategories }) => {
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [activeTab, setActiveTab] = useState<'inicio' | 'explorar' | 'favoritos' | 'buscar'>('inicio');
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const [sidebarFocusedIndex, setSidebarFocusedIndex] = useState(1); // Start at Inicio (index 1)
  const [lastRowBeforeSidebar, setLastRowBeforeSidebar] = useState(0);
  const [lastColBeforeSidebar, setLastColBeforeSidebar] = useState(0);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<Category | null>(null);

  const [lastColPerRow, setLastColPerRow] = useState<Record<number, number>>(
    { 0: 0, 1: 0 }
  );

  const lastTimeAtColZero = useRef<number>(0);

  const heroMovies = initialCategories
    .find(c => c.name.toLowerCase() === 'lo más visto')
    ?.movies?.slice(0, 7) || [];

  const displayCategories = useMemo(() =>
    initialCategories.filter(c => c.name.toLowerCase() !== 'lo más visto'),
    [initialCategories]);

  const handleHeroSlideChange = useCallback((index: number) => {
    setLastColPerRow(prev => {
      if (prev[1] === index) return prev;
      return { ...prev, 1: index };
    });
  }, []);

  const handleOpenGrid = useCallback((category: Category) => {
    setExpandedCategory(category);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Si hay una categoría expandida o película seleccionada, ignorar TODO inmediatamente
    if (selectedMovie || expandedCategory) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace'].includes(e.key)) {
        // We let the Grid or Detail handle their own events, but we prevent bubbling/default here if necessary
        // Actually, Detail handles its own, so we only return early.
      }
      return;
    }

    if (isSidebarActive) {
      switch (e.key) {
        case 'ArrowDown':
          setSidebarFocusedIndex(prev => Math.min(prev + 1, 3));
          break;
        case 'ArrowUp':
          setSidebarFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'ArrowRight':
          setIsSidebarActive(false);
          // When leaving sidebar, ensure we are in the correct tab view
          const tabIds: ('buscar' | 'inicio' | 'explorar' | 'favoritos')[] = ['buscar', 'inicio', 'explorar', 'favoritos'];
          setActiveTab(tabIds[sidebarFocusedIndex]);

          if (tabIds[sidebarFocusedIndex] === 'inicio') {
            setCurrentRow(lastRowBeforeSidebar);
            setCurrentCol(lastColBeforeSidebar);
          }
          break;
        case 'Enter':
          const tabs: ('buscar' | 'inicio' | 'explorar' | 'favoritos')[] = ['buscar', 'inicio', 'explorar', 'favoritos'];
          setActiveTab(tabs[sidebarFocusedIndex]);
          setIsSidebarActive(false);
          break;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        e.preventDefault();
      }
      return;
    }

    // Only handle Home navigation if activeTab is 'inicio'
    if (activeTab === 'inicio') {
      const totalRows = displayCategories.length + 2;
      let nextRow = currentRow;
      let nextCol = currentCol;

      switch (e.key) {
        case 'ArrowRight':
          if (currentRow === 0) {
            nextCol = Math.min(currentCol + 1, 1);
          } else if (currentRow === 1) {
            nextCol = Math.min(currentCol + 1, heroMovies.length - 1);
          } else {
            const catIndex = currentRow - 2;
            const movieCount = displayCategories[catIndex]?.movies?.length || 0;
            // Limit navigation to the first 20 movies + the "See More" card
            const maxCol = Math.min(movieCount, 20);
            nextCol = Math.min(currentCol + 1, maxCol);
          }
          break;
        case 'ArrowLeft':
          if (currentCol === 0) {
            const now = Date.now();
            if (now - lastTimeAtColZero.current > 500) {
              setLastRowBeforeSidebar(currentRow);
              setLastColBeforeSidebar(currentCol);
              setIsSidebarActive(true);
            }
            return;
          }
          nextCol = currentCol - 1;
          if (nextCol === 0) {
            lastTimeAtColZero.current = Date.now();
          }
          break;
        case 'ArrowDown':
          if (currentRow < totalRows - 1) {
            nextRow = currentRow + 1;
            nextCol = lastColPerRow[nextRow] || 0;
          }
          break;
        case 'ArrowUp':
          if (currentRow > 0) {
            nextRow = currentRow - 1;
            nextCol = lastColPerRow[nextRow] || 0;
          }
          break;
        case 'Enter':
          if (currentRow === 1) {
            setSelectedMovie(heroMovies[currentCol]);
          } else if (currentRow >= 2) {
            const catIndex = currentRow - 2;
            const category = displayCategories[catIndex];
            const movieCount = category?.movies?.length || 0;
            const maxVisible = Math.min(movieCount, 20);

            if (currentCol < maxVisible) {
              const movie = category?.movies?.[currentCol];
              if (movie) setSelectedMovie(movie);
            } else if (currentCol === maxVisible && category) {
              // Si estamos en la columna "Ver Más"
              handleOpenGrid(category);
            }
          }
          break;
      }

      if (nextRow !== currentRow || nextCol !== currentCol) {
        if (nextRow !== currentRow) {
          setLastColPerRow(prev => ({
            ...prev,
            [currentRow]: currentCol
          }));
          lastTimeAtColZero.current = 0;
        }

        setCurrentRow(nextRow);
        setCurrentCol(nextCol);

        if (nextCol !== 0) {
          lastTimeAtColZero.current = 0;
        }
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace'].includes(e.key)) {
        e.preventDefault();
      }
    }
  }, [currentRow, currentCol, isSidebarActive, sidebarFocusedIndex, lastColPerRow, displayCategories, heroMovies.length, lastRowBeforeSidebar, lastColBeforeSidebar, selectedMovie, activeTab, expandedCategory, handleOpenGrid]);

  useEffect(() => {
    // We update the active tab immediately when the sidebar selection changes
    // This provides visual feedback, but the "activation" of the view depends on isSidebarActive
    if (isSidebarActive) {
      const tabIds: ('buscar' | 'inicio' | 'explorar' | 'favoritos')[] = ['buscar', 'inicio', 'explorar', 'favoritos'];
      setActiveTab(tabIds[sidebarFocusedIndex]);
    }
  }, [sidebarFocusedIndex, isSidebarActive]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  if (initialCategories.length === 0) {
    return (
      <div className="carousels-container">
        <p style={{ textAlign: 'center', opacity: 0.5 }}>No se encontraron categorías.</p>
      </div>
    );
  }

  return (
    <div className="carousels-container" style={{ padding: 0 }}>
      <Sidebar
        activeTab={activeTab}
        focusedIndex={isSidebarActive ? sidebarFocusedIndex : null}
        isSidebarActive={isSidebarActive}
      />

      <div className={`main-content ${isSidebarActive || selectedMovie || expandedCategory ? 'dimmed' : ''}`.trim()}>
        <div style={{ display: activeTab === 'inicio' ? 'block' : 'none' }}>
          <HeroCarousel
            movies={heroMovies}
            isActiveActions={activeTab === 'inicio' && currentRow === 0}
            isActiveIndicators={activeTab === 'inicio' && currentRow === 1}
            focusedCol={currentCol}
            onSlideChange={handleHeroSlideChange}
          />

          <div style={{ padding: '0 40px', display: 'flex', flexDirection: 'column', gap: '60px' }}>
            {displayCategories.map((cat, rIndex) => (
              <CarouselSection
                key={cat.id}
                rowIndex={rIndex + 2}
                title={cat.name}
                movies={cat.movies || []}
                totalMovies={cat.total_movies}
                isActive={activeTab === 'inicio' && currentRow === rIndex + 2}
                focusedCol={currentRow === rIndex + 2 ? currentCol : lastColPerRow[rIndex + 2]}
              />
            ))}
          </div>
        </div>

        <div style={{ display: activeTab === 'buscar' ? 'block' : 'none' }}>
          <SearchView
            isActive={activeTab === 'buscar' && !isSidebarActive && !selectedMovie}
            onMovieSelect={setSelectedMovie}
            onReturnToSidebar={() => setIsSidebarActive(true)}
          />
        </div>

        <div style={{ display: activeTab === 'explorar' ? 'block' : 'none' }}>
          <ExploreView
            isActive={activeTab === 'explorar' && !isSidebarActive && !selectedMovie}
            onMovieSelect={setSelectedMovie}
            onReturnToSidebar={() => setIsSidebarActive(true)}
          />
        </div>

        <div style={{ display: activeTab === 'favoritos' ? 'block' : 'none' }}>
          <div className="empty-view" style={{ padding: '100px', textAlign: 'center', opacity: 0.5 }}>
            <h2>Sección Favoritos en construcción</h2>
          </div>
        </div>
      </div>

      {selectedMovie && (
        <MovieDetail
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
        />
      )}

      {expandedCategory && (
        <CategoryGridView
          category={expandedCategory}
          isActive={!!expandedCategory}
          onClose={() => setExpandedCategory(null)}
          onMovieSelect={setSelectedMovie}
        />
      )}
    </div>
  );
};

export default CarouselGallery;
