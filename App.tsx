import React, { useState, useCallback, useEffect } from 'react';
import { LibraryView } from './components/WelcomeScreen';
import { ReaderView } from './components/ReaderView';
import { LibraryItem } from './types';
import { BookOpenIcon } from './components/Icons';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { LandingPage } from './components/LandingPage';
import { LoadingSpinner } from './components/LoadingSpinner';
import * as db from './services/db';
import { createLibraryItem } from './services/bookService';


const App: React.FC = () => {
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [selectedBook, setSelectedBook] = useState<LibraryItem | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [processingCount, setProcessingCount] = useState(0);

  useEffect(() => {
    const loadLibrary = async () => {
      await db.initDB();
      const books = await db.getBooks();
      setLibrary(books);
      setIsInitialized(true);
    };
    loadLibrary();
  }, []);

  const handleFileProcessing = useCallback(async (files: FileList) => {
    const filesToProcess = Array.from(files).filter(file => 
      !library.some(item => item.id === `${file.name}-${file.size}`)
    );
    
    if (filesToProcess.length === 0) return;

    setProcessingCount(prev => prev + filesToProcess.length);
    
    const newItemsPromises = filesToProcess.map(async (file) => {
        const newItem = await createLibraryItem(file);
        if (newItem) {
            await db.addBook(newItem);
            // Update state individually for faster UI feedback
            setLibrary(prev => [...prev, newItem]);
        }
        setProcessingCount(prev => prev - 1);
        return newItem;
    });

    await Promise.all(newItemsPromises);

  }, [library]);

  const handleDeleteBook = useCallback(async (bookId: string) => {
    await db.deleteBook(bookId);
    setLibrary(prev => prev.filter(book => book.id !== bookId));
  }, []);

  const handleSaveTitle = useCallback(async (bookId: string, newTitle: string) => {
    await db.updateBookTitle(bookId, newTitle);
    setLibrary(prev => prev.map(book => 
      book.id === bookId ? { ...book, title: newTitle } : book
    ));
  }, []);

  const handleSelectBook = useCallback((book: LibraryItem) => {
    setSelectedBook(book);
  }, []);

  const handleCloseReader = useCallback(() => {
    setSelectedBook(null);
  }, []);

  const renderContent = () => {
    if (!isInitialized) {
      return (
        <div className="flex-grow flex items-center justify-center">
            <LoadingSpinner/>
        </div>
      );
    }
    
    if (selectedBook) {
      return <ReaderView book={selectedBook} onClose={handleCloseReader} />;
    }

    if (library.length === 0 && processingCount === 0) {
        return <LandingPage onFilesSelected={handleFileProcessing} />;
    }

    return (
      <LibraryView
        library={library}
        onSelectBook={handleSelectBook}
        onDeleteBook={handleDeleteBook}
        onSaveTitle={handleSaveTitle}
        onAddBooks={handleFileProcessing}
        processingCount={processingCount}
      />
    );
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 flex flex-col font-sans transition-colors duration-300">
      <header className="relative w-full p-3 sm:p-4 flex justify-between items-center bg-zinc-100/80 dark:bg-zinc-900/80 backdrop-blur-sm fixed top-0 left-0 z-50 header-gradient-border">
        <div className="flex items-center space-x-3 group">
          <BookOpenIcon className="w-7 h-7 text-emerald-600 dark:text-emerald-500 transition-transform duration-300 ease-in-out group-hover:rotate-3" />
          <h1 className="logo-text text-xl font-bold text-zinc-900 dark:text-zinc-100">
            <span>Rabelus</span>
            <span className="logo-ai">.ai Reader</span>
          </h1>
        </div>
        <ThemeSwitcher />
      </header>
      <main className="flex-grow flex flex-col pt-16 sm:pt-20">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;