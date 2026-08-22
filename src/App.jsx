import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ResourceCard from './components/ResourceCard';
import CitationModal from './components/CitationModal';
import AiSummarizerModal from './components/AiSummarizerModal';
import AddResourceModal from './components/AddResourceModal';
import AuthModal from './components/AuthModal';
import BottomNav from './components/BottomNav';
import MobileDrawer from './components/MobileDrawer';
import InstallPwaModal from './components/InstallPwaModal';
import UserGuideModal from './components/UserGuideModal';

import HomeDashboard from './pages/HomeDashboard';
import AcademicSearch from './pages/AcademicSearch';
import MyLibrary from './pages/MyLibrary';
import Categories from './pages/Categories';
import DocumentReader from './pages/DocumentReader';
import LiteratureSynthesis from './pages/LiteratureSynthesis';
import ProfileSettings from './pages/ProfileSettings';
import NotesManager from './pages/NotesManager';
import AiChat from './pages/AiChat';
import AuthPage from './pages/AuthPage';
import PasswordResetModal from './components/PasswordResetModal';

import { storage } from './services/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const hash = window.location.hash ? window.location.hash.replace('#', '') : null;
      if (hash && ['home', 'search', 'library', 'categories', 'aichat', 'notes', 'synthesis', 'profile'].includes(hash)) {
        return hash;
      }
      const saved = localStorage.getItem('researchvault_active_tab');
      if (saved && ['home', 'search', 'library', 'categories', 'aichat', 'notes', 'synthesis', 'profile'].includes(saved)) {
        return saved;
      }
    } catch (e) {}
    return 'home';
  });

  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [userProfile, setUserProfile] = useState(() => storage.getSession());
  const [theme, setTheme] = useState('sepia');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Reader Active State
  const [activeReaderResource, setActiveReaderResource] = useState(null);
  const [citationModalResource, setCitationModalResource] = useState(null);
  const [aiModalResource, setAiModalResource] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserGuideModal, setShowUserGuideModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Set when the app is opened from a password-reset email, which signs the
  // user in with a session whose only purpose is choosing a new password.
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const refreshAppData = () => {
    setResources(storage.getResources());
    setCategories(storage.getCategories());
  };

  const handleLoginSuccess = (profile) => {
    const session = profile || storage.getSession();
    setUserProfile(session);
    refreshAppData();

    // Auto-trigger Onboarding Carousel Modal for first-time logins unless explicitly opted out
    try {
      const neverShow = localStorage.getItem('researchvault_never_show_onboarding');
      const hasSeen = localStorage.getItem('researchvault_has_seen_onboarding');
      if (!neverShow && !hasSeen) {
        setShowUserGuideModal(true);
      }
    } catch (e) {
      setShowUserGuideModal(true);
    }
  };

  useEffect(() => {
    refreshAppData();
    const session = storage.getSession();
    setUserProfile(session);
    const savedTheme = storage.getTheme();
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Initialize history state on app startup
    if (!window.history.state) {
      window.history.replaceState({ tab: 'home' }, '', '#home');
    }

    // Auto-trigger Onboarding Carousel Modal for first-time visitors unless opted out
    try {
      const neverShowOnboarding = localStorage.getItem('researchvault_never_show_onboarding');
      const hasSeenOnboarding = localStorage.getItem('researchvault_has_seen_onboarding');
      if (!neverShowOnboarding && !hasSeenOnboarding) {
        setShowUserGuideModal(true);
      }
    } catch (e) {}

    // Subscribe to cloud sync state changes to auto-refresh data
    const unsubscribeSync = storage.subscribeSyncState((state) => {
      if (state === 'synced') {
        refreshAppData();
      }
    });

    // Initial Cloud Vault pull for logged-in account
    if (session && session.email) {
      storage.pullCloudVault(session.email).then(() => {
        refreshAppData();
      });
    }

    const pullIfActive = () => {
      // Don't sync a backgrounded tab: on mobile this was waking the radio
      // every 15s and draining battery for a screen nobody was looking at.
      if (document.visibilityState !== 'visible') return;
      const activeSession = storage.getSession();
      if (!activeSession || !activeSession.email) return;
      storage.pullCloudVault(activeSession.email).then((updated) => {
        if (updated) {
          refreshAppData();
          setUserProfile(storage.getSession());
        }
      });
    };

    // Auto-refresh from Cloud Vault when switching focus back to phone/PC
    const handleFocus = () => {
      refreshAppData();
      pullIfActive();
    };

    /**
     * Restores a stored Supabase session and watches for auth changes.
     *
     * Three things depend on this: a returning visitor staying signed in, the
     * Google redirect landing back here with a session in the URL, and the
     * password-reset link opening the app in recovery mode.
     */
    let disposeAuth = () => {};
    storage
      .initAuth((event, user) => {
        if (event === 'PASSWORD_RECOVERY') {
          setShowPasswordReset(true);
          return;
        }
        if (event === 'SIGNED_OUT') {
          setUserProfile(null);
          return;
        }
        if (user) {
          setUserProfile(storage.getSession());
          refreshAppData();
        }
      })
      .then((dispose) => {
        disposeAuth = dispose || (() => {});
        // Realtime needs a session, so it can only start once one exists.
        storage.startRealtimeSync();
      });

    // Safety net, not the primary mechanism. Another device's change arrives
    // over the realtime subscription within about a second; this only covers a
    // socket that dropped without us noticing, so it can be slow and cheap.
    const autoSyncInterval = setInterval(pullIfActive, 180000);

    // Sync immediately when the tab becomes visible again rather than waiting
    // out the remainder of the interval.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') pullIfActive();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Detect if running in standalone PWA mode
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    // Listen for browser PWA installation event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(autoSyncInterval);
      storage.stopRealtimeSync();
      disposeAuth();
      unsubscribeSync();
    };
  }, []);

  // Close all open modals & drawers
  const closeAllModals = () => {
    setIsMobileMenuOpen(false);
    setActiveReaderResource(null);
    setCitationModalResource(null);
    setAiModalResource(null);
    setShowAddModal(false);
    setShowAuthModal(false);
    setShowUserGuideModal(false);
  };

  // Hardware Back Button & Browser Popstate Integration
  useEffect(() => {
    const handlePopState = (event) => {
      const hasOpenModal = 
        isMobileMenuOpen || 
        !!activeReaderResource || 
        !!citationModalResource || 
        !!aiModalResource || 
        showAddModal || 
        showAuthModal ||
        showUserGuideModal;

      if (hasOpenModal) {
        closeAllModals();
        return;
      }

      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else if (window.location.hash) {
        const hashTab = window.location.hash.replace('#', '');
        if (hashTab) setActiveTab(hashTab);
      } else {
        setActiveTab('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMobileMenuOpen, activeReaderResource, citationModalResource, aiModalResource, showAddModal, showAuthModal]);

  // Tab navigation with history pushState
  const handleNavigate = (tabName) => {
    if (tabName !== activeTab) {
      window.history.pushState({ tab: tabName }, '', `#${tabName}`);
      setActiveTab(tabName);
      try {
        localStorage.setItem('researchvault_active_tab', tabName);
      } catch (e) {}
    }
    closeAllModals();
  };

  // Open modal with history pushState
  const handleOpenModal = (setter, value = true) => {
    window.history.pushState({ tab: activeTab, isModal: true }, '');
    setter(value);
  };

  const handleSetTheme = (newTheme) => {
    setTheme(newTheme);
    storage.saveTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleToggleFavorite = (id) => {
    const updated = storage.toggleFavorite(id);
    setResources(updated);
  };

  const handleDeleteResource = (id) => {
    const updated = storage.deleteResource(id);
    setResources(updated);
    if (activeReaderResource && String(activeReaderResource.id) === String(id)) {
      setActiveReaderResource(null);
    }
    if (citationModalResource && String(citationModalResource.id) === String(id)) {
      setCitationModalResource(null);
    }
    if (aiModalResource && String(aiModalResource.id) === String(id)) {
      setAiModalResource(null);
    }
  };

  const handleImportBackup = (importedList) => {
    const updated = storage.importBackupData(importedList);
    setResources(updated);
  };

  const handleAddResource = (newRes) => {
    const created = storage.addResource(newRes);
    setResources(storage.getResources());
  };

  const handleAddCategory = (newCat) => {
    const updated = storage.addCategory(newCat);
    setCategories(updated);
  };

  const handleSaveProfile = (updatedProfile) => {
    storage.saveProfile(updatedProfile);
    setUserProfile(updatedProfile);
  };

  const handleSaveNote = (resourceId, noteText, pageNumber) => {
    storage.addNote(resourceId, noteText, pageNumber);
  };

  const handleLogout = () => {
    storage.logoutUser();
    setUserProfile(null);
  };

  // Mandatory Authentication Gate Check
  if (!userProfile || !userProfile.isAuthenticated) {
    return (
      <AuthPage
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main)',
      color: 'var(--text-main)'
    }}>
      {/* First tab stop: lets keyboard users jump the nav on every page. */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <Navbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentTheme={theme}
        setTheme={handleSetTheme}
        userProfile={userProfile}
        onNavigate={handleNavigate}
        onOpenAuthModal={() => handleOpenModal(setShowAuthModal, true)}
        onLogout={handleLogout}
        onOpenMobileMenu={() => handleOpenModal(setIsMobileMenuOpen, true)}
        onOpenInstallPwa={() => handleOpenModal(setShowInstallModal, true)}
        onOpenUserGuide={() => handleOpenModal(setShowUserGuideModal, true)}
        isStandalone={isStandalone}
      />

      <div className="app-layout" style={{ display: 'flex', maxWidth: '1440px', margin: '0 auto' }}>
        <Sidebar
          activeTab={activeTab}
          onNavigate={handleNavigate}
          onOpenAddModal={() => handleOpenModal(setShowAddModal, true)}
          onOpenInstallPwa={() => handleOpenModal(setShowInstallModal, true)}
          isStandalone={isStandalone}
        />

        <main id="main-content" tabIndex={-1} style={{ flex: 1, padding: '28px 36px', overflowX: 'hidden' }}>
          {activeTab === 'home' && (
            <HomeDashboard
              resources={resources}
              categories={categories}
              userProfile={userProfile}
              onNavigate={handleNavigate}
              onOpenReader={(r) => handleOpenModal(setActiveReaderResource, r)}
              onToggleFavorite={handleToggleFavorite}
              onShowCitation={(r) => handleOpenModal(setCitationModalResource, r)}
              onOpenAiSummarizer={(r) => handleOpenModal(setAiModalResource, r)}
              onOpenAddModal={() => handleOpenModal(setShowAddModal, true)}
              onDeleteResource={handleDeleteResource}
              onOpenInstallPwa={() => handleOpenModal(setShowInstallModal, true)}
              isStandalone={isStandalone}
            />
          )}

          {activeTab === 'search' && (
            <AcademicSearch
              initialQuery={searchQuery}
              onAddResource={handleAddResource}
              onOpenAiSummarizer={(r) => handleOpenModal(setAiModalResource, r)}
            />
          )}

          {activeTab === 'library' && (
            <MyLibrary
              resources={resources}
              categories={categories}
              onOpenReader={(r) => handleOpenModal(setActiveReaderResource, r)}
              onToggleFavorite={handleToggleFavorite}
              onShowCitation={(r) => handleOpenModal(setCitationModalResource, r)}
              onOpenAiSummarizer={(r) => handleOpenModal(setAiModalResource, r)}
              onDeleteResource={handleDeleteResource}
              onOpenAddModal={() => handleOpenModal(setShowAddModal, true)}
              onSyncCloud={async () => {
                const session = storage.getSession();
                if (session && session.email) {
                  await storage.pullCloudVault(session.email);
                  refreshAppData();
                }
              }}
            />
          )}

          {activeTab === 'categories' && (
            <Categories
              categories={categories}
              resources={resources}
              onAddCategory={handleAddCategory}
              onSelectCategory={(catName) => {
                handleNavigate('library');
              }}
            />
          )}

          {activeTab === 'aichat' && (
            <AiChat
              onSaveNote={handleSaveNote}
              resources={resources}
            />
          )}

          {activeTab === 'notes' && (
            <NotesManager
              resources={resources}
              onOpenReader={(r) => handleOpenModal(setActiveReaderResource, r)}
            />
          )}

          {activeTab === 'synthesis' && (
            <LiteratureSynthesis
              resources={resources}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileSettings
              userProfile={userProfile}
              onSaveProfile={handleSaveProfile}
              resources={resources}
              onImportBackup={handleImportBackup}
              onLogout={handleLogout}
              onOpenInstallPwa={() => handleOpenModal(setShowInstallModal, true)}
              isStandalone={isStandalone}
            />
          )}
        </main>
      </div>

      <BottomNav 
        activeTab={activeTab} 
        onNavigate={handleNavigate} 
        onOpenMenu={() => handleOpenModal(setIsMobileMenuOpen, true)}
      />

      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activeTab={activeTab}
        onNavigate={(tabId) => {
          handleNavigate(tabId);
          setIsMobileMenuOpen(false);
        }}
        onOpenAddModal={() => {
          setIsMobileMenuOpen(false);
          handleOpenModal(setShowAddModal, true);
        }}
        onOpenInstallPwa={() => handleOpenModal(setShowInstallModal, true)}
        onOpenUserGuide={() => handleOpenModal(setShowUserGuideModal, true)}
        isStandalone={isStandalone}
      />

      {/* Reader Full Screen Overlay */}
      {activeReaderResource && (
        <DocumentReader
          resource={activeReaderResource}
          onClose={() => setActiveReaderResource(null)}
          onDeleteResource={(id) => {
            handleDeleteResource(id);
            setActiveReaderResource(null);
          }}
        />
      )}

      {/* Citation Generator Modal */}
      {citationModalResource && (
        <CitationModal
          resource={citationModalResource}
          onClose={() => setCitationModalResource(null)}
        />
      )}

      {/* Gemini AI Summarizer Modal */}
      {aiModalResource && (
        <AiSummarizerModal
          resource={aiModalResource}
          onClose={() => setAiModalResource(null)}
          onSaveNote={handleSaveNote}
        />
      )}

      {/* Add Paper Modal */}
      {showAddModal && (
        <AddResourceModal
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddResource}
        />
      )}

      {/* Login & Sign Up Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* Shown when the app is opened from a password-reset email. Rendered
          above everything else because the recovery session is only good for
          this one task. */}
      {showPasswordReset && (
        <PasswordResetModal
          onDone={() => {
            setShowPasswordReset(false);
            setUserProfile(storage.getSession());
            refreshAppData();
          }}
        />
      )}

      {/* PWA Install Modal */}
      {showInstallModal && (
        <InstallPwaModal
          onClose={() => setShowInstallModal(false)}
          deferredPrompt={deferredPrompt}
          isStandalone={isStandalone}
          onInstallSuccess={() => setShowInstallModal(false)}
        />
      )}

      {/* User Guide & Onboarding Carousel Modal */}
      <UserGuideModal
        isOpen={showUserGuideModal}
        onClose={() => {
          try {
            localStorage.setItem('researchvault_has_seen_onboarding', 'true');
          } catch (e) {}
          setShowUserGuideModal(false);
        }}
        onNavigate={handleNavigate}
        onOpenAddModal={() => handleOpenModal(setShowAddModal, true)}
      />
    </div>
  );
}

