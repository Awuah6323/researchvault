// src/utils/fileValidation.js
// Client-side checks for the two files a user can hand ResearchVault: a PDF to
// read, and a JSON backup to restore.
//
// These files never leave the device — they are read in the browser and stored
// in localStorage — so this is not a server trust boundary and the validation
// here is not a substitute for one. What it does prevent is the app poisoning
// its own state: a 200 MB "PDF" that fills the storage quota and wedges the
// library, an .exe renamed to .pdf reaching the PDF parser, or a filename with
// path separators in it being used to build a download name.
//
// file.name and file.type are both attacker-controlled — the type is whatever
// the OS guessed from the extension — so neither is trusted on its own. The
// magic bytes are read from the file itself.

/** 50 MB, matching the ceiling api/pdfProxy.js enforces on remote PDFs. */
export const MAX_PDF_BYTES = 50 * 1024 * 1024;

/** 10 MB. A vault is capped at 3 MB server-side; a backup file is the same
 *  metadata with formatting, so this is generous. */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

/**
 * Reads the first bytes of a File and confirms the PDF signature.
 *
 * Only the first slice is read, so this stays cheap on a large file.
 */
export async function hasPdfMagicBytes(file) {
  try {
    const head = new Uint8Array(await file.slice(0, PDF_MAGIC.length).arrayBuffer());
    return PDF_MAGIC.every((byte, i) => head[i] === byte);
  } catch {
    return false;
  }
}

/**
 * Validates a user-selected PDF.
 *
 * @returns {Promise<{ok: true, name: string} | {ok: false, error: string}>}
 */
export async function validatePdfFile(file) {
  if (!file) return { ok: false, error: 'No file was selected.' };

  if (file.size === 0) {
    return { ok: false, error: 'That file is empty.' };
  }

  if (file.size > MAX_PDF_BYTES) {
    const mb = Math.round(file.size / (1024 * 1024));
    return {
      ok: false,
      error: `That PDF is ${mb} MB. The limit is ${MAX_PDF_BYTES / (1024 * 1024)} MB.`
    };
  }

  // The extension and the browser's guessed MIME type are checked first because
  // they are free and catch honest mistakes with a clearer message.
  const name = sanitizeFileName(file.name);
  if (!/\.pdf$/i.test(name)) {
    return { ok: false, error: 'That file is not a PDF. Choose a file ending in .pdf.' };
  }
  if (file.type && file.type !== 'application/pdf' && file.type !== 'application/octet-stream') {
    return { ok: false, error: 'That file is not a PDF.' };
  }

  // The check that actually decides. Everything above can be forged by renaming.
  if (!(await hasPdfMagicBytes(file))) {
    return {
      ok: false,
      error: 'That file is named .pdf but its contents are not a PDF. It may be corrupted or renamed.'
    };
  }

  return { ok: true, name };
}

/**
 * Validates a backup file before it is parsed.
 *
 * Size is checked before reading rather than after: JSON.parse on a very large
 * string is what would freeze the tab, so refusing early is the point.
 */
export function validateBackupFile(file) {
  if (!file) return { ok: false, error: 'No file was selected.' };

  if (file.size === 0) return { ok: false, error: 'That file is empty.' };

  if (file.size > MAX_BACKUP_BYTES) {
    const mb = Math.round(file.size / (1024 * 1024));
    return {
      ok: false,
      error: `That backup is ${mb} MB, which is larger than ResearchVault can restore.`
    };
  }

  const name = sanitizeFileName(file.name);
  if (!/\.json$/i.test(name)) {
    return { ok: false, error: 'A ResearchVault backup is a .json file.' };
  }

  return { ok: true, name };
}

/**
 * Makes a filename safe to store and to reuse as a download name.
 *
 * Strips directory components (so "../../etc/passwd" becomes "passwd"), the
 * characters Windows and the HTTP Content-Disposition header both dislike, and
 * leading dots that would produce a hidden file. The result is never empty.
 */
export function sanitizeFileName(rawName, fallback = 'document') {
  const base = String(rawName || '')
    // Take only the last path segment, whichever separator was used.
    .split(/[/\\]/)
    .pop()
    // Control characters, and the characters that are illegal in a Windows
    // filename or that would let a value break out of a quoted header.
    .replace(/[\u0000-\u001F\u007F<>:"|?*]/g, '')
    .replace(/^\.+/, '')
    .trim();

  if (!base) return fallback;

  // Long names are a portability problem rather than a security one, but the
  // truncation has to keep the extension or the file stops opening.
  if (base.length > 200) {
    const dot = base.lastIndexOf('.');
    const ext = dot > 0 ? base.slice(dot, dot + 12) : '';
    return base.slice(0, 200 - ext.length) + ext;
  }

  return base;
}

/**
 * Confirms a parsed backup is the shape the importer expects.
 *
 * Array.isArray() alone was the previous check, which accepts [1,2,3] and any
 * other array of nonsense. Every entry has to look like a resource, and each is
 * rebuilt from named fields rather than spread, so unknown keys from a
 * hand-edited file never enter the library.
 */
export function isValidBackupShape(parsed) {
  if (!Array.isArray(parsed)) return false;
  if (parsed.length > 10000) return false;

  return parsed.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      (typeof item.title === 'string' || typeof item.id === 'string' || typeof item.id === 'number')
  );
}
