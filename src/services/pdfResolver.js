/**
 * ResearchVault PDF Resolver & Acquisition Service
 * Tiered fallback system: Local Base64 -> Direct Browser Fetch -> Backend Proxy -> OpenAlex/SemanticScholar OA Discovery
 */

import { getPdfData } from './pdfStorage';

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

/**
 * Validates whether an ArrayBuffer or Uint8Array starts with the %PDF- magic signature
 * Checks within first 1024 bytes to accommodate UTF-8 BOM, carriage returns, or comments.
 */
export function validatePdfBuffer(arrayBuffer) {
  if (!arrayBuffer) return false;
  const bytes = arrayBuffer instanceof Uint8Array 
    ? arrayBuffer 
    : new Uint8Array(arrayBuffer);
  if (bytes.length < 5) return false;
  
  const limit = Math.min(bytes.length - 4, 1024);
  for (let i = 0; i < limit; i++) {
    if (
      bytes[i] === PDF_MAGIC_BYTES[0] &&
      bytes[i + 1] === PDF_MAGIC_BYTES[1] &&
      bytes[i + 2] === PDF_MAGIC_BYTES[2] &&
      bytes[i + 3] === PDF_MAGIC_BYTES[3] &&
      bytes[i + 4] === PDF_MAGIC_BYTES[4]
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Normalizes Base64 or Data URLs into Uint8Array safely.
 */
export function dataUrlToUint8Array(dataUrl) {
  if (!dataUrl) return new Uint8Array(0);
  if (dataUrl instanceof Uint8Array) return dataUrl;
  if (dataUrl instanceof ArrayBuffer) return new Uint8Array(dataUrl);

  try {
    let base64 = String(dataUrl);
    if (base64.includes(';base64,')) {
      base64 = base64.split(';base64,')[1];
    } else if (base64.startsWith('data:')) {
      base64 = base64.replace(/^data:.*?,/, '');
    }
    // Remove whitespace, linebreaks, and URL encodings
    base64 = base64.replace(/[\r\n\s]/g, '');
    const raw = atob(base64);
    const uint8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      uint8Array[i] = raw.charCodeAt(i);
    }
    return uint8Array;
  } catch (err) {
    console.warn('[pdfResolver] Failed to decode base64 string:', err);
    return new Uint8Array(0);
  }
}

/**
 * Tier 1: Direct Browser Fetch
 */
async function fetchDirectPdf(url) {
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const buffer = await response.arrayBuffer();

  if (!validatePdfBuffer(buffer)) {
    throw new Error('Retrieved content is HTML or non-PDF payload');
  }

  return {
    buffer,
    contentType: contentType || 'application/pdf',
    sourceType: 'publisher'
  };
}

/**
 * Tier 2: Backend Proxy Retrieval
 */
async function fetchProxyPdf(url, backendEndpoint = '/api/pdfProxy') {
  const proxyUrl = `${backendEndpoint}?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Proxy Error HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();

  if (!validatePdfBuffer(buffer)) {
    throw new Error('Proxy returned non-PDF payload');
  }

  return {
    buffer,
    contentType: 'application/pdf',
    sourceType: 'backend_proxy'
  };
}

/**
 * Tier 3: Search for Legitimate Open-Access Alternative Copies
 */
async function findAlternativeOaPdf(resource) {
  const query = resource.doi || resource.title;
  if (!query) return null;

  try {
    // Attempt 1: OpenAlex API Lookup
    const openAlexUrl = resource.doi
      ? `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(resource.doi)}`
      : `https://api.openalex.org/works?search=${encodeURIComponent(resource.title)}&per_page=1`;

    const res = await fetch(openAlexUrl);
    if (res.ok) {
      const data = await res.json();
      const item = resource.doi ? data : data.results?.[0];
      const altUrl = item?.open_access?.oa_url || item?.best_oa_location?.pdf_url;
      if (altUrl && altUrl !== resource.downloadUrl) {
        return { url: altUrl, sourceName: item?.primary_location?.source?.display_name || 'OpenAccess Archive' };
      }
    }
  } catch (e) {
    // Fallthrough to next lookup
  }

  try {
    // Attempt 2: Semantic Scholar API Lookup
    const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=1&fields=openAccessPdf,externalIds`;
    const res = await fetch(ssUrl);
    if (res.ok) {
      const data = await res.json();
      const altUrl = data.data?.[0]?.openAccessPdf?.url;
      if (altUrl && altUrl !== resource.downloadUrl) {
        return { url: altUrl, sourceName: 'Semantic Scholar Repository' };
      }
    }
  } catch (e) {
    // Non-fatal
  }

  return null;
}

/**
 * Main Pipeline Resolver
 */
export async function resolvePdfSource(resource, onStatusChange = () => {}, backendEndpoint = '/api/pdfProxy') {
  if (import.meta.env?.DEV) {
    console.log('[ResearchVault PDF] Initializing acquisition for:', resource.title);
  }

  // 1. Local PDF Upload (Memory / State / Prop)
  if (resource.pdfFileData) {
    onStatusChange('Preparing local document for reading...');
    const bytes = dataUrlToUint8Array(resource.pdfFileData);
    if (bytes && bytes.length > 50) {
      return {
        data: bytes,
        sourceType: 'local',
        resolvedUrl: null
      };
    }
  }

  // 1b. Local PDF Stored in IndexedDB
  if (resource.id) {
    try {
      const storedBytes = await getPdfData(resource.id);
      if (storedBytes && storedBytes.length > 50) {
        return {
          data: storedBytes,
          sourceType: 'local',
          resolvedUrl: null
        };
      }
    } catch (e) {
      // Continue to URL acquisition
    }
  }

  const targetUrl = resource.resolvedPdfUrl || resource.downloadUrl || (resource.sourceUrl && resource.sourceUrl.endsWith('.pdf') ? resource.sourceUrl : null);
  if (!targetUrl) {
    throw new Error('No valid PDF download URL available');
  }

  // 2. Direct Remote Retrieval
  try {
    onStatusChange('Retrieving PDF...');
    const result = await fetchDirectPdf(targetUrl);
    if (import.meta.env?.DEV) {
      console.log('[ResearchVault PDF] Direct fetch succeeded:', targetUrl);
    }
    return {
      data: new Uint8Array(result.buffer),
      sourceType: 'publisher',
      resolvedUrl: targetUrl
    };
  } catch (err) {
    if (import.meta.env?.DEV) {
      console.warn('[ResearchVault PDF] Direct fetch failed, trying proxy service:', err.message);
    }
  }

  // 3. Backend Proxy Retrieval
  try {
    onStatusChange('Direct retrieval blocked by CORS. Routing through proxy service...');
    const result = await fetchProxyPdf(targetUrl, backendEndpoint);
    if (import.meta.env?.DEV) {
      console.log('[ResearchVault PDF] Proxy retrieval succeeded');
    }
    return {
      data: new Uint8Array(result.buffer),
      sourceType: 'backend_proxy',
      resolvedUrl: targetUrl
    };
  } catch (err) {
    if (import.meta.env?.DEV) {
      console.warn('[ResearchVault PDF] Proxy failed, searching alternative OA repositories:', err.message);
    }
  }

  // 4. Find Alternative Open-Access Copy
  onStatusChange('Searching alternative open-access repositories...');
  const altSource = await findAlternativeOaPdf(resource);
  if (altSource) {
    try {
      onStatusChange(`Retrieving copy from ${altSource.sourceName}...`);
      const result = await fetchDirectPdf(altSource.url);
      return {
        data: new Uint8Array(result.buffer),
        sourceType: 'open_access_archive',
        resolvedUrl: altSource.url,
        sourceName: altSource.sourceName
      };
    } catch (e) {
      try {
        const result = await fetchProxyPdf(altSource.url, backendEndpoint);
        return {
          data: new Uint8Array(result.buffer),
          sourceType: 'open_access_archive',
          resolvedUrl: altSource.url,
          sourceName: altSource.sourceName
        };
      } catch (proxyErr) {
        // Fallthrough to complete failure
      }
    }
  }

  throw new Error('UNRETRIEVABLE_PDF');
}
