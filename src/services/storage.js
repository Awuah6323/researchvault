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
  { id: 1, name: "Computer Science", description: "Algorithms, Systems, and Computing", icon: "Code2", count: 3 },
  { id: 2, name: "Artificial Intelligence", description: "Machine Learning, LLMs, and Robotics", icon: "Bot", count: 4 },
  { id: 3, name: "Data Science", description: "Big Data Analytics & Statistics", icon: "BarChart3", count: 2 },
  { id: 4, name: "Cybersecurity", description: "Cryptography, Network & System Security", icon: "Shield", count: 2 },
  { id: 5, name: "Cloud Computing", description: "Distributed Systems & Cloud Architectures", icon: "Cloud", count: 2 },
  { id: 6, name: "Software Engineering", description: "Architecture, Design Patterns & DevOps", icon: "Cpu", count: 1 },
  { id: 7, name: "Research Methods", description: "Literature Review & Quantitative Analysis", icon: "BookOpen", count: 2 },
  { id: 8, name: "Medicine & Healthcare", description: "Bio-Informatics & Public Health", icon: "Activity", count: 1 }
];

const DEFAULT_RESOURCES = [
  {
    id: 101,
    title: "Attention Is All You Need",
    authors: "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit",
    abstractText: "We propose the Transformer, a novel neural network architecture based entirely on attention mechanisms, discarding recurrence and convolutions entirely. Experiments show superior translation quality and parallelizability.",
    publicationYear: 2021,
    journal: "Advances in Neural Information Processing Systems (NeurIPS)",
    doi: "10.48550/arXiv.1706.03762",
    sourceUrl: "https://arxiv.org/abs/1706.03762",
    downloadUrl: "https://arxiv.org/pdf/1706.03762.pdf",
    resourceType: "Research Paper",
    category: "Artificial Intelligence",
    openAccess: true,
    isFavorite: true,
    downloadStatus: "COMPLETED",
    readingProgressPercent: 65,
    lastPageRead: 4,
    citationCount: 112000,
    addedAt: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: 102,
    title: "Deep Learning for Computer Vision: A Comprehensive Survey",
    authors: "Yann LeCun, Yoshua Bengio, Geoffrey Hinton",
    abstractText: "Deep learning allows computational models that are composed of multiple processing layers to learn representations of data with multiple levels of abstraction.",
    publicationYear: 2020,
    journal: "Nature Journal of Science",
    doi: "10.1038/nature14539",
    sourceUrl: "https://www.nature.com/articles/nature14539",
    downloadUrl: "",
    resourceType: "Journal Article",
    category: "Artificial Intelligence",
    openAccess: true,
    isFavorite: true,
    downloadStatus: "COMPLETED",
    readingProgressPercent: 40,
    lastPageRead: 2,
    citationCount: 85000,
    addedAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 103,
    title: "Zero Trust Security Architectures in Modern Cloud Deployments",
    authors: "Dr. Elena Rostova, Marcus Vance",
    abstractText: "An empirical evaluation of zero trust principles, micro-segmentation, and identity-aware proxying across hybrid cloud infrastructure.",
    publicationYear: 2023,
    journal: "IEEE Transactions on Information Forensics and Security",
    doi: "10.1109/TIFS.2023.32456",
    sourceUrl: "https://ieee.org",
    downloadUrl: "",
    resourceType: "Journal Article",
    category: "Cybersecurity",
    openAccess: false,
    isFavorite: false,
    downloadStatus: "NOT_DOWNLOADED",
    readingProgressPercent: 0,
    lastPageRead: 1,
    citationCount: 142,
    addedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 104,
    title: "A Qualitative Investigation into Academic Literature Synthesis Methods",
    authors: "Prof. Sarah Jenkins",
    abstractText: "Dissertation studying structured methodology for systematic reviews, citation indexing, and thesis organization among postgraduate researchers.",
    publicationYear: 2022,
    journal: "Stanford University Doctoral Dissertations",
    doi: "10.1109/THESIS.2022.091",
    sourceUrl: "https://stanford.edu",
    downloadUrl: "",
    resourceType: "Thesis",
    category: "Research Methods",
    openAccess: true,
    isFavorite: true,
    downloadStatus: "COMPLETED",
    readingProgressPercent: 85,
    lastPageRead: 12,
    citationCount: 68,
    addedAt: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: 105,
    title: "Designing High-Throughput Distributed Database Engines",
    authors: "Michael Stonebraker, Andy Pavlo",
    abstractText: "A technical overview of modern MVCC concurrency control, log-structured merge trees, and distributed consensus protocols in cloud databases.",
    publicationYear: 2024,
    journal: "ACM SIGMOD International Conference on Management of Data",
    doi: "10.1145/3588967.358899",
    sourceUrl: "https://acm.org",
    downloadUrl: "",
    resourceType: "Book",
    category: "Data Science",
    openAccess: false,
    isFavorite: false,
    downloadStatus: "NOT_DOWNLOADED",
    readingProgressPercent: 15,
    lastPageRead: 1,
    citationCount: 310,
    addedAt: new Date().toISOString()
  }
];

const DEFAULT_PROFILE = {
  name: "Alex Rivera",
  email: "alex.rivera@stanford.edu",
  institution: "Stanford University",
  fieldOfStudy: "Computer Science & AI",
  researchInterests: "Deep Learning, Natural Language Processing, Neural Networks",
  isGuest: false
};

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
    localStorage.setItem(KEYS.RESOURCES, JSON.stringify(resources));
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
    return localStorage.getItem(KEYS.THEME) || 'scholarly-light';
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

  saveSession(user) {
    const profile = {
      name: user.name,
      email: user.email,
      institution: user.institution || 'Academic Institution',
      fieldOfStudy: user.fieldOfStudy || 'General Research',
      researchInterests: user.researchInterests || 'Literature Review',
      isGuest: false
    };
    localStorage.setItem(KEYS.SESSION, JSON.stringify(profile));
    this.saveProfile(profile);
  },

  getSession() {
    const data = localStorage.getItem(KEYS.SESSION);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  logoutUser() {
    localStorage.removeItem(KEYS.SESSION);
    this.saveProfile(DEFAULT_PROFILE);
    return DEFAULT_PROFILE;
  }
};



