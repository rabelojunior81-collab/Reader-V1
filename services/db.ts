import { LibraryItem } from '../types';

const DB_NAME = 'rabelus-reader-db';
const DB_VERSION = 1;
const STORE_NAME = 'library';

let db: IDBDatabase;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database error:', request.error);
      reject('Error opening database');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const getBooks = (): Promise<LibraryItem[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject('Error fetching books');
      request.onsuccess = () => resolve(request.result);
    } catch (error) {
        reject(error);
    }
  });
};

export const addBook = (book: LibraryItem): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(book);

      request.onerror = () => reject('Error adding book');
      request.onsuccess = () => resolve();
    } catch(error) {
        reject(error);
    }
  });
};

export const deleteBook = (bookId: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(bookId);

      request.onerror = () => reject('Error deleting book');
      request.onsuccess = () => resolve();
    } catch(error) {
        reject(error);
    }
  });
};

export const updateBookTitle = (bookId: string, newTitle: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await initDB();
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(bookId);

            getRequest.onerror = () => reject('Error finding book to update');
            getRequest.onsuccess = () => {
                const book = getRequest.result;
                if (book) {
                    book.title = newTitle;
                    const putRequest = store.put(book);
                    putRequest.onerror = () => reject('Error updating book title');
                    putRequest.onsuccess = () => resolve();
                } else {
                    reject('Book not found');
                }
            };
        } catch(error) {
            reject(error);
        }
    });
};
