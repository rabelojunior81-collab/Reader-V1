import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LibraryItem, ComicPage, Panel } from '../types';
import { getComicPages, resizeImageForGemini } from '../services/bookService';
import { getPanelsForPage } from '../services/geminiService';
import * as pdfService from '../services/pdfService';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/types/src/display/api';
import ePub, { Book, Rendition } from 'epubjs';

import {
  CloseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PanelViewIcon,
  PageViewIcon,
  SparklesIcon,
  ZoomInIcon,
  ZoomOutIcon,
  ArrowsPointingOutIcon
} from './Icons';
import { LoadingSpinner } from './LoadingSpinner';

interface ReaderViewProps {
  book: LibraryItem;
  onClose: () => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

export const ReaderView: React.FC<ReaderViewProps> = ({ book, onClose }) => {
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isPanelDetectionRunning, setIsPanelDetectionRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Book content state
  const [comicPages, setComicPages] = useState<ComicPage[]>([]);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  const [totalEpubPages, setTotalEpubPages] = useState(0);

  // Navigation state
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [currentPanelIndex, setCurrentPanelIndex] = useState(-1); // -1 means page view
  const totalPages = useMemo(() => {
    if (book.type === 'cbz') return comicPages.length;
    if (book.type === 'pdf' && pdfDoc) return pdfDoc.numPages;
    if (book.type === 'epub') return totalEpubPages;
    return book.totalPages;
  }, [book, comicPages, pdfDoc, totalEpubPages]);

  // View state
  const [viewMode, setViewMode] = useState<'page' | 'panel'>('page');
  const [panels, setPanels] = useState<Panel[]>([]);
  const [panelsCache, setPanelsCache] = useState<Record<string, Panel[]>>({});
  const [zoom, setZoom] = useState(1);
  const [isFitToScreen, setIsFitToScreen] = useState(true);

  // Refs
  const viewerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRenderTask = useRef<RenderTask | null>(null);

  // --- Content Loading ---

  useEffect(() => {
    const loadBook = async () => {
      setIsLoading(true);
      setError(null);
      // Reset state for new book
      setComicPages([]);
      setPdfDoc(null);
      if (renditionRef.current) {
        renditionRef.current.destroy();
        renditionRef.current = null;
      }
      setCurrentPageIndex(0);
      setPanelsCache({});
      setPanels([]);
      setViewMode('page');
      setZoom(1);
      setIsFitToScreen(true);

      try {
        if (book.type === 'cbz') {
          const pages = await getComicPages(book.file);
          setComicPages(pages);
        } else if (book.type === 'pdf') {
          const doc = await pdfService.getPDFDoc(book.file);
          setPdfDoc(doc);
        } else if (book.type === 'epub') {
            const epubBook = ePub(await book.file.arrayBuffer());
            bookRef.current = epubBook;
            await epubBook.ready;
            await epubBook.locations.generate(1650); // standard CFI word count for a page
            setTotalEpubPages(epubBook.locations.length());

            if (viewerRef.current) {
                const rendition = epubBook.renderTo(viewerRef.current, {
                    width: '100%',
                    height: '100%',
                    spread: 'auto',
                });
                renditionRef.current = rendition;
                
                rendition.on('relocated', (location: any) => {
                    const cfi = location.start.cfi;
                    const currentPage = epubBook.locations.locationFromCfi(cfi);
                    if (currentPage !== null) {
                      setCurrentPageIndex(currentPage);
                    }
                });

                await rendition.display();
            }
        }
      } catch (err) {
        console.error("Error loading book:", err);
        setError("Failed to load the book. The file might be corrupted or in an unsupported format.");
      } finally {
        setIsLoading(false);
      }
    };

    loadBook();

    return () => {
        pdfDoc?.destroy();
        renditionRef.current?.destroy();
    }
  }, [book]);

  // --- EPUB Resize Handling ---
  useEffect(() => {
    const handleResize = () => {
        if (book.type === 'epub' && viewerRef.current && renditionRef.current) {
            const { width, height } = viewerRef.current.getBoundingClientRect();
            renditionRef.current.resize(width, height);
        }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [book]);


  // --- PDF Page Rendering ---

  useEffect(() => {
    if (book.type === 'pdf' && pdfDoc && pdfCanvasRef.current) {
        pdfRenderTask.current?.cancel();
        pdfRenderTask.current = pdfService.renderPDFPageToCanvas(pdfDoc, currentPageIndex + 1, pdfCanvasRef.current);
    }
  }, [book.type, pdfDoc, currentPageIndex]);

  // --- Panel Detection ---

  const handleDetectPanels = useCallback(async () => {
    if (book.type !== 'cbz' || comicPages.length === 0) return;
    const currentPage = comicPages[currentPageIndex];
    if (!currentPage || !currentPage.url) return;
    if (panelsCache[currentPage.id]) {
      setPanels(panelsCache[currentPage.id]);
      setViewMode('panel');
      setCurrentPanelIndex(0);
      return;
    }

    setIsPanelDetectionRunning(true);
    setError(null);
    try {
      const resizedDataUrl = await resizeImageForGemini(currentPage.url);
      const base64Image = resizedDataUrl.split(',')[1];
      const mimeType = resizedDataUrl.match(/:(.*?);/)?.[1] || 'image/jpeg';

      const detectedPanels = await getPanelsForPage(base64Image, mimeType);
      
      if (detectedPanels && detectedPanels.length > 0) {
        setPanels(detectedPanels);
        setPanelsCache(prev => ({ ...prev, [currentPage.id]: detectedPanels }));
        setViewMode('panel');
        setCurrentPanelIndex(0);
      } else {
        throw new Error("No panels were detected on this page.");
      }
    } catch (err: any) {
      console.error("Panel detection failed:", err);
      setError(err.message || "Could not detect panels for this page.");
      setViewMode('page');
    } finally {
      setIsPanelDetectionRunning(false);
    }
  }, [book.type, comicPages, currentPageIndex, panelsCache]);

  // --- Navigation ---

  const goToNext = useCallback(() => {
    if (viewMode === 'panel' && currentPanelIndex < panels.length - 1) {
      setCurrentPanelIndex(prev => prev + 1);
    } else if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(prev => prev + 1);
      setPanels([]);
      setCurrentPanelIndex(-1);
      if (book.type !== 'epub') {
        setViewMode('page');
      }
      if (book.type === 'epub') renditionRef.current?.next();
    }
  }, [viewMode, currentPanelIndex, panels.length, currentPageIndex, totalPages, book.type]);

  const goToPrev = useCallback(() => {
    if (viewMode === 'panel' && currentPanelIndex > 0) {
      setCurrentPanelIndex(prev => prev - 1);
    } else if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
      setPanels([]);
      setCurrentPanelIndex(-1);
      if (book.type !== 'epub') {
        setViewMode('page');
      }
      if (book.type === 'epub') renditionRef.current?.prev();
    }
  }, [viewMode, currentPanelIndex, currentPageIndex, book.type]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') goToNext();
        if (e.key === 'ArrowLeft') goToPrev();
        if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, onClose]);

