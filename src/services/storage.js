// Account-Scoped LocalStorage & Real-Time Cloud Vault Sync Engine for ResearchVault

const BASE_KEYS = {
  RESOURCES: 'researchvault_resources',
  CATEGORIES: 'researchvault_categories',
  NOTES: 'researchvault_notes',
  PROFILE: 'researchvault_profile',
  THEME: 'researchvault_theme',
  USERS: 'researchvault_users',
  SESSION: 'researchvault_session',
  LAST_SYNC: 'researchvault_last_sync'
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

// Mandatory AuthGate: No unauthenticated default profiles permitted
const DEFAULT_PROFILE = null;

// Purge legacy guest data to guarantee mandatory AuthGate check for all visitors
if (typeof window !== 'undefined' && !localStorage.getItem('researchvault_v4_auth_strict')) {
  localStorage.removeItem(BASE_KEYS.SESSION);
  localStorage.removeItem(BASE_KEYS.PROFILE);
  localStorage.setItem('researchvault_v4_auth_strict', 'true');
}

const REST_FALLBACK_BASE = "https://api.restful-api.dev/objects";
const REST_INDEX_ID = "ff8081819f7e10ae019fec4131ec1e33";

async function callSyncApi(method, key, data = null) {
  const normKey = String(key).toLowerCase().trim();

  // Primary: Call Vercel serverless /api/sync handler
  try {
    if (method === 'GET') {
      const res = await fetch(`/api/sync?key=${encodeURIComponent(normKey)}`);
      if (res.ok) {
        const json = await res.json();
        if (json && !json.error) return json;
      }
    } else {
      const res = await fetch(`/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: normKey, data })
      });
      if (res.ok) return true;
    }
  } catch (e) {}

  // Fallback: Direct REST API storage for static/dev server
  try {
    if (method === 'GET') {
      const idxRes = await fetch(`${REST_FALLBACK_BASE}/${REST_INDEX_ID}`);
      if (idxRes.ok) {
        const idxJson = await idxRes.json();
        const objId = (idxJson.data || {})[normKey];
        if (objId) {
          const itemRes = await fetch(`${REST_FALLBACK_BASE}/${objId}`);
          if (itemRes.ok) {
            const itemJson = await itemRes.json();
            return itemJson.data || null;
          }
        }
      }
    } else {
      const idxRes = await fetch(`${REST_FALLBACK_BASE}/${REST_INDEX_ID}`);
      let masterIndex = {};
      if (idxRes.ok) {
        const idxJson = await idxRes.json();
        masterIndex = idxJson.data || {};
      }

      let targetId = masterIndex[normKey];
      if (targetId) {
        await fetch(`${REST_FALLBACK_BASE}/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: normKey, data })
        });
      } else {
        const createRes = await fetch(REST_FALLBACK_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: normKey, data })
        });
        if (createRes.ok) {
          const createJson = await createRes.json();
          if (createJson && createJson.id) {
            masterIndex[normKey] = createJson.id;
            await fetch(`${REST_FALLBACK_BASE}/${REST_INDEX_ID}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'master_vault_index', data: masterIndex })
            });
          }
        }
      }
      return true;
    }
  } catch (err) {}

  return null;
}

// Event listeners for sync state updates
let syncListeners = [];
let currentSyncState = "synced"; // "synced", "syncing", "offline", "error"

function notifySyncListeners(state, timestamp) {
  currentSyncState = state;
  syncListeners.forEach(fn => fn(state, timestamp));
}

function getActiveUserEmail() {
  try {
    const session = localStorage.getItem(BASE_KEYS.SESSION);
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed && parsed.email) return parsed.email.toLowerCase().trim();
    }
  } catch (e) {}
  return "guest_user";
}

function getScopedKey(baseKey) {
  const email = getActiveUserEmail();
  return `${baseKey}_${encodeURIComponent(email)}`;
}

// ---------------------------------------------------------------------------
// PASSWORD HASHING
//
// The auth record has to be pushed to a public, unauthenticated kvdb.io
// bucket so a second device can verify credentials it has never seen
// locally. Storing the plaintext password there would mean anyone who
// knows/guesses a user's email can read their password directly. Hashing
// with a per-user random salt keeps the plaintext password off the wire
// and off the public bucket entirely.
//
// IMPORTANT CAVEAT: this is a meaningful improvement over plaintext, but a
// client-side hash written to a public, unauthenticated store is still not
// equivalent to real backend authentication — anyone with the bucket URL
// can read the hash+salt and run an offline dictionary/brute-force attack
// against it with no rate limiting. Treat this as a stop-gap for a
// prototype, not something to keep once real users' accounts matter. The
// durable fix is a proper auth backend (Firebase Auth, Supabase Auth,
// Auth0, or your own server with bcrypt/argon2 + rate limiting) sitting
// behind an endpoint you control, not a public KV store.
// ---------------------------------------------------------------------------

function getCrypto() {
  if (typeof window !== 'undefined' && window.crypto) return window.crypto;
  if (typeof crypto !== 'undefined') return crypto;
  throw new Error("Web Crypto API is not available in this environment.");
}

function generateSalt() {
  const bytes = new Uint8Array(16);
  getCrypto().getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}`);
  const hashBuffer = await getCrypto().subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, salt, expectedHash) {
  const computed = await hashPassword(password, salt);
  return computed === expectedHash;
}

export const storage = {
  subscribeSyncState(callback) {
    syncListeners.push(callback);
    callback(currentSyncState, this.getLastSyncTime());
    return () => {
      syncListeners = syncListeners.filter(fn => fn !== callback);
    };
  },

  getSyncState() {
    return currentSyncState;
  },

  getLastSyncTime() {
    return localStorage.getItem(getScopedKey(BASE_KEYS.LAST_SYNC)) || "Not synced yet";
  },

  setLastSyncTime(timestampStr) {
    localStorage.setItem(getScopedKey(BASE_KEYS.LAST_SYNC), timestampStr);
  },

  getResources() {
    const key = getScopedKey(BASE_KEYS.RESOURCES);
    const data = localStorage.getItem(key);
    if (!data) return DEFAULT_RESOURCES;
    try {
      return JSON.parse(data);
    } catch (e) {
      return DEFAULT_RESOURCES;
    }
  },

  saveResources(resources, skipCloudPush = false) {
    const key = getScopedKey(BASE_KEYS.RESOURCES);
    try {
      localStorage.setItem(key, JSON.stringify(resources));
    } catch (e) {
      // Fallback for large files to avoid quota limits
      const lightResources = resources.map(r => ({
        ...r,
        pdfFileData: (r.pdfFileData && r.pdfFileData.length > 400000) ? '' : r.pdfFileData
      }));
      localStorage.setItem(key, JSON.stringify(lightResources));
    }

    if (!skipCloudPush) {
      this.pushCloudVaultBackground();
    }
  },

  addResource(resource) {
    const list = this.getResources();
    const newDoc = {
      ...resource,
      id: Date.now(),
      addedAt: new Date().toISOString(),
      downloadStatus: resource.downloadStatus || 'COMPLETED',
      readingProgressPercent: resource.readingProgressPercent || 0,
      lastPageRead: 1
    };
    list.unshift(newDoc);
    this.saveResources(list);
    return newDoc;
  },

  toggleFavorite(id) {
    const list = this.getResources().map(r => r.id === id ? { ...r, isFavorite: !r.isFavorite } : r);
    this.saveResources(list);
    return list;
  },

  deleteResource(id) {
    const list = this.getResources().filter(r => r.id !== id);
    this.saveResources(list);
    return list;
  },

  updateReadingProgress(id, progress, page) {
    const list = this.getResources().map(r => r.id === id ? { ...r, readingProgressPercent: progress, lastPageRead: page } : r);
    this.saveResources(list);
    return list;
  },

  getCategories() {
    const key = getScopedKey(BASE_KEYS.CATEGORIES);
    const data = localStorage.getItem(key);
    if (!data) return DEFAULT_CATEGORIES;
    try {
      return JSON.parse(data);
    } catch (e) {
      return DEFAULT_CATEGORIES;
    }
  },

  saveCategories(categories, skipCloudPush = false) {
    const key = getScopedKey(BASE_KEYS.CATEGORIES);
    localStorage.setItem(key, JSON.stringify(categories));
    if (!skipCloudPush) {
      this.pushCloudVaultBackground();
    }
  },

  addCategory(category) {
    const list = this.getCategories();
    const newCat = { ...category, id: Date.now(), count: 0 };
    list.push(newCat);
    this.saveCategories(list);
    return list;
  },

  getProfile() {
    const key = getScopedKey(BASE_KEYS.PROFILE);
    const data = localStorage.getItem(key);
    if (!data) return DEFAULT_PROFILE;
    try {
      return JSON.parse(data);
    } catch (e) {
      return DEFAULT_PROFILE;
    }
  },

  saveProfile(profile, skipCloudPush = false) {
    const key = getScopedKey(BASE_KEYS.PROFILE);
    localStorage.setItem(key, JSON.stringify(profile));
    if (!skipCloudPush) {
      this.pushCloudVaultBackground();
    }
  },

  getTheme() {
    const saved = localStorage.getItem(BASE_KEYS.THEME);
    if (!saved || saved === 'dark-vault') return 'warm-sepia';
    return saved;
  },

  saveTheme(theme) {
    localStorage.setItem(BASE_KEYS.THEME, theme);
  },

  getNotes(resourceId) {
    const key = `${getScopedKey(BASE_KEYS.NOTES)}_${resourceId}`;
    const data = localStorage.getItem(key);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  },

  saveNotes(resourceId, notesList, skipCloudPush = false) {
    const key = `${getScopedKey(BASE_KEYS.NOTES)}_${resourceId}`;
    localStorage.setItem(key, JSON.stringify(notesList));
    if (!skipCloudPush) {
      this.pushCloudVaultBackground();
    }
  },

  addNote(resourceId, noteText, pageNumber) {
    const notes = this.getNotes(resourceId);
    const newNote = { id: Date.now(), noteText, pageNumber, createdAt: new Date().toLocaleDateString() };
    notes.unshift(newNote);
    this.saveNotes(resourceId, notes);
    return notes;
  },

  getAllNotesAcrossLibrary() {
    const resources = this.getResources();
    const allNotes = [];
    resources.forEach(r => {
      const notes = this.getNotes(r.id);
      notes.forEach(n => {
        allNotes.push({
          ...n,
          resourceId: r.id,
          paperTitle: r.title,
          paperAuthors: r.authors
        });
      });
    });
    return allNotes.sort((a, b) => b.id - a.id);
  },

  importBackupData(importedResources, overwrite = false) {
    if (!Array.isArray(importedResources)) {
      throw new Error("Invalid backup data format. Expected an array of papers.");
    }
    const current = overwrite ? [] : this.getResources();
    const existingIds = new Set(current.map(r => r.id));
    const newItems = importedResources.filter(r => r.title && !existingIds.has(r.id));
    const updated = [...newItems, ...current];
    this.saveResources(updated);
    return updated;
  },

  getUsers() {
    const data = localStorage.getItem(BASE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },

  cacheUserLocally(user) {
    const users = this.getUsers();
    const withoutExisting = users.filter(u => u.email.toLowerCase() !== user.email.toLowerCase());
    withoutExisting.push(user);
    localStorage.setItem(BASE_KEYS.USERS, JSON.stringify(withoutExisting));
  },

  // -------------------------------------------------------------------------
  // CLOUD AUTH RECORD
  //
  // registerUser writes this; loginUser reads it when the account isn't
  // known on the current device yet. This is what makes "log in on a
  // device you've never registered on" work at all — without it, an
  // account only ever existed in the localStorage of the device that
  // created it.
  // -------------------------------------------------------------------------

  async pushUserAuthRecord(user) {
    try {
      const key = `auth_${user.email.toLowerCase().trim()}`;
      await callSyncApi('POST', key, {
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        salt: user.salt,
        institution: user.institution,
        fieldOfStudy: user.fieldOfStudy,
        researchInterests: user.researchInterests,
        createdAt: user.createdAt
      });
    } catch (err) {
      console.warn("Could not publish auth record to Cloud Vault.", err);
    }
  },

  async fetchUserAuthRecord(email) {
    try {
      const key = `auth_${email.toLowerCase().trim()}`;
      const data = await callSyncApi('GET', key);
      if (data && data.email && data.passwordHash && data.salt) return data;
      return null;
    } catch (err) {
      return null;
    }
  },

  // NOTE: registerUser/loginUser/loginWithGoogle are async and AWAIT the
  // cloud pull before resolving. Callers must `await` them and re-read
  // storage.getResources()/getCategories()/getProfile() afterward to
  // populate the UI.

  async registerUser(name, email, password, institution = 'Academic Institution', fieldOfStudy = 'General Research') {
    const normalizedEmail = email.toLowerCase().trim();

    const existingLocal = this.getUsers().find(u => u.email.toLowerCase() === normalizedEmail);
    if (existingLocal) {
      throw new Error("An account with this email address already exists.");
    }

    const existingCloud = await this.fetchUserAuthRecord(normalizedEmail);
    if (existingCloud) {
      throw new Error("An account with this email address already exists.");
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const newUser = {
      id: Date.now(),
      name,
      email: normalizedEmail,
      passwordHash,
      salt,
      institution,
      fieldOfStudy,
      researchInterests: 'Academic Literature, Data Analysis',
      createdAt: new Date().toISOString()
    };

    this.cacheUserLocally(newUser);
    await this.pushUserAuthRecord(newUser);

    this.saveSession(newUser);
    await this.pullCloudVault(newUser.email);
    return newUser;
  },

  async loginUser(email, password) {
    const normalizedEmail = email.toLowerCase().trim();
    let user = this.getUsers().find(u => u.email.toLowerCase() === normalizedEmail);

    if (user) {
      const valid = await verifyPassword(password, user.salt, user.passwordHash);
      if (!valid) user = undefined;
    }

    if (!user) {
      // Not known on this device — check whether the account exists in
      // the cloud (i.e. was registered on a different device).
      const cloudUser = await this.fetchUserAuthRecord(normalizedEmail);
      if (cloudUser) {
        const valid = await verifyPassword(password, cloudUser.salt, cloudUser.passwordHash);
        if (valid) {
          user = { id: Date.now(), ...cloudUser, email: normalizedEmail };
          this.cacheUserLocally(user);
        }
      }
    }

    if (!user) {
      throw new Error("Invalid email address or password.");
    }

    this.saveSession(user);
    await this.pullCloudVault(user.email);
    return user;
  },

  async loginWithGoogle(email, name, institution = 'Google Verified Account', fieldOfStudy = 'Academic Research') {
    if (!email) throw new Error("Google login requires a valid email address.");
    const googleUser = {
      id: Date.now(),
      name: name || email.split('@')[0],
      email: email.toLowerCase().trim(),
      institution,
      fieldOfStudy,
      researchInterests: 'Academic Literature, Data Analysis'
    };
    this.saveSession(googleUser);
    await this.pullCloudVault(googleUser.email);
    return googleUser;
  },

  saveSession(user) {
    const profile = {
      name: user.name,
      email: user.email,
      institution: user.institution || 'Academic Institution',
      fieldOfStudy: user.fieldOfStudy || 'General Research',
      researchInterests: user.researchInterests || 'Literature Review',
      isAuthenticated: true,
      isGuest: false
    };
    localStorage.setItem(BASE_KEYS.SESSION, JSON.stringify(profile));
    this.saveProfile(profile, true);
  },

  getSession() {
    const data = localStorage.getItem(BASE_KEYS.SESSION);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return parsed && parsed.isAuthenticated ? parsed : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  logoutUser() {
    localStorage.removeItem(BASE_KEYS.SESSION);
    return null;
  },

  // =========================================================================
  // REAL-TIME CROSS-DEVICE CLOUD VAULT ENGINE
  // =========================================================================

  async pushCloudVaultBackground() {
    const email = getActiveUserEmail();
    if (!email || email === "guest_user") return;

    try {
      notifySyncListeners("syncing", this.getLastSyncTime());
      const resources = this.getResources();
      const categories = this.getCategories();
      const profile = this.getProfile();
      
      const notesMap = {};
      resources.forEach(r => {
        const n = this.getNotes(r.id);
        if (n && n.length > 0) notesMap[r.id] = n;
      });

      const vaultPayload = {
        email,
        updatedAt: new Date().toISOString(),
        resources: resources.map(r => ({
          ...r,
          // Exclude huge PDF base64 buffers to ensure payload stays under network limits
          pdfFileData: (r.pdfFileData && r.pdfFileData.length > 100000) ? '' : (r.pdfFileData || '')
        })),
        categories,
        notesMap,
        profile
      };

      const key = `vault_${email.toLowerCase().trim()}`;
      await callSyncApi('POST', key, vaultPayload);

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.setLastSyncTime(timeStr);
      notifySyncListeners("synced", timeStr);
    } catch (err) {
      console.warn("Cloud Vault sync currently offline or disconnected.", err);
      notifySyncListeners("offline", this.getLastSyncTime());
    }
  },

  async pullCloudVault(emailOverride) {
    const email = emailOverride || getActiveUserEmail();
    if (!email || email === "guest_user") return false;

    try {
      notifySyncListeners("syncing", this.getLastSyncTime());
      const key = `vault_${email.toLowerCase().trim()}`;
      const vaultPayload = await callSyncApi('GET', key);

      if (vaultPayload && Array.isArray(vaultPayload.resources)) {
        const currentResources = this.getResources();
        const mergedResources = [...currentResources];
        const indexByKey = new Map(
          mergedResources.map((r, idx) => [r.id || r.title, idx])
        );

        vaultPayload.resources.forEach(cloudRes => {
          const itemKey = cloudRes.id || cloudRes.title;
          if (!indexByKey.has(itemKey)) {
            indexByKey.set(itemKey, mergedResources.length);
            mergedResources.push(cloudRes);
          } else {
            const idx = indexByKey.get(itemKey);
            const existingPdf = mergedResources[idx].pdfFileData;
            mergedResources[idx] = {
              ...mergedResources[idx],
              ...cloudRes,
              pdfFileData: cloudRes.pdfFileData || existingPdf || ''
            };
          }
        });

        this.saveResources(mergedResources, true);

        if (vaultPayload.categories && Array.isArray(vaultPayload.categories)) {
          this.saveCategories(vaultPayload.categories, true);
        }

        if (vaultPayload.notesMap && typeof vaultPayload.notesMap === 'object') {
          Object.keys(vaultPayload.notesMap).forEach(resId => {
            this.saveNotes(resId, vaultPayload.notesMap[resId], true);
          });
        }

        if (vaultPayload.profile) {
          this.saveProfile({ ...this.getProfile(), ...vaultPayload.profile }, true);
        }

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.setLastSyncTime(timeStr);
        notifySyncListeners("synced", timeStr);
        return true;
      }
      notifySyncListeners("synced", this.getLastSyncTime());
    } catch (err) {
      console.warn("Cloud Vault pull offline.", err);
      notifySyncListeners("offline", this.getLastSyncTime());
    }
    return false;
  }
};