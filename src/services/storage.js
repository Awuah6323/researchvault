// LocalStorage persistence service for ResearchVault

const KEYS = {
  RESOURCES: 'researchvault_resources',
  CATEGORIES: 'researchvault_categories',
  NOTES: 'researchvault_notes',
  BOOKMARKS: 'researchvault_bookmarks',
  PROFILE: 'researchvault_profile',
  THEME: 'researchvault_theme',
  USERS: 'researchvault_users',
  SESSION: 'researchvault_session'
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

// Purge legacy sample data to guarantee a 100% clean slate and mandatory AuthGate
if (typeof window !== 'undefined' && !localStorage.getItem('researchvault_v3_clean')) {
  localStorage.removeItem(KEYS.RESOURCES);
  localStorage.removeItem(KEYS.SESSION);
  localStorage.removeItem(KEYS.PROFILE);
  localStorage.setItem('researchvault_v3_clean', 'true');
}

export const storage = {
  getResources() {
    const data = localStorage.getItem(KEYS.RESOURCES);
    if (!data) {
      localStorage.setItem(KEYS.RESOURCES, JSON.stringify(DEFAULT_RESOURCES));
      return DEFAULT_RESOURCES;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Corrupted resources in localStorage. Resetting to default.", e);
      localStorage.setItem(KEYS.RESOURCES, JSON.stringify(DEFAULT_RESOURCES));
      return DEFAULT_RESOURCES;
    }
  },

  saveResources(resources) {
    try {
      localStorage.setItem(KEYS.RESOURCES, JSON.stringify(resources));
    } catch (e) {
      console.warn("LocalStorage quota limit reached. Saving lightweight paper metadata.", e);
      // Fallback for large PDF files (> 2-3MB) to prevent quota crashes
      const lightResources = resources.map(r => ({
        ...r,
        pdfFileData: (r.pdfFileData && r.pdfFileData.length > 500000) ? '' : r.pdfFileData
      }));
      try {
        localStorage.setItem(KEYS.RESOURCES, JSON.stringify(lightResources));
      } catch (err) {
        console.error("Unable to save to localStorage:", err);
      }
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
    const data = localStorage.getItem(KEYS.CATEGORIES);
    if (!data) {
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Corrupted categories in localStorage. Resetting to default.", e);
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
  },

  addCategory(category) {
    const list = this.getCategories();
    const newCat = { ...category, id: Date.now(), count: 0 };
    list.push(newCat);
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(list));
    return list;
  },

  getProfile() {
    const data = localStorage.getItem(KEYS.PROFILE);
    if (!data) return DEFAULT_PROFILE;
    try {
      return JSON.parse(data);
    } catch (e) {
      return DEFAULT_PROFILE;
    }
  },

  saveProfile(profile) {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
  },

  getTheme() {
    const saved = localStorage.getItem(KEYS.THEME);
    if (!saved || saved === 'dark-vault') return 'warm-sepia';
    return saved;
  },

  saveTheme(theme) {
    localStorage.setItem(KEYS.THEME, theme);
  },

  getNotes(resourceId) {
    const data = localStorage.getItem(`${KEYS.NOTES}_${resourceId}`);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  },

  addNote(resourceId, noteText, pageNumber) {
    const notes = this.getNotes(resourceId);
    const newNote = { id: Date.now(), noteText, pageNumber, createdAt: new Date().toLocaleDateString() };
    notes.unshift(newNote);
    localStorage.setItem(`${KEYS.NOTES}_${resourceId}`, JSON.stringify(notes));
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
    const data = localStorage.getItem(KEYS.USERS);
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
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    this.saveSession(newUser);
    return newUser;
  },

  loginUser(email, password) {
    const users = this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
      throw new Error("Invalid email address or password.");
    }
    this.saveSession(user);
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
    localStorage.setItem(KEYS.SESSION, JSON.stringify(profile));
    this.saveProfile(profile);
  },

  getSession() {
    const data = localStorage.getItem(KEYS.SESSION);
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
    localStorage.removeItem(KEYS.SESSION);
    localStorage.removeItem(KEYS.PROFILE);
    return null;
  }
};



