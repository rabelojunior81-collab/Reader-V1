export interface Panel {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComicPage {
  id: string;
  url: string;
  width: number;
  height: number;
}

export type BookType = 'cbz' | 'epub' | 'pdf';

export interface LibraryItem {
  id: string; // Unique ID, e.g., `${file.name}-${file.size}`
  file: File;
  title: string;
  coverUrl: string; // Base64 data URL
  type: BookType;
  totalPages: number;
}
