// src/services/vaultMerge.js
// Deterministic three-way-ish merge for a vault arriving from another device.
//
// The previous merge preferred the cloud copy wholesale and used Math.max on a
// couple of numeric fields. That loses edits: rename a paper on your phone,
// and the next laptop pull would quietly overwrite the new title with the old
// one, because "cloud wins" had no notion of which edit was newer.
//
// Rules here, in order:
//   * A tombstone wins over any copy of that item, from either side. Deleting
//     on one device must not be resurrected by the other still having it.
//   * For an item both sides have, the higher `updatedAt` wins. Ties keep the
//     local copy, so a device never appears to lose its own work on a no-op.
//   * Fields that only exist locally (pdfFileData, fullText) are always carried
//     across, because the server strips them and the remote copy never has them.
//   * Reading position takes the furthest of the two — the useful answer when
//     you read on your phone and then open your laptop.
//
// Pure functions, no localStorage access, so this is straightforward to test.

/** Stable identity for a resource. Falls back to title for legacy rows. */
export function resourceKey(resource) {
  if (!resource) return '';
  return String(resource.id != null ? resource.id : resource.title || '');
}

function timeOf(item) {
  const stamp = item && (item.updatedAt || item.addedAt);
  if (!stamp) return 0;
  const parsed = Date.parse(stamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Merges one resource pair, preferring the newer edit but never dropping
 * device-local attachments or losing reading progress.
 */
function mergeResource(local, remote) {
  if (!remote) return local;
  if (!local) return remote;

  const localNewer = timeOf(local) >= timeOf(remote);
  const winner = localNewer ? local : remote;
  const loser = localNewer ? remote : local;

  return {
    ...loser,
    ...winner,
    // Attachments live only on the device that added them.
    pdfFileData: local.pdfFileData || '',
    fullText: local.fullText || '',
    hasPdf: !!(local.pdfFileData || local.hasPdf || remote.hasPdf),
    // Furthest-read wins regardless of which edit was newer.
    readingProgressPercent: Math.max(
      Number(local.readingProgressPercent) || 0,
      Number(remote.readingProgressPercent) || 0
    ),
    lastPageRead: Math.max(Number(local.lastPageRead) || 1, Number(remote.lastPageRead) || 1),
    // Starring is intentional on either device; keep it if either has it.
    isFavorite: !!(local.isFavorite || remote.isFavorite)
  };
}

export function mergeResources(localList, remoteList, deletedIds) {
  const tombstones = deletedIds instanceof Set ? deletedIds : new Set(deletedIds || []);
  const isDeleted = (r) =>
    tombstones.has(resourceKey(r)) || (r && r.title && tombstones.has(String(r.title)));

  const byKey = new Map();
  const order = [];

  const take = (item) => {
    if (!item || isDeleted(item)) return;
    const key = resourceKey(item);
    if (!key) return;
    if (byKey.has(key)) {
      byKey.set(key, mergeResource(byKey.get(key), item));
    } else {
      byKey.set(key, item);
      order.push(key);
    }
  };

  (localList || []).forEach(take);
  (remoteList || []).forEach(take);

  // Newest first, which matches how the app has always presented the library.
  return order
    .map((k) => byKey.get(k))
    .sort((a, b) => timeOf(b) - timeOf(a));
}

/** Union of note lists for one resource, de-duplicated by note id. */
export function mergeNoteList(localNotes, remoteNotes) {
  const byId = new Map();
  const order = [];

  const take = (note) => {
    if (!note) return;
    const key = String(note.id != null ? note.id : `${note.pageNumber}:${note.noteText}`);
    if (!byId.has(key)) {
      byId.set(key, note);
      order.push(key);
    }
  };

  (localNotes || []).forEach(take);
  (remoteNotes || []).forEach(take);

  return order.map((k) => byId.get(k)).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}

/**
 * Merges category lists by name, since ids are generated per-device with
 * Date.now() and therefore differ for the same category on two devices.
 */
export function mergeCategories(localList, remoteList) {
  const byName = new Map();
  const order = [];

  const take = (cat) => {
    if (!cat || !cat.name) return;
    const key = String(cat.name).toLowerCase();
    if (byName.has(key)) {
      const existing = byName.get(key);
      byName.set(key, { ...existing, ...cat, id: existing.id });
    } else {
      byName.set(key, cat);
      order.push(key);
    }
  };

  (localList || []).forEach(take);
  (remoteList || []).forEach(take);

  return order.map((k) => byName.get(k));
}

/**
 * Whether a local vault differs from what the remote holds, used to skip
 * pointless pushes. Compares the synced projection only — a change to
 * pdfFileData is not a reason to talk to the server.
 */
export function vaultFingerprint(vault) {
  if (!vault) return '0';

  const resources = (vault.resources || [])
    .map((r) => `${resourceKey(r)}:${r.updatedAt || r.addedAt || ''}:${r.readingProgressPercent || 0}:${r.lastPageRead || 1}:${r.isFavorite ? 1 : 0}`)
    .sort()
    .join('|');

  const categories = (vault.categories || []).map((c) => c.name).sort().join(',');

  const notes = Object.keys(vault.notesMap || {})
    .sort()
    .map((id) => `${id}:${(vault.notesMap[id] || []).length}`)
    .join('|');

  const profile = vault.profile
    ? [vault.profile.name, vault.profile.institution, vault.profile.fieldOfStudy, vault.profile.researchInterests].join('~')
    : '';

  return `${resources}#${categories}#${notes}#${profile}`;
}
