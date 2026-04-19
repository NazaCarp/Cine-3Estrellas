"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Movie } from '@/types';
import { extractQuality } from '@/lib/utils';

interface VideoPlayerProps {
  movie: Movie;
  onClose: () => void;
}

interface Quality {
  name: string;
  url: string;
  version?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ movie, onClose }) => {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  
  const [versions, setVersions] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [downloadQualities, setDownloadQualities] = useState<Quality[]>([]);
  const [activeDownloadTab, setActiveDownloadTab] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-set the first download tab when qualities are extracted
  useEffect(() => {
    if (downloadQualities.length > 0 && !activeDownloadTab) {
      setActiveDownloadTab(downloadQualities[0].version || null);
    }
  }, [downloadQualities, activeDownloadTab]);

  // Combine options smoothly into a single vertical list structure to calculate max focus
  // Items length: versions.length + (if downloadQualities is empty ? 1 : downloadQualities.length)
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    if (movie.versions) {
      setVersions(Object.keys(movie.versions));
    }
  }, [movie.versions]);

  const handleSelect = (url: string) => {
    setSelectedUrl(url);
  };

  // Helper to group downloads for UI and logic
  const getGroupedDownloads = () => {
    const grouped: Record<string, Quality[]> = {};
    downloadQualities.forEach(q => {
      const v = q.version || 'UNKNOWN';
      if (!grouped[v]) grouped[v] = [];
      grouped[v].push(q);
    });
    return grouped;
  };

  const getVersionDetails = (v: string) => {
    const low = v.toLowerCase();
    
    if (low.includes('lat')) {
      return { 
        flag: (
          <img 
            src="https://flagcdn.com/w80/mx.png" 
            alt="MX"
            className="dynamic-flag"
            style={{ borderRadius: '2px', width: '20px', height: '14px', objectFit: 'cover' }}
          />
        ), 
        label: "Latino", 
        code: "LAT",
        sub: "Audio Español Latino" 
      };
    }
    
    if (low.includes('cast') || low.includes('esp')) {
      return { 
        flag: (
          <img 
            src="https://flagcdn.com/w80/es.png" 
            alt="ES"
            className="dynamic-flag"
            style={{ borderRadius: '2px', width: '20px', height: '14px', objectFit: 'cover' }}
          />
        ), 
        label: "Castellano", 
        code: "ESP",
        sub: "Audio Español España" 
      };
    }
    
    if (low.includes('sub') || low.includes('orig')) {
      const countryCode = (movie.origin_country || 'US').toLowerCase();
      return { 
        flag: (
          <img 
            src={`https://flagcdn.com/w80/${countryCode}.png`} 
            alt={countryCode.toUpperCase()}
            className="dynamic-flag"
            style={{ borderRadius: '2px', width: '20px', height: '14px', objectFit: 'cover' }}
          />
        ), 
        label: "Original", 
        code: "ORIG",
        sub: "Subtitulado / Audio Orig." 
      };
    }
    
    return { 
      flag: (
        <svg viewBox="0 0 36 24" width="32" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <rect x="2" y="2" width="32" height="20" rx="4"></rect>
          <line x1="8" y1="2" x2="8" y2="22"></line>
          <line x1="28" y1="2" x2="28" y2="22"></line>
          <circle cx="18" cy="12" r="4"></circle>
        </svg>
      ), 
      label: v, 
      sub: "Versión de Película" 
    };
  };

  const handleExtractAll = async (vKeys: string[]) => {
    try {
      // Cancel previous extraction if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setExtracting(true);
      setError(null);
      
      const extractionPromises = vKeys.map(async (vKey) => {
        const val = movie.versions![vKey];
        const url = typeof val === 'object' ? (val as any).url : val;
        try {
          const res = await fetch(`/api/extract?url=${encodeURIComponent(url)}`, { signal });
          const data = await res.json();
          if (!res.ok) {
            return { error: data.error || 'Error al extraer.' };
          }
          return { qualities: data.qualities?.map((q: any) => ({ ...q, version: vKey.toUpperCase() })) || [] };
        } catch (e) { 
          if ((e as Error).name === 'AbortError') return null;
          return { error: 'Error de conexión.' };
        }
      });
      
      const results = await Promise.all(extractionPromises);
      
      if (signal.aborted) return;

      const allQualities: Quality[] = [];
      const errors: string[] = [];

      results.forEach(res => {
        if (!res) return;
        if (res.qualities) allQualities.push(...res.qualities);
        if (res.error) errors.push(res.error);
      });

      if (allQualities.length > 0) {
        setDownloadQualities(allQualities);
      } else if (errors.length > 0) {
        // Humanizar el error
        const firstError = Array.from(new Set(errors))[0];
        let humanMsg = firstError;
        
        if (firstError.toLowerCase().includes('fetch failed')) {
          humanMsg = 'El servidor no responde. Inténtalo de nuevo más tarde.';
        } else if (firstError.toLowerCase().includes('aborted')) {
          humanMsg = 'Extracción cancelada.';
        } else if (firstError.toLowerCase().includes('failed to fetch')) {
          humanMsg = 'Error de conexión. Revisa tu internet.';
        }
        
        setError(humanMsg);
      } else {
        setError('No se encontraron enlaces para esta película.');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError('Error de extracción.');
    } finally {
      setExtracting(false);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key;
    const keyCode = e.keyCode;

    // Normalización de teclas para controles remotos de TV
    const isUp = key === 'ArrowUp' || key === 'Up' || keyCode === 38;
    const isDown = key === 'ArrowDown' || key === 'Down' || keyCode === 40;
    const isLeft = key === 'ArrowLeft' || key === 'Left' || keyCode === 37;
    const isRight = key === 'ArrowRight' || key === 'Right' || keyCode === 39;
    const isEnter = key === 'Enter' || key === 'Select' || key === 'Ok' || keyCode === 13;
    const isBack = key === 'Backspace' || key === 'Escape' || key === 'Back' || keyCode === 8 || keyCode === 27 || keyCode === 461;

    if (isBack) {
      e.preventDefault();
      if (selectedUrl) setSelectedUrl(null);
      else onClose();
      return;
    }

    if (!selectedUrl) {
      const vCount = versions.length;
      const grouped = getGroupedDownloads();
      const tabKeys = Object.keys(grouped);
      const activeQualities = activeDownloadTab ? (grouped[activeDownloadTab] || []) : [];
      
      const tabStartIdx = vCount;
      const gridStartIdx = vCount + tabKeys.length;
      const totalItems = gridStartIdx + (activeDownloadTab ? activeQualities.length : 0);

      // Section Identification
      const isRepro = focusIndex < tabStartIdx;
      const isTabs = focusIndex >= tabStartIdx && focusIndex < gridStartIdx;
      const isGrid = focusIndex >= gridStartIdx;

      if (isDown) {
        e.preventDefault();
        if (isRepro) {
          if (focusIndex === vCount - 1) {
            setFocusIndex(vCount);
          } else {
            setFocusIndex(prev => prev + 1);
          }
        } else if (isTabs) {
          if (activeQualities.length > 0) setFocusIndex(gridStartIdx);
        } else if (isGrid) {
          const nextRowIdx = focusIndex + 3;
          if (nextRowIdx < totalItems) setFocusIndex(nextRowIdx);
        }
      } else if (isUp) {
        e.preventDefault();
        if (focusIndex === vCount) {
          setFocusIndex(vCount - 1);
        } else if (isRepro) {
          setFocusIndex(prev => Math.max(0, prev - 1));
        } else if (isTabs) {
          setFocusIndex(vCount - 1);
        } else if (isGrid) {
          const prevRowIdx = focusIndex - 3;
          if (prevRowIdx < gridStartIdx) {
            const activeTabIdx = tabKeys.indexOf(activeDownloadTab || '');
            setFocusIndex(tabStartIdx + (activeTabIdx >= 0 ? activeTabIdx : 0));
          } else {
            setFocusIndex(prevRowIdx);
          }
        }
      } else if (isRight) {
        e.preventDefault();
        if (isTabs) {
          const nextTabIdx = Math.min(tabKeys.length - 1, (focusIndex - tabStartIdx) + 1);
          const newIdx = tabStartIdx + nextTabIdx;
          setFocusIndex(newIdx);
          setActiveDownloadTab(tabKeys[nextTabIdx]);
        } else if (isGrid) {
          const localIdx = focusIndex - gridStartIdx;
          const col = localIdx % 3;
          if (col < 2 && focusIndex + 1 < totalItems) {
            setFocusIndex(prev => prev + 1);
          }
        }
      } else if (isLeft) {
        e.preventDefault();
        if (isTabs) {
          const prevTabIdx = Math.max(0, (focusIndex - tabStartIdx) - 1);
          const newIdx = tabStartIdx + prevTabIdx;
          setFocusIndex(newIdx);
          setActiveDownloadTab(tabKeys[prevTabIdx]);
        } else if (isGrid) {
          const localIdx = focusIndex - gridStartIdx;
          const col = localIdx % 3;
          if (col > 0) {
            setFocusIndex(prev => prev - 1);
          }
        }
      } else if (isEnter) {
        e.preventDefault();
        if (isRepro) {
          const key = versions[focusIndex];
          const val = movie.versions![key];
          handleSelect(typeof val === 'object' ? (val as any).url : val);
        } else if (downloadQualities.length === 0 && focusIndex === vCount) {
           handleExtractAll(versions);
        } else if (isGrid) {
          const qualityIdx = focusIndex - gridStartIdx;
          if (activeQualities[qualityIdx]) {
            window.open(activeQualities[qualityIdx].url, '_blank');
          }
        }
      }
    }
  }, [selectedUrl, focusIndex, versions, downloadQualities, activeDownloadTab, movie.versions, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      // Cancelar cualquier extracción pendiente al cerrar el reproductor
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [handleKeyDown]);

  const backdropUrl = movie.backdrop_path 
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : `https://image.tmdb.org/t/p/original${movie.poster_path}`;

  if (selectedUrl) {
    return (
      <div className="video-player-overlay">
        <iframe src={selectedUrl} className="video-element" allow="autoplay; fullscreen" allowFullScreen />
        <div style={{ position: 'absolute', top: '30px', left: '30px', color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', letterSpacing: '3px', textTransform: 'uppercase' }}>ESC para volver</div>
      </div>
    );
  }

  // Calculate UI values for focus ring
  const hasDownloads = downloadQualities.length > 0;
  const vCount = versions.length;

  return (
    <div className="player-split-overlay">
      <div className="player-split-bg" style={{ backgroundImage: `url(${backdropUrl})` }} />
      <div className="player-split-gradient" />
      
      <div className="player-split-container">
        
        {/* LADO IZQUIERDO: Menú (Ahora aquí) */}
        <div className="player-split-right">
          <div className="glass-panel">
            <div className="glass-panel-content">
              
              {/* Reproducción */}
              <div className="glass-section">
                <h3 className="glass-section-title">REPRODUCCIÓN</h3>
                <div className="glass-list">
                  {versions.map((v, idx) => {
                    const isActive = focusIndex === idx;
                    const details = getVersionDetails(v);
                    return (
                      <div key={v} className={`glass-option-row ${isActive ? 'focused' : ''}`}>
                        <div className="glass-option-icon">{details.flag}</div>
                        <div className="glass-option-text">
                          <span className="lang-label">{details.label.toUpperCase()}</span>
                          <span className="lang-sub">{details.sub}</span>
                        </div>
                        <span className="quality-badge">{extractQuality(movie.versions![v])}</span>
                        <div className="glass-option-action">
                          {isActive && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Descargas */}
              <div className="glass-section" style={{ marginTop: '40px' }}>
                <h3 className="glass-section-title">DESCARGA DIRECTA</h3>
                
                {extracting ? (
                  <div className="glass-list">
                    <div className="glass-option-row loading">
                      <div className="extraction-loader"><div className="extraction-loader-bar" /></div>
                    </div>
                  </div>
                ) : !hasDownloads ? (
                  <>
                    <div className="glass-list">
                      <div className={`glass-option-row ${focusIndex === vCount ? 'focused' : ''}`}>
                        <div className="glass-option-icon">
                          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </div>
                        <div className="glass-option-text">
                          <span className="lang-label">{error ? 'REINTENTAR' : 'OBTENER ENLACES'}</span>
                        </div>
                        <div className="glass-option-action">
                          {focusIndex === vCount && !error && (
                             <span style={{ fontSize: '1.2rem' }}>↵</span>
                          )}
                          {error && (
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                              <path d="M23 4v6h-6"></path>
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {error && (
                      <div className="extraction-error-inline">
                        <div className="extraction-error-icon">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                          </svg>
                        </div>
                        <div className="extraction-error-content">
                          <span className="error-label">Aviso</span>
                          <span className="error-message">{error}</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="download-tabs-system">
                    {(() => {
                      const grouped = getGroupedDownloads();
                      const tabKeys = Object.keys(grouped);
                      
                      return (
                        <>
                          <div className="download-tabs">
                            {tabKeys.map((tk, tidx) => {
                              const absIdx = vCount + tidx;
                              const isActive = activeDownloadTab === tk;
                              const isFocused = focusIndex === absIdx;
                              const details = getVersionDetails(tk);
                              return (
                                <div 
                                  key={tk} 
                                  className={`download-tab-btn ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
                                  onClick={() => setActiveDownloadTab(tk)}
                                >
                                  <div className="tab-flag">{details.flag}</div>
                                  <span className="tab-label">{details.code || details.label}</span>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="download-grid tab-content" key={activeDownloadTab}>
                            {(grouped[activeDownloadTab!] || []).map((q, qidx) => {
                              const absIdx = vCount + tabKeys.length + qidx;
                              const isFocused = focusIndex === absIdx;
                              return (
                                <div 
                                  key={`${q.name}-${qidx}`} 
                                  className={`download-chip ${isFocused ? 'focused' : ''}`}
                                  onClick={() => window.open(q.url, '_blank')}
                                >
                                  <span className="chip-quality">{q.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* LADO DERECHO: Info (Ahora aquí) */}
        <div className="player-split-left">
          <h1 className="split-movie-title">{movie.title}</h1>
        </div>

      </div>
    </div>
  );
};

export default VideoPlayer;
