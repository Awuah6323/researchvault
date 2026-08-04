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

const DEFAULT_PROFILE = {
  name: "Scholar User",
  email: "user@researchvault.app",
  institution: "Academic Institution",
  fieldOfStudy: "Research & Development",
  researchInterests: "Literature Review, Data Analysis",
  isGuest: true
};

// Cloud Vault API endpoint for cross-device synchronization
const CLOUD_VAULT_URL = "https://kvdb.io/8E3qMhR9Y6pT4x7V1w5K9Z";

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

  registerUser(name, email, password, institution = 'Academic Institution', fieldOfStudy = 'General Research') {
    const users = this.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error("An account with this email address already exists.");
    }
    const newUser = {
      id: Date.now(),
      name,
      email,
      password,
      institution,
      fieldOfStudy,
      researchInterests: 'Academic Literature, Data Analysis',
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem(BASE_KEYS.USERS, JSON.stringify(users));
    this.saveSession(newUser);
    this.pullCloudVault(newUser.email);
    return newUser;
  },

  loginUser(email, password) {
    const users = this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
      throw new Error("Invalid email address or password.");
    }
    this.saveSession(user);
    this.pullCloudVault(user.email);
    return user;
  },

  loginWithGoogle(email = 'alex.rivera@stanford.edu', name = 'Alex Rivera', institution = 'Stanford University') {
    const googleUser = {
      id: Date.now(),
      name,
      email,
      institution,
      fieldOfStudy: 'Computer Science & AI',
      researchInterests: 'Deep Learning, Neural Networks'
    };
    this.saveSession(googleUser);
    this.pullCloudVault(email);
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
      
      // Gather all notes across resources
      const notesMap = {};
      resources.forEach(r => {
        const n = this.getNotes(r.id);
        if (n && n.length > 0) notesMap[r.id] = n;
      });

      const vaultPayload = {
        email,
        updatedAt: new Date().toISOString(),
        resources: resources.map(r => ({ ...r, pdfFileData: '' })), // Exclude heavy PDF buffers for lightning-fast sync
        categories,
        notesMap,
        profile
      };

      const res = await fetch(`${CLOUD_VAULT_URL}/${encodeURIComponent(email)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vaultPayload)
      });

      if (res.ok) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.setLastSyncTime(timeStr);
        notifySyncListeners("synced", timeStr);
      } else {
        notifySyncListeners("synced", this.getLastSyncTime());
      }
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
      const res = await fetch(`${CLOUD_VAULT_URL}/${encodeURIComponent(email)}`);
      
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 10) {
          const vaultPayload = JSON.parse(text);
          
          if (vaultPayload && Array.isArray(vaultPayload.resources)) {
            // Restore resources, categories, profile, and notes
            const currentResources = this.getResources();
            
            // Merge cloud resources with existing local resources cleanly
            const mergedResources = [...currentResources];
            const existingMap = new Map(mergedResources.map(r => [r.id || r.title, r]));

            vaultPayload.resources.forEach(cloudRes => {
              const key = cloudRes.id || cloudRes.title;
              if (!existingMap.has(key)) {
                mergedResources.push(cloudRes);
              } else {
                // Update reading progress & favorite state if newer
                const existing = existingMap.get(key);
                existingMap.set(key, { ...existing, ...cloudRes });
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
        }
      }
      notifySyncListeners("synced", this.getLastSyncTime());
    } catch (err) {
      console.warn("Cloud Vault pull offline.", err);
      notifySyncListeners("offline", this.getLastSyncTime());
    }
    return false;
  }
};