  // --- Zoom & View ---

  const handleZoom = (direction: 'in' | 'out') => {
    setIsFitToScreen(false);
    setZoom(prev => {
        const newZoom = direction === 'in' ? prev + ZOOM_STEP : prev - ZOOM_STEP;
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    });
  };

  const toggleFitToScreen = () => {
    setIsFitToScreen(prev => !prev);
    if (!isFitToScreen) {
        setZoom(1);
    }
  }

  // --- UI Rendering ---

  const currentImage = book.type === 'cbz' ? comicPages[currentPageIndex] : null;
  const showPanelControls = book.type === 'cbz';

  const imageStyle: React.CSSProperties = useMemo(() => {
    if (book.type === 'cbz' && viewMode === 'panel' && currentPanelIndex > -1 && panels[currentPanelIndex]) {
      const panel = panels[currentPanelIndex];
      const scale = 1 / (panel.width / 100);
      const translateX = -(panel.x + panel.width / 2 - 50);
      const translateY = -(panel.y + panel.height / 2 - 50);
      return {
        transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
        transition: 'transform 0.4s ease-in-out',
        width: '100%',
        height: 'auto',
      };
    }

    if (isFitToScreen) {
      return { width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' };
    }

    return { 
      transform: `scale(${zoom})`,
      transformOrigin: 'center',
      width: 'auto',
      height: 'auto',
    };
  }, [book.type, zoom, isFitToScreen, viewMode, currentPanelIndex, panels]);


  const renderContent = () => {
    if (isLoading) {
      return <div className="flex-grow flex items-center justify-center"><LoadingSpinner /></div>;
    }
    if (error) {
      return <div className="flex-grow flex items-center justify-center text-red-500 dark:text-red-400 p-4 text-center">{error}</div>;
    }

    if (book.type === 'cbz' && currentImage) {
        return (
            <div 
              ref={viewerRef} 
              className="flex-grow flex items-center justify-center p-2"
              style={{ overflow: (viewMode === 'panel' || isFitToScreen) ? 'hidden' : 'auto' }}
            >
              <img
                  src={currentImage.url}
                  alt={`Page ${currentPageIndex + 1}`}
                  style={imageStyle}
              />
            </div>
        );
    }
    
    if (book.type === 'pdf') {
        return (
            <div ref={viewerRef} className="flex-grow flex items-center justify-center overflow-auto p-2">
                <canvas ref={pdfCanvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}/>
            </div>
        );
    }

    if (book.type === 'epub') {
        return <div ref={viewerRef} className="flex-grow epub-container" />;
    }

    return <div className="flex-grow flex items-center justify-center text-zinc-500">Formato de livro não suportado para visualização.</div>;
  };

  return (
    <div className="fixed inset-0 bg-zinc-100 dark:bg-zinc-900 z-[100] flex flex-col font-sans">
      <header className="flex-shrink-0 flex justify-between items-center p-3 sm:p-4 bg-zinc-100/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-md">
        <h2 className="text-lg font-bold truncate text-zinc-800 dark:text-zinc-200" title={book.title}>
            {book.title}
        </h2>
        {totalPages > 0 && (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Página {book.type === 'epub' ? currentPageIndex : currentPageIndex + 1} de {totalPages}
            </div>
        )}
        <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors" aria-label="Fechar leitor">
          <CloseIcon className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
        </button>
      </header>
      
      <main className="flex-grow flex relative min-h-0">
        {renderContent()}
      </main>

      {book.type !== 'epub' && (
        <>
            <button onClick={goToPrev} className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 bg-black/40 text-white rounded-full hover:bg-black/60 transition-all opacity-50 hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed" disabled={currentPageIndex === 0 && (viewMode !== 'panel' || currentPanelIndex <= 0)}>
                <ArrowLeftIcon className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
            <button onClick={goToNext} className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 bg-black/40 text-white rounded-full hover:bg-black/60 transition-all opacity-50 hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed" disabled={currentPageIndex === totalPages - 1 && (viewMode !== 'panel' || currentPanelIndex >= panels.length - 1)}>
                <ArrowRightIcon className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
        </>
      )}

      <footer className="flex-shrink-0 flex justify-center items-center p-2 sm:p-3 bg-zinc-100/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-[0_-2px_5px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_5px_rgba(0,0,0,0.2)]">
        <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4 p-2 bg-zinc-200 dark:bg-zinc-800 rounded-md">
          {showPanelControls && (
            <>
              <button
                onClick={handleDetectPanels}
                className={`p-2 rounded-md transition-colors ${isPanelDetectionRunning ? 'animate-pulse' : 'hover:bg-zinc-300 dark:hover:bg-zinc-700'}`}
                title="Detectar painéis com IA"
                disabled={isPanelDetectionRunning}
              >
                {isPanelDetectionRunning ? <LoadingSpinner /> : <SparklesIcon className="w-6 h-6 text-emerald-500" />}
              </button>
              <button
                onClick={() => { setViewMode('page'); setCurrentPanelIndex(-1); }}
                className={`p-2 rounded-md transition-colors ${viewMode === 'page' ? 'bg-emerald-500 text-white' : 'hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                title="Visualização de página inteira"
              >
                <PageViewIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => { if(panels.length > 0) { setViewMode('panel'); setCurrentPanelIndex(0); } else { handleDetectPanels(); } }}
                className={`p-2 rounded-md transition-colors ${viewMode === 'panel' ? 'bg-emerald-500 text-white' : 'hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                title="Visualização painel a painel"
              >
                <PanelViewIcon className="w-6 h-6" />
              </button>
              <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-600"></div>
            </>
          )}

          {book.type !== 'epub' && (
            <>
                <button onClick={() => handleZoom('out')} className="p-2 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300" title="Diminuir zoom">
                    <ZoomOutIcon className="w-6 h-6" />
                </button>
                <span className="text-sm font-semibold w-12 text-center text-zinc-700 dark:text-zinc-200" onClick={() => setZoom(1)}>
                    {isFitToScreen ? 'Auto' : `${Math.round(zoom * 100)}%`}
                </span>
                <button onClick={() => handleZoom('in')} className="p-2 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300" title="Aumentar zoom">
                    <ZoomInIcon className="w-6 h-6" />
                </button>
                <button onClick={toggleFitToScreen} className={`p-2 rounded-md transition-colors ${isFitToScreen ? 'bg-emerald-500 text-white' : 'hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`} title="Ajustar à tela">
                    <ArrowsPointingOutIcon className="w-6 h-6" />
                </button>
            </>
          )}

          {book.type === 'epub' && (
            <>
                <button onClick={goToPrev} className="p-2 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300" title="Anterior">
                    <ArrowLeftIcon className="w-6 h-6" />
                </button>
                <button onClick={goToNext} className="p-2 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300" title="Próximo">
                    <ArrowRightIcon className="w-6 h-6" />
                </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};