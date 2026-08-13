/**
 * Extracts readable text content from an uploaded PDF File object.
 * Uses pdfjs-dist with a fallback binary text stream parser.
 *
 * @param {File} file - The PDF File object uploaded from device input.
 * @returns {Promise<string>} The extracted text content.
 */
export async function extractTextFromPdfFile(file) {
  if (!file) return '';

  try {
    const arrayBuffer = await file.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return '';
    }

    // 1. Primary Extractor: pdfjs-dist
    try {
      const pdfjsLib = await import('pdfjs-dist');
      if (pdfjsLib) {
        try {
          const workerUrl = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
          );
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.href;
        } catch {
          const ver = pdfjsLib.version || '4.0.379';
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${ver}/pdf.worker.min.mjs`;
        }

        // Pass a sliced copy so arrayBuffer is never detached by worker transfer
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
        const pdf = await loadingTask.promise;
        let extractedPages = [];
        const pagesToRead = Math.min(pdf.numPages, 30); // Read up to first 30 pages

        for (let i = 1; i <= pagesToRead; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          if (pageText.trim()) {
            extractedPages.push(pageText.trim());
          }
        }

        const fullText = extractedPages.join('\n\n');
        if (fullText.trim().length > 40) {
          return fullText.trim();
        }
      }
    } catch (pdfJsErr) {
      // Non-fatal, fallthrough to binary snippet extractor
    }

    // 2. Fallback Extractor: Binary Text Stream Matcher
    const decoder = new TextDecoder('latin1');
    const rawText = decoder.decode(arrayBuffer);
    
    // Match text blocks inside PDF BT...ET operations and Tj/TJ strings
    const textSnippets = [];
    const tjRegex = /\(([^()]{3,})\)\s*(?:Tj|TJ)/g;
    let match;
    while ((match = tjRegex.exec(rawText)) !== null) {
      const clean = match[1].replace(/\\([0-7]{3}|[()\\ntr])/g, ' ').trim();
      if (clean.length > 2 && !/^[\d\s._-]+$/.test(clean)) {
        textSnippets.push(clean);
      }
    }

    if (textSnippets.length > 0) {
      const fallbackText = textSnippets.join(' ');
      if (fallbackText.length > 50) {
        return fallbackText.slice(0, 15000);
      }
    }
  } catch (err) {
    console.error("PDF text extraction error:", err);
  }

  return '';
}
