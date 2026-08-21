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

function mergeResource(local, remote) {
  if (!remote) return local;
  if (!local) return remote;

  const localNewer = timeOf(local) >= timeOf(remote);
  const winner = localNewer ? local : remote;
  const loser = localNewer ? remote : local;

  return {
    ...loser,
    ...winner,
    pdfFileData: local.pdfFileData || '',
    fullText: local.fullText || '',
    hasPdf: !!(local.pdfFileData || local.hasPdf || remote.hasPdf),
    readingProgressPercent: Math.max(
      Number(local.readingProgressPercent) || 0,
      Number(remote.readingProgressPercent) || 0
    ),
    lastPageRead: Math.max(Number(local.lastPageRead) || 1, Number(remote.lastPageRead) || 1),
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

  return order
    .map((k) => byKey.get(k))
    .sort((a, b) => timeOf(b) - timeOf(a));
}

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
