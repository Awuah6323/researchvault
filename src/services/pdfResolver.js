/**
 * ResearchVault PDF Resolver & Acquisition Service
 * Tiered fallback system: Local Base64 -> Direct Browser Fetch -> Backend Proxy -> OpenAlex/SemanticScholar OA Discovery
 */

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

/**
 * Validates whether an ArrayBuffer or Uint8Array starts with the %PDF- magic signature
 */
export function validatePdfBuffer(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 5) return false;
  const bytes = arrayBuffer instanceof Uint8Array 
    ? arrayBuffer.subarray(0, 5) 
    : new Uint8Array(arrayBuffer, 0, 5);
  return PDF_MAGIC_BYTES.every((byte, i) => bytes[i] === byte);
}

/**
 * Normalizes Base64 or Data URLs into Uint8Array
 */
export function dataUrlToUint8Array(dataUrl) {
  const parts = dataUrl.split(';base64,');
  const raw = atob(parts[1] || parts[0]);
  const uint8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    uint8Array[i] = raw.charCodeAt(i);
  }
  return uint8Array;
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

  // 1. Local PDF Upload
  if (resource.pdfFileData) {
    onStatusChange('Preparing local document for reading...');
    const bytes = dataUrlToUint8Array(resource.pdfFileData);
    if (validatePdfBuffer(bytes)) {
      return {
        data: bytes,
        sourceType: 'local',
        resolvedUrl: null
      };
    }
  }

  const targetUrl = resource.resolvedPdfUrl || resource.downloadUrl;
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
