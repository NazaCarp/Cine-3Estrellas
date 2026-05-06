"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Script from 'next/script';
import { Movie } from '@/types';
import { extractQuality, preparePlayerUrl } from '@/lib/utils';
import './VideoPlayer.css';

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
  const [extractingVersion, setExtractingVersion] = useState<string | null>(null);
  const [extractingDownloads, setExtractingDownloads] = useState(false);
  const [downloadQualities, setDownloadQualities] = useState<Quality[]>([]);
  const [activeDownloadTab, setActiveDownloadTab] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playbackAbortRef = useRef<AbortController | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // --- ESTADOS REPRODUCTOR PERSONALIZADO ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [lastVolume, setLastVolume] = useState(1);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [volumeIndicatorValue, setVolumeIndicatorValue] = useState(0);
  const volumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [seekRipple, setSeekRipple] = useState<'left' | 'right' | null>(null);
  const [isSpeeding, setIsSpeeding] = useState<'fast' | 'rewind' | false>(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rewindIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasSpeedingRef = useRef(false);

  const handleVideoPointerDown = (e: React.PointerEvent) => {
    if (!videoRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;

    // Iniciar temporizador para el long press
    longPressTimerRef.current = setTimeout(() => {
      if (videoRef.current) {
        setIsSpeeding(isLeft ? 'rewind' : 'fast');
        wasSpeedingRef.current = true;
        
        if (isLeft) {
          // HTML5 no soporta velocidad negativa nativa. Simulamos rebobinado:
          videoRef.current.pause();
          rewindIntervalRef.current = setInterval(() => {
            if (videoRef.current) {
              videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 0.5);
            }
          }, 100); // Retrocede 0.5s cada 100ms (aprox 5x de velocidad inversa visualmente)
        } else {
          videoRef.current.playbackRate = 2.0;
          if (videoRef.current.paused) videoRef.current.play().catch(() => {});
        }
      }
    }, 500);
  };

  const handleVideoPointerUpOrLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (rewindIntervalRef.current) {
      clearInterval(rewindIntervalRef.current);
      rewindIntervalRef.current = null;
    }

    if (isSpeeding || wasSpeedingRef.current) {
      setIsSpeeding(false);
      if (videoRef.current) {
        videoRef.current.playbackRate = 1.0;
        // Volver a reproducir si veníamos de rebobinar
        if (videoRef.current.paused) videoRef.current.play().catch(() => {});
      }
      // Evitar que el onClick pause el video justo después de soltar el long press
      setTimeout(() => {
        wasSpeedingRef.current = false;
      }, 100);
    }
  };

  const handleDoubleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 3;
    const isRight = e.clientX - rect.left > (rect.width * 2) / 3;

    if (isLeft) {
      handleSkip(-10);
      setSeekRipple('left');
      setTimeout(() => setSeekRipple(null), 500);
      if (videoRef.current.paused) videoRef.current.play();
    } else if (isRight) {
      handleSkip(10);
      setSeekRipple('right');
      setTimeout(() => setSeekRipple(null), 500);
      if (videoRef.current.paused) videoRef.current.play();
    } else {
      toggleFullscreen();
    }
  };


  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // If exiting fullscreen while a video is playing, close the player entirely
      if (!document.fullscreenElement && selectedUrl) {
        setSelectedUrl(null);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [selectedUrl]);





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

  const handleSelect = async (url: string, versionName?: string) => {
    if (extracting) return;

    // Si ya es un enlace directo, reproducir inmediatamente
    const isDirect = url.includes('.m3u8') || url.includes('.mp4') || url.includes('urlset');
    
    if (isDirect) {
      setSelectedUrl(url);
    } else if (url.includes('vidmoly.') || url.includes('p2pplay.pro') || url.includes('vidsonic.net') || url.includes('ok.ru')) {
      // Servidores con soporte para extracción (evita anuncios y permite autoplay)
      setExtracting(true);
      setExtractingVersion(versionName || null);
      try {
        // Normalizamos la URL
        let finalUrlToExtract = url;
        if (url.includes('p2pplay.pro')) {
          finalUrlToExtract = url.replace('#', '');
        } else if (url.includes('vidmoly.') || url.includes('vidsonic.net')) {
          finalUrlToExtract = preparePlayerUrl(url);
        }
        
        // Cancel previous playback extraction
        if (playbackAbortRef.current) playbackAbortRef.current.abort();
        playbackAbortRef.current = new AbortController();
        
        const res = await fetch(`/api/extract?url=${encodeURIComponent(finalUrlToExtract)}`, { 
          signal: playbackAbortRef.current.signal 
        });
        const data = await res.json();
        
        if (res.ok && data.qualities?.length > 0) {
          // Éxito: Usamos el enlace directo (la mejor calidad disponible)
          setSelectedUrl(data.qualities[0].url);
        } else {
          // Bloqueado: No mostrar iframes con publicidad
          setError('No se pudo extraer el video. El reproductor original tiene demasiada publicidad y ha sido bloqueado por seguridad.');
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        // Bloqueado: Error de conexión, no mostrar iframes
        setError('Error al intentar obtener un enlace limpio y sin publicidad.');
      } finally {
        setExtracting(false);
        setExtractingVersion(null);
      }
    } else {
      // Otros servidores: No soportan extracción, bloqueados preventivamente
      setError('Este servidor no soporta extracción sin anuncios. Por tu seguridad, su iframe ha sido bloqueado.');
    }

    // Auto-fullscreen al seleccionar
    setTimeout(() => {
      if (containerRef.current && !document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    }, 100);
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
      if (downloadAbortRef.current) {
        downloadAbortRef.current.abort();
      }
      downloadAbortRef.current = new AbortController();
      const signal = downloadAbortRef.current.signal;

      setExtractingDownloads(true);
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
      setExtractingDownloads(false);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Backspace') {
      e.preventDefault();
      if (selectedUrl) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        setSelectedUrl(null);
      }
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
      const isGrid = focusIndex >= gridStartIdx && focusIndex !== 1000;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (focusIndex === 1000) {
            setFocusIndex(0);
          } else if (isRepro) {
            if (focusIndex === vCount - 1) {
              setFocusIndex(vCount);
            } else {
              setFocusIndex(prev => prev + 1);
            }
          } else if (isTabs) {
            if (activeQualities.length > 0) setFocusIndex(gridStartIdx);
          } else if (isGrid) {
            // Jump to next row (+3) if it exists
            const nextRowIdx = focusIndex + 3;
            if (nextRowIdx < totalItems) setFocusIndex(nextRowIdx);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (focusIndex === 1000) return; // El enfoque no se mueve de aquí (límite superior)
          
          if (focusIndex === vCount) {
            setFocusIndex(vCount - 1);
          } else if (isRepro) {
            if (focusIndex === 0) setFocusIndex(1000);
            else setFocusIndex(prev => Math.max(0, prev - 1));
          } else if (isTabs) {
            setFocusIndex(vCount - 1);
          } else if (isGrid) {
            // Jump back to row above or to active tab
            const prevRowIdx = focusIndex - 3;
            if (prevRowIdx < gridStartIdx) {
              const activeTabIdx = tabKeys.indexOf(activeDownloadTab || '');
              setFocusIndex(tabStartIdx + (activeTabIdx >= 0 ? activeTabIdx : 0));
            } else {
              setFocusIndex(prevRowIdx);
            }
          }
          break;

        case 'ArrowRight':
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
          break;

        case 'ArrowLeft':
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
          break;

        case 'Enter':
          e.preventDefault();
          if (focusIndex === 1000) {
            onClose();
          } else if (isRepro) {
            const key = versions[focusIndex];
            const val = movie.versions![key];
            handleSelect(typeof val === 'object' ? (val as any).url : val, key);
          } else if (downloadQualities.length === 0 && focusIndex === vCount) {
             handleExtractAll(versions);
          } else if (isGrid) {
            const qualityIdx = focusIndex - gridStartIdx;
            if (activeQualities[qualityIdx]) {
              const q = activeQualities[qualityIdx];
              const downloadUrl = (q.url.includes('proxy=true') || q.url.includes('workers.dev')) ? `${q.url}&download=true` : q.url;
              window.open(downloadUrl, '_blank');
            }
          }
          break;
      }
    }
  }, [selectedUrl, focusIndex, versions, downloadQualities, activeDownloadTab, movie.versions, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown]);

  // Cancelar cualquier extracción pendiente SOLO al desmontar el reproductor por completo
  useEffect(() => {
    return () => {
      if (playbackAbortRef.current) playbackAbortRef.current.abort();
      if (downloadAbortRef.current) downloadAbortRef.current.abort();
    };
  }, []);

  const backdropUrl = movie.backdrop_path 
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : `https://image.tmdb.org/t/p/original${movie.poster_path}`;

  // Detectamos si es un link directo o si es un link procesado por nuestro proxy (Cloudflare Worker)
  const isDirectLink = selectedUrl?.includes('.m3u8') || 
                       selectedUrl?.includes('.mp4') || 
                       selectedUrl?.includes('urlset') ||
                       selectedUrl?.includes('proxy=true') ||
                       selectedUrl?.includes('workers.dev');

  // Referencia para el elemento de video
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hlsReady, setHlsReady] = useState(false);
  
  // Verificamos si todos los servidores son Vidmoly para ocultar descargas
  const allAreVidmoly = versions.length > 0 && versions.every(v => {
    const val = movie.versions?.[v];
    const url = typeof val === 'object' ? (val as any).url : val;
    return url && url.includes('vidmoly.');
  });

  // --- LÓGICA REPRODUCTOR PERSONALIZADO ---
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, []);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = (e as any).clientX || ((e as any).touches && (e as any).touches[0].clientX) || ((e as any).nativeEvent as any).clientX;
    const pos = Math.min(Math.max(0, (clientX - rect.left) / rect.width), 1);
    const newTime = pos * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    resetControlsTimeout();
  };

  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    e.stopPropagation();
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.min(Math.max(0, (e.clientX - rect.left) / rect.width), 1);
    const newTime = pos * duration;
    setDragTime(newTime);
    
    // Capturar puntero para drag fuera de la barra
    e.currentTarget.setPointerCapture(e.pointerId);
    resetControlsTimeout();
  };

  const handleProgressPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.min(Math.max(0, (e.clientX - rect.left) / rect.width), 1);
    const newTime = pos * duration;
    setDragTime(newTime);
    resetControlsTimeout();
  };

  const handleProgressPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (videoRef.current) {
      videoRef.current.currentTime = dragTime;
      setCurrentTime(dragTime);
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
    resetControlsTimeout();
  };


  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(Math.max(0, videoRef.current.currentTime + seconds), duration);
    resetControlsTimeout();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.volume = lastVolume;
      setIsMuted(false);
    } else {
      setLastVolume(videoRef.current.volume);
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const changeVolume = (delta: number) => {
    if (!videoRef.current) return;
    const newVol = Math.min(Math.max(0, videoRef.current.volume + delta), 1);
    videoRef.current.volume = newVol;
    setVolume(newVol);
    setIsMuted(newVol === 0);
    
    // Mostrar indicador
    setVolumeIndicatorValue(Math.round(newVol * 100));
    setShowVolumeIndicator(true);
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => setShowVolumeIndicator(false), 1000);
    
    resetControlsTimeout();
  };

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  }, [isPlaying]);

  const formatTime = (time: number) => {
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60);
    return h > 0 
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (selectedUrl && isDirectLink && videoRef.current) {
      const video = videoRef.current;
      
      const onPlay = () => { setIsPlaying(true); resetControlsTimeout(); };
      const onPause = () => { setIsPlaying(false); setShowControls(true); };
      const onTimeUpdate = () => {
        setCurrentTime(video.currentTime);
        // Guardar progreso cada vez que avance (después de los primeros 5 segundos)
        if (video.currentTime > 5) {
          localStorage.setItem(`progress_${movie.id}`, video.currentTime.toString());
        }
      };
      const onDurationChange = () => setDuration(video.duration);
      const onWaiting = () => setIsBuffering(true);
      const onPlaying = () => setIsBuffering(false);
      const onVolumeChange = () => {
        setVolume(video.volume);
        setIsMuted(video.muted || video.volume === 0);
      };

      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('durationchange', onDurationChange);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('playing', onPlaying);
      video.addEventListener('volumechange', onVolumeChange);

      // Mouse movement to show controls
      const onMouseMove = () => resetControlsTimeout();
      window.addEventListener('mousemove', onMouseMove);

      console.log("--- DEBUG PLAYER ---");
      console.log("URL:", selectedUrl);
      
      let hls: any = null;

      // Obtener progreso guardado
      const savedProgress = localStorage.getItem(`progress_${movie.id}`);
      const initialTime = savedProgress ? parseFloat(savedProgress) : 0;

      const applyProgress = () => {
        if (initialTime > 0) {
          if (video.duration && initialTime >= video.duration - 300) {
             localStorage.removeItem(`progress_${movie.id}`);
             video.currentTime = 0;
          } else {
             video.currentTime = initialTime;
          }
        }
      };

      const isHls = selectedUrl.toLowerCase().includes('m3u8');
      if (isHls && (window as any).Hls && (window as any).Hls.isSupported()) {
        const Hls = (window as any).Hls;
        hls = new Hls({
          capLevelToPlayerSize: true,
          autoStartLoad: true,
          startPosition: initialTime > 0 ? initialTime : -1
        });
        hls.loadSource(selectedUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        
        // Si estaba casi al final, la reiniciamos
        video.addEventListener('loadedmetadata', () => {
           if (video.duration && initialTime >= video.duration - 300) {
              video.currentTime = 0;
           }
        }, { once: true });
      } else {
        video.src = selectedUrl;
        
        // Manejo para MP4 directo
        if (video.readyState >= 1) {
          applyProgress();
        } else {
          video.addEventListener('loadedmetadata', applyProgress, { once: true });
        }
        
        video.play().catch(() => {});
      } 

      return () => {
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('durationchange', onDurationChange);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('volumechange', onVolumeChange);
        window.removeEventListener('mousemove', onMouseMove);
        if (hls) hls.destroy();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUrl, isDirectLink, hlsReady]);

  // Manejo de teclado para el reproductor (Soporte TV/Remoto)
  useEffect(() => {
    const handlePlayerKeys = (e: KeyboardEvent) => {
      if (!selectedUrl || !isDirectLink) return;

      switch (e.key) {
        case ' ':
        case 'Enter':
          if (e.target === document.body || (e.target as HTMLElement).tagName === 'VIDEO') {
            e.preventDefault();
            handlePlayPause();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSkip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSkip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(-0.05);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    if (selectedUrl) {
      window.addEventListener('keydown', handlePlayerKeys);
    }
    return () => window.removeEventListener('keydown', handlePlayerKeys);
  }, [selectedUrl, isDirectLink, handlePlayPause, duration]);

  if (selectedUrl) {
    return (
      <div className="video-player-overlay" ref={containerRef} onMouseMove={resetControlsTimeout} onClick={resetControlsTimeout}>
        {isDirectLink ? (
          <>
            <Script 
              src="https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js" 
              strategy="afterInteractive" 
              onLoad={() => setHlsReady(true)}
            />
            <video 
              ref={videoRef}
              className="video-element" 
              autoPlay 
              playsInline
              onClick={(e) => {
                if (wasSpeedingRef.current) return;
                if (!showControls) {
                  resetControlsTimeout();
                } else {
                  handlePlayPause();
                }
              }}
              onDoubleClick={handleDoubleTap}
              onPointerDown={handleVideoPointerDown}
              onPointerUp={handleVideoPointerUpOrLeave}
              onPointerCancel={handleVideoPointerUpOrLeave}
              onPointerLeave={handleVideoPointerUpOrLeave}
              onContextMenu={(e) => e.preventDefault()} // Evitar menú en celulares
            />

            {/* Animación de Doble Toque */}
            {seekRipple && (
              <div className={`seek-ripple-container ${seekRipple}`}>
                <div className="seek-ripple-circle">
                  <span className="seek-ripple-text">
                    {seekRipple === 'left' ? '« -10s' : '+10s »'}
                  </span>
                </div>
              </div>
            )}

            {/* Animación de Velocidad */}
            {isSpeeding && (
              <div className="speed-indicator-overlay">
                <div className="speed-indicator-pill">
                  <span className="speed-icon" style={{ transform: isSpeeding === 'rewind' ? 'scaleX(-1)' : 'none', display: 'inline-block' }}>▶▶</span>
                  <span className="speed-text">
                    {isSpeeding === 'fast' ? '2x Cámara Rápida' : '« Rebobinando'}
                  </span>
                </div>
              </div>
            )}

            {/* Capa de Pausa Cinemática (Lateral) */}
            {!isPlaying && !isBuffering && (
              <div className="paused-side-panel">
                <div className="side-panel-content">
                  <div className="side-status">PAUSADO</div>
                  <h1 className="side-title">{movie.title}</h1>
                  <div className="side-meta">
                    <span className="side-rating">★ {movie.vote_average?.toFixed(1)}</span>
                    <span className="side-year">{movie.release_date?.split('-')[0]}</span>
                  </div>
                  <p className="side-hint">Pulsa ENTER para reanudar</p>
                </div>
              </div>
            )}


            {/* INTERFAZ PERSONALIZADA */}
            <div className={`player-controls-layer ${!showControls && isPlaying ? 'hidden' : ''}`}>
              
              {/* Overlay de Título (Arriba) */}
              <div className={`video-title-overlay ${!isPlaying && !isBuffering ? 'hidden' : ''}`}>
                <div className="flex items-center gap-4">
                  <h2>{movie.title}</h2>
                </div>
                <p>Reproduciendo ahora</p>
              </div>

              {/* Botón de Cierre */}
              <button 
                className="detail-btn btn-close"
                onClick={(e) => {
                  e.stopPropagation();
                  if (document.fullscreenElement) document.exitFullscreen();
                  setSelectedUrl(null);
                }}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="3" fill="none">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>

              {/* Loader Premium (Stars) */}
              {isBuffering && (
                <div className="premium-loader-container">
                  <div className="stars-loader">
                    <div className="star-loader-item" />
                    <div className="star-loader-item" />
                    <div className="star-loader-item" />
                  </div>
                  <span className="loader-text">Cargando</span>
                </div>
              )}

              {/* Barra de Controles (Abajo) */}
              <div className={`video-controls ${!showControls && isPlaying ? 'hidden' : ''}`}>
                
                {/* Barra de Progreso */}
                <div 
                  className="progress-container" 
                  onPointerDown={handleProgressPointerDown}
                  onPointerMove={handleProgressPointerMove}
                  onPointerUp={handleProgressPointerUp}
                  onPointerCancel={handleProgressPointerUp}
                >
                  <div 
                    className="progress-bar" 
                    style={{ width: `${((isDragging ? dragTime : currentTime) / duration) * 100}%` }}
                  >
                    <div className="progress-knob" />
                  </div>
                </div>

                <div className="controls-main">
                  <div className="controls-left">
                    <button className="control-btn" onClick={handlePlayPause}>
                      {isPlaying ? (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      ) : (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      )}
                    </button>
                    
                    <button className="control-btn" onClick={() => handleSkip(-10)}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>
                    </button>
                    
                    <button className="control-btn" onClick={() => handleSkip(10)}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>
                    </button>

                    <div className="time-display">
                      {formatTime(isDragging ? dragTime : currentTime)} / {formatTime(duration)}
                    </div>
                  </div>

                  <div className="controls-right">
                    <div className="flex items-center gap-3">
                      <button className="control-btn" onClick={toggleMute}>
                        {isMuted ? (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                          </svg>
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                          </svg>
                        )}
                      </button>
                    </div>

                    <button className="control-btn" onClick={toggleFullscreen}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Indicador de Volumen */}
            {showVolumeIndicator && (
              <div className="volume-indicator">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <span className="text-xl font-bold">{volumeIndicatorValue}%</span>
              </div>
            )}
          </>
        ) : (
          <iframe src={selectedUrl} className="video-element" allow="autoplay; fullscreen" allowFullScreen />
        )}
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
      
      <button 
        className={`detail-btn btn-close${focusIndex === 1000 ? ' focused' : ''}`}
        onPointerEnter={() => setFocusIndex(1000)}
        onClick={onClose}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="3" fill="none">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div className="player-split-container">
        
        {/* LADO IZQUIERDO: Menú (Ahora aquí) */}
        <div className="player-split-right">
          <div className="glass-panel">
            <div className="glass-panel-content">
              
              {/* Reproducción */}
              <div className="glass-section">
                <h3 className="glass-section-title">REPRODUCCIÓN</h3>
                <div className="glass-list">
                  {versions.map((v, i) => {
                    const val = movie.versions![v];
                    const details = getVersionDetails(v);
                    const isActive = selectedUrl === (typeof val === 'object' ? (val as any).url : val) || 
                                     ((selectedUrl?.includes('proxy=true') || selectedUrl?.includes('workers.dev')) && selectedUrl?.includes(encodeURIComponent(typeof val === 'object' ? (val as any).url : val)));
                    
                    return (
                      <div 
                        key={v} 
                        className={`glass-option-row ${isActive ? 'active' : ''} ${focusIndex === i ? 'focused' : ''} ${extracting && extractingVersion === v ? 'loading' : ''}`}
                        onPointerEnter={() => setFocusIndex(i)}
                        onClick={() => handleSelect(typeof val === 'object' ? (val as any).url : val, v)}
                      >
                        <div className="glass-option-icon">{details.flag}</div>
                        <div className="glass-option-text">
                          <span className="lang-label">{details.label.toUpperCase()}</span>
                          <span className="lang-sub">{details.sub}</span>
                        </div>
                        <span className="quality-badge">{extractQuality(movie.versions![v])}</span>
                        <div className="glass-option-action">
                          {extracting && extractingVersion === v ? (
                            <svg className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                              <line x1="12" y1="2" x2="12" y2="6"></line>
                              <line x1="12" y1="18" x2="12" y2="22"></line>
                              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                              <line x1="2" y1="12" x2="6" y2="12"></line>
                              <line x1="18" y1="12" x2="22" y2="12"></line>
                              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                            </svg>
                          ) : isActive && (
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

              {/* Descargas (Solo si hay servidores que no sean Vidmoly) */}
              {!allAreVidmoly && (
                <div className="glass-section" style={{ marginTop: '40px' }}>
                  <h3 className="glass-section-title">DESCARGA DIRECTA</h3>
                  
                  {extractingDownloads ? (
                    <div className="glass-list">
                      <div className="glass-option-row loading">
                        <div className="extraction-loader"><div className="extraction-loader-bar" /></div>
                      </div>
                    </div>
                  ) : !hasDownloads ? (
                    <>
                      <div className="glass-list">
                        <div 
                          className={`glass-option-row ${focusIndex === vCount ? 'focused' : ''}`}
                          onPointerEnter={() => setFocusIndex(vCount)}
                          onClick={() => handleExtractAll(versions)}
                        >
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
                                    onPointerEnter={() => setFocusIndex(absIdx)}
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
                                    onPointerEnter={() => setFocusIndex(absIdx)}
                                    onClick={() => {
                                      const downloadUrl = (q.url.includes('proxy=true') || q.url.includes('workers.dev')) ? `${q.url}&download=true` : q.url;
                                      window.open(downloadUrl, '_blank');
                                    }}
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
              )}

            </div>
          </div>
        </div>

        {/* LADO DERECHO: Info */}
        <div className="player-split-left">
          <h1 className="split-movie-title">{movie.title}</h1>
        </div>

      </div>
    </div>
  );
};

export default VideoPlayer;
