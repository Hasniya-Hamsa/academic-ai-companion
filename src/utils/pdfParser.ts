// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// We use the official CDN worker for pdf.js.
// Since pdfjs-dist is installed, we can match its version or use a stable modern worker.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

export async function extractTextFromPdf(arrayBuffer: ArrayBuffer, onProgress?: (page: number, total: number) => void): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
      if (onProgress) {
        onProgress(i, totalPages);
      }
    }

    return fullText.trim();
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Could not extract text from PDF. Ensure the file is not copy-protected or corrupted.');
  }
}
