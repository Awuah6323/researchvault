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

import { storage } from './services/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [theme, setTheme] = useState('warm-sepia');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Reader Active State
  const [activeReaderResource, setActiveReaderResource] = useState(null);
  const [citationModalResource, setCitationModalResource] = useState(null);
  const [aiModalResource, setAiModalResource] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const refreshAppData = () => {
    setResources(storage.getResources());
    setCategories(storage.getCategories());
  };

  const handleLoginSuccess = (profile) => {
    setUserProfile(profile || storage.getSession());
    refreshAppData();
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

    // Auto-refresh from Cloud Vault when switching focus back to phone/PC
    const handleFocus = () => {
      refreshAppData();
      const activeSession = storage.getSession();
      if (activeSession && activeSession.email) {
        storage.pullCloudVault(activeSession.email).then((updated) => {
          if (updated) {
            refreshAppData();
            setUserProfile(storage.getSession());
          }
        });
      }
    };

    // Automatic real-time background sync interval (every 15 seconds)
    const autoSyncInterval = setInterval(() => {
      const activeSession = storage.getSession();
      if (activeSession && activeSession.email) {
        storage.pullCloudVault(activeSession.email).then((updated) => {
          if (updated) {
            refreshAppData();
            setUserProfile(storage.getSession());
          }
        });
      }
    }, 15000);

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
      clearInterval(autoSyncInterval);
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
        showAuthModal;

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

        <main style={{ flex: 1, padding: '28px 36px', overflowX: 'hidden' }}>
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

      {/* PWA Install Modal */}
      {showInstallModal && (
        <InstallPwaModal
          onClose={() => setShowInstallModal(false)}
          deferredPrompt={deferredPrompt}
          isStandalone={isStandalone}
          onInstallSuccess={() => setShowInstallModal(false)}
        />
      )}
    </div>
  );
}

