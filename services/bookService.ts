import JSZip, { JSZipObject } from 'jszip';
import ePub from "epubjs";
import { ComicPage, LibraryItem, BookType } from '../types';
import * as pdfService from './pdfService';

export const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

const MAX_GEMINI_IMAGE_DIMENSION = 1024;

export const resizeImageForGemini = (dataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      let newWidth = width;
      let newHeight = height;

      if (width > height) {
        if (width > MAX_GEMINI_IMAGE_DIMENSION) {
          newHeight = Math.round((height * MAX_GEMINI_IMAGE_DIMENSION) / width);
          newWidth = MAX_GEMINI_IMAGE_DIMENSION;
        }
      } else {
        if (height > MAX_GEMINI_IMAGE_DIMENSION) {
          newWidth = Math.round((width * MAX_GEMINI_IMAGE_DIMENSION) / height);
          newHeight = MAX_GEMINI_IMAGE_DIMENSION;
        }
      }

      if (newWidth === width && newHeight === height) {
        resolve(dataUrl);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context for resizing'));
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(resizedDataUrl);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
};

const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

// --- CBZ / Comic Book Service ---

const getSortedImageFiles = (zip: JSZip): JSZipObject[] => {
    return Object.values(zip.files)
        .filter((f: JSZipObject) => !f.dir && /\.(jpe?g|png|gif|webp)$/i.test(f.name))
        .sort((a: JSZipObject, b: JSZipObject) => a.name.localeCompare(b.name, undefined, { numeric: true }));
};

export async function getComicPages(file: File): Promise<ComicPage[]> {
    const zip = await JSZip.loadAsync(file);
    const imageFiles = getSortedImageFiles(zip);

    const pagePromises = imageFiles.map(async (imageFile) => {
        try {
            const blob = await imageFile.async('blob');
            const url = URL.createObjectURL(blob);
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = url;
            });
            return { id: imageFile.name, url, width: img.naturalWidth, height: img.naturalHeight };
        } catch (e) {
            console.error("Error processing image file:", imageFile.name, e);
            return null;
        }
    });

    return (await Promise.all(pagePromises)).filter((p): p is ComicPage => p !== null);
}

async function getComicCover(file: File): Promise<string> {
    const zip = await JSZip.loadAsync(file);
    const imageFiles = getSortedImageFiles(zip);
    if (imageFiles.length > 0) {
        const firstPageBlob = await imageFiles[0].async('blob');
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(firstPageBlob);
        });
    }
    return '';
}

// --- EPUB Service ---

async function getEpubCover(file: File): Promise<string> {
  const book = ePub(await file.arrayBuffer());
  const coverUrl = await book.coverUrl();
  if (coverUrl) {
    const response = await fetch(coverUrl);
    const blob = await response.blob();
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
  }
  return '';
}

// --- Library Item Factory ---

export async function createLibraryItem(file: File): Promise<LibraryItem | null> {
    const ext = getFileExtension(file.name);
    let type: BookType | null = null;
    if (ext === 'cbz') type = 'cbz';
    else if (ext === 'epub') type = 'epub';
    else if (ext === 'pdf') type = 'pdf';

    if (!type) {
        console.warn(`Unsupported file type: ${ext}`);
        return null;
    }

    const id = `${file.name}-${file.size}`;
    let coverUrl = '';
    let totalPages = 0;

    try {
        if (type === 'cbz') {
            coverUrl = await getComicCover(file);
            const zip = await JSZip.loadAsync(file);
            totalPages = getSortedImageFiles(zip).length;
        } else if (type === 'epub') {
            coverUrl = await getEpubCover(file);
            totalPages = 100; // Use percentage for EPUBs
        } else if (type === 'pdf') {
            coverUrl = await pdfService.getPDFCover(file);
            const doc = await pdfService.getPDFDoc(file);
            totalPages = doc.numPages;
            doc.destroy();
        }
    } catch (error) {
        console.error(`Error creating library item for ${file.name}:`, error);
        return null;
    }

    return {
        id,
        file,
        title: file.name.replace(/\.[^/.]+$/, ""),
        coverUrl,
        type,
        totalPages,
    };
}