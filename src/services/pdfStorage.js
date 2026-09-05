/**
 * ResearchVault IndexedDB PDF File Storage
 * Stores large PDF files (Uint8Array / ArrayBuffer / Blob / Base64) directly in IndexedDB
 * preventing localStorage 5MB quota exhaustion and attachment eviction.
 */

const DB_NAME = 'researchvault_pdf_store';
const DB_VERSION = 1;
const STORE_NAME = 'pdf_documents';

/**
 * Normalizes any Base64, Data URL, ArrayBuffer, or Uint8Array into a binary Uint8Array safely.
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
    base64 = base64.replace(/[\r\n\s]/g, '');
    const raw = atob(base64);
    const uint8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      uint8Array[i] = raw.charCodeAt(i);
    }
    return uint8Array;
  } catch (err) {
    console.warn('[pdfStorage] Failed to decode base64 string:', err);
    return new Uint8Array(0);
  }
}

function openPdfDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a PDF Uint8Array, Blob, ArrayBuffer, or Base64 string associated with a resource ID.
 */
export async function storePdfData(resourceId, data) {
  if (!resourceId || !data) return false;
  try {
    let bytes;
    if (data instanceof Uint8Array) {
      bytes = data;
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (data instanceof Blob) {
      const buf = await data.arrayBuffer();
      bytes = new Uint8Array(buf);
    } else if (typeof data === 'string') {
      bytes = dataUrlToUint8Array(data);
    } else {
      return false;
    }

    if (!bytes || bytes.length === 0) return false;

    const db = await openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(bytes, String(resourceId));

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[pdfStorage] Failed to store in IndexedDB:', err);
    return false;
  }
}

/**
 * Retrieves stored PDF as Uint8Array by resource ID.
 */
export async function getPdfData(resourceId) {
  if (!resourceId) return null;
  try {
    const db = await openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(String(resourceId));

      request.onsuccess = () => {
        const res = request.result;
        if (!res) return resolve(null);
        if (res instanceof Uint8Array) return resolve(res);
        if (res instanceof ArrayBuffer) return resolve(new Uint8Array(res));
        if (typeof res === 'string') {
          const converted = dataUrlToUint8Array(res);
          return resolve(converted.length > 0 ? converted : null);
        }
        if (res instanceof Blob) {
          res.arrayBuffer()
            .then((b) => resolve(new Uint8Array(b)))
            .catch(() => resolve(null));
          return;
        }
        resolve(null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[pdfStorage] Failed to retrieve from IndexedDB:', err);
    return null;
  }
}

/**
 * Deletes a stored PDF document by resource ID.
 */
export async function deletePdfData(resourceId) {
  if (!resourceId) return;
  try {
    const db = await openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(String(resourceId));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // Non-fatal
  }
}
