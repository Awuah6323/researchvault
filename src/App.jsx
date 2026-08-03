import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ResourceCard from './components/ResourceCard';
import CitationModal from './components/CitationModal';
import AiSummarizerModal from './components/AiSummarizerModal';
import AddResourceModal from './components/AddResourceModal';
import AuthModal from './components/AuthModal';

import HomeDashboard from './pages/HomeDashboard';
import AcademicSearch from './pages/AcademicSearch';
import MyLibrary from './pages/MyLibrary';
import Categories from './pages/Categories';
import DocumentReader from './pages/DocumentReader';
import LiteratureSynthesis from './pages/LiteratureSynthesis';
import ProfileSettings from './pages/ProfileSettings';
import NotesManager from './pages/NotesManager';
import AiChat from './pages/AiChat';

import { storage } from './services/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [userProfile, setUserProfile] = useState({
    name: "Alex Rivera",
    email: "alex.rivera@stanford.edu",
    institution: "Stanford University",
    fieldOfStudy: "Computer Science & AI",
    researchInterests: "Deep Learning, Natural Language Processing, Neural Networks"
  });
  const [theme, setTheme] = useState('scholarly-light');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Reader Active State
  const [activeReaderResource, setActiveReaderResource] = useState(null);
  const [citationModalResource, setCitationModalResource] = useState(null);
  const [aiModalResource, setAiModalResource] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    setResources(storage.getResources());
    setCategories(storage.getCategories());
    setUserProfile(storage.getProfile());
    const savedTheme = storage.getTheme();
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

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
    const defaultProf = storage.logoutUser();
    setUserProfile(defaultProf);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <Navbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentTheme={theme}
        setTheme={handleSetTheme}
        userProfile={userProfile}
        onNavigate={(tab) => setActiveTab(tab)}
        onOpenAuthModal={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      <div style={{ display: 'flex', maxWidth: '1440px', margin: '0 auto' }}>
        <Sidebar
          activeTab={activeTab}
          onNavigate={(tab) => setActiveTab(tab)}
          onOpenAddModal={() => setShowAddModal(true)}
        />

        <main style={{ flex: 1, padding: '28px 36px', overflowX: 'hidden' }}>
          {activeTab === 'home' && (
            <HomeDashboard
              resources={resources}
              categories={categories}
              userProfile={userProfile}
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenReader={(r) => setActiveReaderResource(r)}
              onToggleFavorite={handleToggleFavorite}
              onShowCitation={(r) => setCitationModalResource(r)}
              onOpenAiSummarizer={(r) => setAiModalResource(r)}
              onOpenAddModal={() => setShowAddModal(true)}
            />
          )}

          {activeTab === 'search' && (
            <AcademicSearch
              initialQuery={searchQuery}
              onAddResource={handleAddResource}
              onOpenAiSummarizer={(r) => setAiModalResource(r)}
            />
          )}

          {activeTab === 'library' && (
            <MyLibrary
              resources={resources}
              categories={categories}
              onOpenReader={(r) => setActiveReaderResource(r)}
              onToggleFavorite={handleToggleFavorite}
              onShowCitation={(r) => setCitationModalResource(r)}
              onOpenAiSummarizer={(r) => setAiModalResource(r)}
              onDeleteResource={handleDeleteResource}
            />
          )}

          {activeTab === 'categories' && (
            <Categories
              categories={categories}
              onAddCategory={handleAddCategory}
              onSelectCategory={(catName) => {
                setActiveTab('library');
              }}
            />
          )}

          {activeTab === 'aichat' && (
            <AiChat
              onSaveNote={handleSaveNote}
            />
          )}

          {activeTab === 'notes' && (
            <NotesManager
              resources={resources}
              onOpenReader={(r) => setActiveReaderResource(r)}
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
            />
          )}
        </main>
      </div>

      {/* Reader Full Screen Overlay */}
      {activeReaderResource && (
        <DocumentReader
          resource={activeReaderResource}
          onClose={() => setActiveReaderResource(null)}
          onOpenAiSummarizer={(r) => setAiModalResource(r)}
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
          onLoginSuccess={(p) => setUserProfile(p)}
        />
      )}
    </div>
  );
}

