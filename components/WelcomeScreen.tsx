import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { LibraryItem } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { SearchIcon, PencilIcon, SortAscendingIcon, SortDescendingIcon, XMarkIcon } from './Icons';

// --- Helper Components ---

const SkeletonBookItem: React.FC = () => (
  <div className="flex flex-col gap-2">
    <div className="aspect-[2/3] bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse"></div>
    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 animate-pulse"></div>
  </div>
);

interface BookItemProps {
  book: LibraryItem;
  onSelect: () => void;
  onDelete: () => void;
  onSaveTitle: (newTitle: string) => void;
}

const BookItem: React.FC<BookItemProps> = ({ book, onSelect, onDelete, onSaveTitle }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(book.title);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px 100px 0px' }
    );
    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editedTitle.trim() && editedTitle.trim() !== book.title) {
      onSaveTitle(editedTitle.trim());
    }
    setIsEditing(false);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSave();
  };
  
  const handleCancel = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditedTitle(book.title);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleCancel(e);
    }
  };

  return (
    <div ref={ref} className={`flex flex-col gap-2 transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <div
        className="group relative cursor-pointer aspect-[2/3] rounded-md overflow-hidden shadow-lg bg-zinc-200 dark:bg-zinc-800 transition-transform duration-300 hover:scale-105"
        onClick={() => !isEditing && onSelect()}
        role="button"
        aria-label={`Abrir ${book.title}`}
      >
        {isVisible && (
          <>
            <div className="absolute inset-0">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" loading="lazy"/>
              ) : (
                <div className="w-full h-full flex items-center justify-center p-2 text-center text-zinc-500 dark:text-zinc-400 bg-zinc-300 dark:bg-zinc-700">{book.title}</div>
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={handleEditClick}
                className="p-1.5 bg-black/60 rounded-md text-white hover:bg-emerald-600 transition-colors"
                title="Renomear"
                aria-label="Renomear livro"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1.5 bg-black/60 rounded-md text-white hover:bg-red-600 transition-colors"
                title="Remover"
                aria-label="Remover livro"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
      <div className="px-1">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="w-full">
            <input 
              ref={inputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm font-semibold p-1 rounded-sm border border-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </form>
        ) : (
          <p className="text-zinc-800 dark:text-zinc-200 text-sm font-semibold line-clamp-2" title={book.title}>
            {book.title}
          </p>
        )}
      </div>
    </div>
  );
};


// --- Main Library View ---

interface LibraryViewProps {
  library: LibraryItem[];
  onSelectBook: (book: LibraryItem) => void;
  onDeleteBook: (bookId: string) => void;
  onSaveTitle: (bookId: string, newTitle: string) => void;
  onAddBooks: (files: FileList) => void;
  processingCount: number;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ library, onSelectBook, onDeleteBook, onSaveTitle, onAddBooks, processingCount }) => {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    onAddBooks(files);
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    handleFileChange(event.dataTransfer.files);
  }, [handleFileChange]);

  const handleDragEvents = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragover') setIsDragging(true);
    if (event.type === 'dragleave' || event.type === 'dragend') setIsDragging(false);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const filteredAndSortedLibrary = useMemo(() => {
    return library
      .filter(book => book.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();
        if (sortOrder === 'asc') {
          return titleA.localeCompare(titleB);
        }
        return titleB.localeCompare(titleA);
      });
  }, [library, searchTerm, sortOrder]);

  return (
    <div className="flex-grow flex flex-col p-4 sm:p-6 lg:p-8">
      <div 
        className={`border-2 border-dashed rounded-md p-4 sm:p-6 text-center transition-colors duration-300 cursor-pointer mb-8 ${isDragging ? 'border-emerald-500 bg-zinc-200 dark:bg-zinc-800' : 'border-zinc-400 dark:border-zinc-600 hover:border-emerald-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'}`}
        onDrop={handleDrop}
        onDragOver={handleDragEvents}
        onDragLeave={handleDragEvents}
        onClick={() => fileInputRef.current?.click()}
      >
        <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e.target.files)} multiple accept=".cbz,.epub,.pdf" className="hidden" />
        <p className="text-zinc-500 dark:text-zinc-400">Arraste e solte arquivos .cbz, .epub ou .pdf aqui, ou clique para selecionar.</p>
        {error && <p className="mt-2 text-red-500 dark:text-red-400 text-sm">{error}</p>}
      </div>

      <div className="flex flex-col flex-grow">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">Sua Biblioteca</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="relative w-full sm:w-auto">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md py-1.5 pl-10 pr-3 w-full sm:w-64 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                  aria-label="Pesquisar na biblioteca"
                />
             </div>
             <button onClick={toggleSortOrder} title={`Ordenar ${sortOrder === 'asc' ? 'Descendente' : 'Ascendente'}`} className="p-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors flex-shrink-0">
                {sortOrder === 'asc' ? <SortAscendingIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-300"/> : <SortDescendingIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-300"/>}
             </button>
          </div>
        </div>

        {library.length === 0 && processingCount === 0 ? (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-zinc-500 dark:text-zinc-500 text-center">Sua biblioteca está vazia.<br/>Adicione alguns livros para começar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-x-4 gap-y-8 sm:gap-x-5">
            {filteredAndSortedLibrary.map((book) => (
              <BookItem 
                key={book.id}
                book={book}
                onSelect={() => onSelectBook(book)}
                onDelete={() => onDeleteBook(book.id)}
                onSaveTitle={(newTitle) => onSaveTitle(book.id, newTitle)}
              />
            ))}
            {Array.from({ length: processingCount }).map((_, i) => <SkeletonBookItem key={`skeleton-${i}`} />)}
          </div>
        )}
      </div>
    </div>
  );
};