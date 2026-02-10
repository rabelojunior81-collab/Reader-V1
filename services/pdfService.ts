import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import type { PDFDocumentProxy, RenderParameters, RenderTask } from 'pdfjs-dist/types/src/display/api';

try {
  // Use a stable CDN URL for the PDF.js worker to resolve the "Invalid URL" error.
  // This avoids issues with `import.meta.url` in different environments.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@4.4.168/build/pdf.worker.mjs`;
} catch (error) {
  console.error("Failed to set PDF.js worker source:", error);
}

export async function getPDFDoc(file: File): Promise<PDFDocumentProxy> {
    const arrayBuffer = await file.arrayBuffer();
    // The type for getDocument is a bit tricky, so we cast to any to satisfy it
    return pdfjsLib.getDocument(arrayBuffer as any).promise;
}

export async function getPDFCover(file: File): Promise<string> {
    const pdf = await getPDFDoc(file);
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Set a max width for the cover to avoid overly large images
    const MAX_WIDTH = 300;
    const scale = MAX_WIDTH / viewport.width;
    const scaledViewport = page.getViewport({ scale });
    
    canvas.height = scaledViewport.height;
    canvas.width = scaledViewport.width;

    if (!context) {
        pdf.destroy();
        return '';
    }

    await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    pdf.destroy();
    return dataUrl;
}

export async function renderPDFPageToCanvas(pdfDoc: PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement): Promise<RenderTask> {
    const page = await pdfDoc.getPage(pageNumber);
    
    // Render at a resolution that matches screen density for sharpness
    const scale = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: 2 }); // Render at 2x for high quality
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.style.width = `${viewport.width / scale}px`;
    canvas.style.height = `${viewport.height / scale}px`;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error("Failed to get 2D context from canvas for PDF rendering.");
    }
    
    const renderContext: RenderParameters = {
        canvasContext: context,
        viewport: viewport
    };
    
    return page.render(renderContext);
}

export function getPDFPageCount(pdfDoc: PDFDocumentProxy): number {
    return pdfDoc.numPages;
}