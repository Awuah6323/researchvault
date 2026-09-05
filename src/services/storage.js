// src/services/storage.js - Account-scoped local storage and sync service

import {
  hasSyncSession,
  initSyncSession,
  apiRegister,
  apiLogin,
  startGoogleSignIn,
  apiRequestPasswordReset,
  apiUpdatePassword,
  apiLogout,
  fetchRemoteVersion,
  fetchRemoteVault,
  pushRemoteVault,
  subscribeToVaultChanges,
  unsubscribeFromVaultChanges,
  createPushScheduler,
  AuthExpiredError,
  BackendUnavailableError
} from './syncClient';

import {
  mergeResources,
  mergeNoteList,
  mergeCategories,
  vaultFingerprint,
  resourceKey
} from './vaultMerge';

const BASE_KEYS = {
  RESOURCES: 'researchvault_resources',
  CATEGORIES: 'researchvault_categories',
  NOTES: 'researchvault_notes',
  PROFILE: 'researchvault_profile',
  THEME: 'researchvault_theme',
  USERS: 'researchvault_users',
  SESSION: 'researchvault_session',
  LAST_SYNC: 'researchvault_last_sync',
  DELETED_IDS: 'researchvault_deleted_ids',
  SYNC_VERSION: 'researchvault_sync_version',
  SYNC_FINGERPRINT: 'researchvault_sync_fingerprint'
};

const DEFAULT_CATEGORIES = [
  { id: 1, name: "Computer Science", description: "Algorithms, Systems, and Computing", icon: "Code2", count: 0 },
  { id: 2, name: "Artificial Intelligence", description: "Machine Learning, LLMs, and Robotics", icon: "Bot", count: 0 },
  { id: 3, name: "Data Science", description: "Big Data Analytics & Statistics", icon: "BarChart3", count: 0 },
  { id: 4, name: "Cybersecurity", description: "Cryptography, Network & System Security", icon: "Shield", count: 0 },
  { id: 5, name: "Cloud Computing", description: "Distributed Systems & Cloud Architectures", icon: "Cloud", count: 0 },
  { id: 6, name: "Software Engineering", description: "Architecture, Design Patterns & DevOps", icon: "Cpu", count: 0 },
  { id: 7, name: "Research Methods", description: "Literature Review & Quantitative Analysis", icon: "BookOpen", count: 0 },
  { id: 8, name: "Medicine & Healthcare", description: "Bio-Informatics & Public Health", icon: "Activity", count: 0 }
];

const DEFAULT_RESOURCES = [];

// Mandatory AuthGate: no unauthenticated default profile.
const DEFAULT_PROFILE = null;

// One-time cleanup of credentials written by the old client-side scheme. Those
// records were pushed to a public bucket, so the local copies are no longer
// meaningful and the hashes should not linger on disk.
if (typeof window !== 'undefined') {
  try {
    if (!localStorage.getItem('researchvault_v5_server_auth')) {
      localStorage.removeItem(BASE_KEYS.USERS);
      localStorage.removeItem(BASE_KEYS.SESSION);
      localStorage.removeItem(BASE_KEYS.PROFILE);
      localStorage.setItem('researchvault_v5_server_auth', 'true');
    }
  } catch (e) {
    /* storage unavailable */
  }
}

let syncListeners = [];
let currentSyncState = 'synced';

function notifySyncListeners(state, timestamp) {
  currentSyncState = state;
  syncListeners.forEach((fn) => {
    try {
      fn(state, timestamp);
    } catch (e) {
      /* a broken listener must not break sync */
    }
  });
}

function getActiveUserEmail() {
  try {
    const session = localStorage.getItem(BASE_KEYS.SESSION);
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed && parsed.email) return String(parsed.email).toLowerCase().trim();
    }
  } catch (e) {
    /* fall through */
  }
  return 'guest_user';
}

