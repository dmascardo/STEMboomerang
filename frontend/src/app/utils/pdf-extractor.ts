import * as pdfjsLib from 'pdfjs-dist';

// Configure worker inline
// This avoids external CDN loading issues
if (typeof window !== 'undefined') {
  // Disable worker entirely - runs in main thread
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
}

/**
 * Extract text from a PDF file
 * @param file - PDF file to extract text from
 * @returns Promise<string> - Extracted text content
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document without worker (main thread)
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      verbosity: 0, // Suppress warnings
    });
    
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items from the page with proper spacing
      const pageText = textContent.items
        .map((item: any) => {
          // Handle items with str property (text content)
          if ('str' in item) {
            return item.str;
          }
          return '';
        })
        .filter(str => str.length > 0)
        .join(' ');
      
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    
    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('password') || error.message.includes('encrypted')) {
        throw new Error('This PDF is password-protected. Please use an unlocked version.');
      }
      if (error.message.includes('Invalid PDF')) {
        throw new Error('Invalid PDF file. The file may be corrupted.');
      }
    }
    
    throw new Error('Failed to extract text from PDF. Please try a different file or paste the text directly.');
  }
}

/**
 * Detect if a file is a PDF based on its MIME type or extension
 */
export function isPDF(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