function getScopedKey(baseKey) {
  return `${baseKey}_${encodeURIComponent(getActiveUserEmail())}`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function getSyncedVersion() {
  const raw = localStorage.getItem(getScopedKey(BASE_KEYS.SYNC_VERSION));
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setSyncedVersion(version) {
  try {
    localStorage.setItem(getScopedKey(BASE_KEYS.SYNC_VERSION), String(version || 0));
  } catch (e) {
    /* ignore */
  }
}

function getSyncedFingerprint() {
  return localStorage.getItem(getScopedKey(BASE_KEYS.SYNC_FINGERPRINT)) || '';
}

function setSyncedFingerprint(fingerprint) {
  try {
    localStorage.setItem(getScopedKey(BASE_KEYS.SYNC_FINGERPRINT), fingerprint || '');
  } catch (e) {
    /* ignore */
  }
}

/** True when a signed-in account exists and we hold a live Supabase session. */
function canSync() {
  const email = getActiveUserEmail();
  return email !== 'guest_user' && hasSyncSession();
}

// ---------------------------------------------------------------------------
// Vault assembly
// ---------------------------------------------------------------------------

/**
 * Builds the synced projection of local state. Deliberately excludes
 * pdfFileData and fullText: they are the bulk of the payload, they are already
 * on the device that added them, and shipping them was the main reason sync
 * used to feel slow.
 */
function buildLocalVault() {
  const resources = storage.getResources();

  const notesMap = {};
  resources.forEach((r) => {
    const notes = storage.getNotes(r.id);
    if (notes && notes.length) notesMap[r.id] = notes;
  });

  return {
    resources: resources.map(({ pdfFileData, fullText, ...rest }) => ({
      ...rest,
      hasPdf: !!(pdfFileData || rest.hasPdf)
    })),
    categories: storage.getCategories(),
    notesMap,
    profile: storage.getProfile(),
    deletedIds: Array.from(storage.getDeletedIds())
  };
}

/** Applies a remote vault on top of local state. Returns true if anything changed. */
function applyRemoteVault(remoteVault) {
  if (!remoteVault) return false;

  const beforeFingerprint = vaultFingerprint(buildLocalVault());

  const tombstones = storage.getDeletedIds();
  (remoteVault.deletedIds || []).forEach((id) => tombstones.add(String(id)));

  const mergedResources = mergeResources(
    storage.getResources(),
    remoteVault.resources || [],
    tombstones
  );

  // skipCloudPush: this data came *from* the cloud; echoing it back would
  // bump the version and make two devices ping-pong forever.
  storage.saveResources(mergedResources, true);
  writeJson(getScopedKey(BASE_KEYS.DELETED_IDS), Array.from(tombstones));

  if (Array.isArray(remoteVault.categories) && remoteVault.categories.length) {
    storage.saveCategories(mergeCategories(storage.getCategories(), remoteVault.categories), true);
  }

  if (remoteVault.notesMap && typeof remoteVault.notesMap === 'object') {
    Object.keys(remoteVault.notesMap).forEach((resId) => {
      const merged = mergeNoteList(storage.getNotes(resId), remoteVault.notesMap[resId]);
      storage.saveNotes(resId, merged, true);
    });
  }

  if (remoteVault.profile) {
    const current = storage.getProfile() || {};
    storage.saveProfile({ ...current, ...remoteVault.profile }, true);
  }

  return vaultFingerprint(buildLocalVault()) !== beforeFingerprint;
}

function stampSyncTime() {
  const label = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  storage.setLastSyncTime(label);
  return label;
}

async function handleAuthExpired() {
  // supabase-js owns the session; clearing it is its job, not ours. All we do
  // is stop trying to sync and let the UI say so.
  unsubscribeFromVaultChanges();
  notifySyncListeners('error', storage.getLastSyncTime());
}

/**
 * Builds a profile for an account that exists only on this device.
 *
 * Used when the sync backend is unreachable — offline, or running plain
 * `vite dev`, which does not execute the /api functions. No token is issued,
 * so this grants access to nothing beyond this browser's own localStorage.
 * The vault syncs later, once a real sign-in succeeds.
 */
function createLocalOnlyUser({ name, email, institution, fieldOfStudy }) {
  return {
    email: String(email || '').toLowerCase().trim(),
    name: String(name || '').trim() || String(email || '').split('@')[0],
    institution: institution || 'University / Institution',
    fieldOfStudy: fieldOfStudy || 'General Research',
    researchInterests: 'Academic Literature, Data Analysis',
    createdAt: nowIso()
  };
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

async function performPush() {
  if (!canSync()) return;

  const vault = buildLocalVault();
  const fingerprint = vaultFingerprint(vault);

  // Nothing actually changed in the synced projection — skip the round trip.
  if (fingerprint === getSyncedFingerprint()) {
    notifySyncListeners('synced', storage.getLastSyncTime());
    return;
  }

  notifySyncListeners('syncing', storage.getLastSyncTime());

  try {
    let result = await pushRemoteVault({ vault, baseVersion: getSyncedVersion() });

    // Another device wrote first: merge its copy, then commit once more.
    if (result.status === 'conflict') {
      applyRemoteVault(result.vault);
      setSyncedVersion(result.version);

      const rebuilt = buildLocalVault();
      result = await pushRemoteVault({ vault: rebuilt, baseVersion: result.version });
    }

    if (result.status === 'ok') {
      setSyncedVersion(result.version);
      setSyncedFingerprint(vaultFingerprint(buildLocalVault()));
      notifySyncListeners('synced', stampSyncTime());
      return;
    }

    notifySyncListeners('error', storage.getLastSyncTime());
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      await handleAuthExpired();
      return;
    }
    notifySyncListeners('offline', storage.getLastSyncTime());
  }
}

const pushScheduler = createPushScheduler(performPush);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const storage = {
  subscribeSyncState(callback) {
    syncListeners.push(callback);
    callback(currentSyncState, this.getLastSyncTime());
    return () => {
      syncListeners = syncListeners.filter((fn) => fn !== callback);
    };
  },

  getSyncState() {
    return currentSyncState;
  },

  getLastSyncTime() {
    return localStorage.getItem(getScopedKey(BASE_KEYS.LAST_SYNC)) || 'Not synced yet';
  },

  setLastSyncTime(timestampStr) {
    try {
      localStorage.setItem(getScopedKey(BASE_KEYS.LAST_SYNC), timestampStr);
    } catch (e) {
      /* ignore */
    }
  },

  /** True once credentials exist; the UI uses this to explain sync state. */
  isSyncEnabled() {
    return canSync();
  },

  // ------------------------------------------------------------- RESOURCES

  getResources() {
    return readJson(getScopedKey(BASE_KEYS.RESOURCES), DEFAULT_RESOURCES) || DEFAULT_RESOURCES;
  },

  saveResources(resources, skipCloudPush = false) {
    const key = getScopedKey(BASE_KEYS.RESOURCES);

    if (!writeJson(key, resources)) {
      // Quota exceeded. Drop the heaviest field and keep the metadata rather
      // than losing the write entirely.
      const lighter = resources.map((r) => ({ ...r, pdfFileData: '' }));
      if (!writeJson(key, lighter)) {
        console.warn('Storage quota reached; could not save resources.');
      }
    }

    if (!skipCloudPush) pushScheduler.schedule();
  },

  addResource(resource) {
    const list = this.getResources();
    const stamp = nowIso();
    const newDoc = {
      ...resource,
      id: Date.now(),
      addedAt: stamp,
      updatedAt: stamp,
      downloadStatus: resource.downloadStatus || 'COMPLETED',
      readingProgressPercent: resource.readingProgressPercent || 0,
      lastPageRead: 1
    };
    list.unshift(newDoc);
    this.saveResources(list);
    return newDoc;
  },

  toggleFavorite(id) {
    const list = this.getResources().map((r) =>
      String(r.id) === String(id) ? { ...r, isFavorite: !r.isFavorite, updatedAt: nowIso() } : r
    );
    this.saveResources(list);
    return list;
  },

  getDeletedIds() {
    return new Set(readJson(getScopedKey(BASE_KEYS.DELETED_IDS), []) || []);
  },

  deleteResource(id) {
    const list = this.getResources().filter((r) => String(r.id) !== String(id));

    const tombstones = this.getDeletedIds();
    tombstones.add(String(id));
    writeJson(getScopedKey(BASE_KEYS.DELETED_IDS), Array.from(tombstones));

    this.saveResources(list);
    return list;
  },

  updateReadingProgress(id, progress, page) {
    const list = this.getResources().map((r) =>
      String(r.id) === String(id)
        ? { ...r, readingProgressPercent: progress, lastPageRead: page, updatedAt: nowIso() }
        : r
    );
    // Reading position changes constantly while scrolling; the debounce in the
    // scheduler is what keeps this from becoming a request per page turn.
    this.saveResources(list);
    return list;
  },

  updateResource(id, updates) {
    const list = this.getResources().map((r) =>
      String(r.id) === String(id) ? { ...r, ...updates, updatedAt: nowIso() } : r
    );
    this.saveResources(list);
    return list;
  },

  // ------------------------------------------------------------ CATEGORIES

  getCategories() {
    return readJson(getScopedKey(BASE_KEYS.CATEGORIES), DEFAULT_CATEGORIES) || DEFAULT_CATEGORIES;
  },

  saveCategories(categories, skipCloudPush = false) {
    writeJson(getScopedKey(BASE_KEYS.CATEGORIES), categories);
    if (!skipCloudPush) pushScheduler.schedule();
  },

  addCategory(category) {
    const list = this.getCategories();
    // Rebuilt from named fields rather than spread: a spread would carry any
    // key the caller happened to include straight into the synced vault.
    list.push({
      id: Date.now(),
      name: String(category?.name || '').slice(0, 100),
      description: String(category?.description || '').slice(0, 300),
      icon: String(category?.icon || 'BookOpen').slice(0, 50),
      count: 0
    });
    this.saveCategories(list);
    return list;
  },

  // --------------------------------------------------------------- PROFILE

  getProfile() {
    return readJson(getScopedKey(BASE_KEYS.PROFILE), DEFAULT_PROFILE);
  },

  saveProfile(profile, skipCloudPush = false) {
    writeJson(getScopedKey(BASE_KEYS.PROFILE), profile);

    // Keep the active session label in step with the profile.
    try {
      const sessionStr = localStorage.getItem(BASE_KEYS.SESSION);
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session && session.email === profile.email) {
          localStorage.setItem(BASE_KEYS.SESSION, JSON.stringify({ ...session, ...profile }));
        }
      }
    } catch (e) {
      /* ignore */
    }

    if (!skipCloudPush) pushScheduler.schedule();
  },

  // ----------------------------------------------------------------- THEME

  getTheme() {
    const saved = localStorage.getItem(BASE_KEYS.THEME);
    const MIGRATIONS = {
      'warm-sepia': 'sepia',
      'cyber-emerald': 'verdant',
      'scholarly-light': 'folio',
      'midnight-oled': 'noir',
      'dark-vault': 'sepia'
    };
    if (!saved) return 'sepia';
    if (MIGRATIONS[saved]) {
      const migrated = MIGRATIONS[saved];
      try {
        localStorage.setItem(BASE_KEYS.THEME, migrated);
      } catch (e) {}
      return migrated;
    }
    return saved;
  },

  saveTheme(theme) {
    try {
      localStorage.setItem(BASE_KEYS.THEME, theme);
    } catch (e) {
      /* ignore */
    }
  },

  // ----------------------------------------------------------------- NOTES

  getNotes(resourceId) {
    return readJson(`${getScopedKey(BASE_KEYS.NOTES)}_${resourceId}`, []) || [];
  },

  saveNotes(resourceId, notesList, skipCloudPush = false) {
    if (!writeJson(`${getScopedKey(BASE_KEYS.NOTES)}_${resourceId}`, notesList)) {
      console.warn('Storage quota reached; could not save notes.');
    }
    if (!skipCloudPush) pushScheduler.schedule();
  },

  addNote(resourceId, noteText, pageNumber) {
    const notes = this.getNotes(resourceId);
    notes.unshift({
      id: Date.now(),
      // Bounded because notes are synced into the vault, which Postgres caps at
      // 3 MB. Without a limit here a pasted document is accepted locally and
      // then silently fails to sync, which looks like a sync bug rather than
      // the oversized note it actually is.
      noteText: String(noteText || '').slice(0, 20000),
      pageNumber: Number.isFinite(Number(pageNumber)) ? Number(pageNumber) : null,
      createdAt: new Date().toLocaleDateString()
    });
    this.saveNotes(resourceId, notes);
    return notes;
  },

  getAllNotesAcrossLibrary() {
    const allNotes = [];
    this.getResources().forEach((r) => {
      this.getNotes(r.id).forEach((n) => {
        allNotes.push({ ...n, resourceId: r.id, paperTitle: r.title, paperAuthors: r.authors });
      });
    });
    return allNotes.sort((a, b) => b.id - a.id);
  },

  // ---------------------------------------------------------------- BACKUP

  importBackupData(importedResources, overwrite = false) {
    if (!Array.isArray(importedResources)) {
      throw new Error('Invalid backup data format. Expected an array of papers.');
    }
    const current = overwrite ? [] : this.getResources();
    const existingIds = new Set(current.map((r) => r.id));
    const newItems = importedResources
      .filter((r) => r.title && !existingIds.has(r.id))
      .map((r) => ({ ...r, updatedAt: r.updatedAt || nowIso() }));

    const updated = [...newItems, ...current];
    this.saveResources(updated);
    return updated;
  },

  // ------------------------------------------------------------------ USERS
  // Kept so existing call sites keep working. Credentials are no longer stored
  // locally — only the display profile of the signed-in account.

  getUsers() {
    return readJson(BASE_KEYS.USERS, []) || [];
  },

  cacheUserLocally(user) {
    const safe = {
      email: user.email,
      name: user.name,
      institution: user.institution,
      fieldOfStudy: user.fieldOfStudy,
      researchInterests: user.researchInterests
    };
    const others = this.getUsers().filter(
      (u) => String(u.email).toLowerCase() !== String(user.email).toLowerCase()
    );
    others.push(safe);
    writeJson(BASE_KEYS.USERS, others);
  },

  // ------------------------------------------------------------------- AUTH

  async registerUser(
    name,
    email,
    password,
    institution = 'University / Institution',
    fieldOfStudy = 'General Research'
  ) {
    try {
      const { user, needsEmailConfirmation } = await apiRegister({
        name,
        email,
        password,
        institution,
        fieldOfStudy
      });

      this.cacheUserLocally(user);

      // With email confirmation enabled the account is not usable yet: there is
      // no session, so signing them in would produce an app that silently fails
      // to sync. Hand the flag back and let the UI say "check your email".
      if (needsEmailConfirmation) {
        return { ...user, needsEmailConfirmation: true };
      }

      this.saveSession(user);
      this.startRealtimeSync();
      await this.pullCloudVault(user.email, { force: true });
      return { ...user, needsEmailConfirmation: false };
    } catch (err) {
      // A validation failure (weak password, email taken) must surface as-is.
      // Only an unreachable backend falls through to local-only mode.
      if (!(err instanceof BackendUnavailableError)) throw err;

      const user = createLocalOnlyUser({ name, email, institution, fieldOfStudy });
      this.cacheUserLocally(user);
      this.saveSession(user, { localOnly: true });
      notifySyncListeners('local-only', this.getLastSyncTime());
      return user;
    }
  },

  async loginUser(email, password) {
    try {
      const { user } = await apiLogin({ email, password });
      this.cacheUserLocally(user);
      this.saveSession(user);
      this.startRealtimeSync();
      await this.pullCloudVault(user.email, { force: true });
      return user;
    } catch (err) {
      if (!(err instanceof BackendUnavailableError)) throw err;

      // Offline sign-in is only offered for an account this device has already
      // seen. It unlocks the local vault; it grants no server access, because
      // there is no session to grant. An unknown email gets a clear message
      // instead of silently creating an empty account.
      const known = this.getUsers().find(
        (u) => String(u.email).toLowerCase() === String(email).toLowerCase().trim()
      );

      if (!known) {
        throw new Error(
          'Cannot reach the ResearchVault server, and this device has no offline copy of that account. Reconnect and try again.'
        );
      }

      this.saveSession(known, { localOnly: true });
      notifySyncListeners('local-only', this.getLastSyncTime());
      return known;
    }
  },

  /**
   * Starts Google sign-in by handing off to Supabase.
   *
   * This navigates away and does not return a user — the session arrives after
   * Google redirects back, and adoptSession() picks it up from the SIGNED_IN
   * event. Verification is entirely server-side; the browser never decides who
   * a token belongs to, which is how an earlier build of this app let anyone
   * sign in as anyone by typing their email address.
   */
  async loginWithGoogle() {
    await startGoogleSignIn();
  },

  /** Emails a password-reset link. Resolves whether or not the account exists. */
  async requestPasswordReset(email) {
    await apiRequestPasswordReset(email);
  },

  /** Sets a new password using the recovery session from the emailed link. */
  async completePasswordReset(newPassword) {
    await apiUpdatePassword(newPassword);
  },

  /**
   * Adopts a Supabase session that arrived outside a sign-in call — the Google
   * redirect landing, or a stored session being restored on page load.
   *
   * Idempotent: called on every auth event, and does nothing if this account is
   * already the active local session.
   */
  async adoptSession(user) {
    if (!user || !user.email) return null;

    const existing = this.getSession();
    const alreadyActive =
      existing && String(existing.email).toLowerCase() === String(user.email).toLowerCase();

    this.cacheUserLocally(user);
    if (!alreadyActive) this.saveSession(user);

    this.startRealtimeSync();
    await this.pullCloudVault(user.email, { force: !alreadyActive });
    return user;
  },

  saveSession(user, options = {}) {
    const profile = {
      name: user.name,
      email: user.email,
      institution: user.institution || 'Academic Institution',
      fieldOfStudy: user.fieldOfStudy || 'General Research',
      researchInterests: user.researchInterests || 'Literature Review',
      isAuthenticated: true,
      isGuest: false,
      // Recorded so the UI can say "this device isn't syncing" rather than
      // implying a cloud backup exists when it does not.
      localOnly: !!options.localOnly
    };
    try {
      localStorage.setItem(BASE_KEYS.SESSION, JSON.stringify(profile));
    } catch (e) {
      /* ignore */
    }
    this.saveProfile(profile, true);
  },

  getSession() {
    const parsed = readJson(BASE_KEYS.SESSION, null);
    return parsed && parsed.isAuthenticated ? parsed : null;
  },

  async logoutUser() {
    // Give any pending edits a chance to reach the server before the session dies.
    try {
      if (pushScheduler.isPending()) await pushScheduler.flushNow();
    } catch (e) {
      /* leaving is more important than the last push landing */
    }
    unsubscribeFromVaultChanges();
    await apiLogout();
    try {
      localStorage.removeItem(BASE_KEYS.SESSION);
    } catch (e) {
      /* ignore */
    }
    return null;
  },

  // ------------------------------------------------------------------- SYNC

  /**
   * Restores any stored Supabase session and starts watching for auth changes.
   *
   * Call once, at app start. It is what makes three separate things work:
   * a returning user staying signed in, the Google redirect landing back here,
   * and the password-reset link opening the app in recovery mode.
   *
   * `onEvent(eventName, user)` lets the UI react. Returns an unsubscribe fn.
   */
  async initAuth(onEvent) {
    return initSyncSession(async (event, user) => {
      if (event === 'SIGNED_OUT') {
        unsubscribeFromVaultChanges();
        if (onEvent) onEvent(event, null);
        return;
      }

      // The recovery link signs the user in with a limited session whose only
      // purpose is setting a new password. Don't treat it as a normal login.
      if (event === 'PASSWORD_RECOVERY') {
        if (onEvent) onEvent(event, user);
        return;
      }

      if (user) await this.adoptSession(user);
      if (onEvent) onEvent(event, user);
    });
  },

  /**
   * Subscribes to this account's vault row so another device's commit arrives
   * as a push instead of being waited for.
   *
   * The event carries only the new version number. If it is not ahead of what
   * we last synced it is our own write echoing back, and costs nothing.
   */
  startRealtimeSync() {
    if (!canSync()) return;

    subscribeToVaultChanges((remoteVersion) => {
      if (remoteVersion && remoteVersion <= getSyncedVersion()) return;
      this.pullCloudVault(undefined, { force: true });
    });
  },

  stopRealtimeSync() {
    unsubscribeFromVaultChanges();
  },

  /** Queues a debounced push. Safe to call from anywhere, as often as you like. */
  pushCloudVaultBackground() {
    pushScheduler.schedule();
  },

  /** Forces any queued push out immediately (used before logout / on hide). */
  flushPendingSync() {
    return pushScheduler.flushNow();
  },

  /**
   * Pulls remote changes. Cheap by default: asks for the version first and
   * returns immediately when there is nothing new, without touching
   * localStorage. Pass { force: true } to skip the version check.
   */
  async pullCloudVault(emailOverride, options = {}) {
    if (!canSync()) return false;

    try {
      if (!options.force) {
        const meta = await fetchRemoteVersion();
        if (!meta) {
          notifySyncListeners('offline', this.getLastSyncTime());
          return false;
        }
        if (meta.version <= getSyncedVersion()) {
          // Up to date. This is the common path and it does no work.
          notifySyncListeners('synced', this.getLastSyncTime());
          return false;
        }
      }

      notifySyncListeners('syncing', this.getLastSyncTime());

      const remote = await fetchRemoteVault();
      if (!remote) {
        notifySyncListeners('offline', this.getLastSyncTime());
        return false;
      }

      const changed = applyRemoteVault(remote.vault);
      setSyncedVersion(remote.version || 0);
      setSyncedFingerprint(vaultFingerprint(buildLocalVault()));
      notifySyncListeners('synced', stampSyncTime());

      // If merging produced something the server hasn't seen (local-only rows,
      // or a merge result that differs from both sides), publish it.
      if (changed) pushScheduler.schedule();

      return changed;
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        await handleAuthExpired();
        return false;
      }
      notifySyncListeners('offline', this.getLastSyncTime());
      return false;
    }
  }
};

// Last-chance flush when the tab goes away, so the final edit is not lost.
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pushScheduler.isPending()) {
      pushScheduler.flushNow();
    }
  });
}

export { resourceKey };
