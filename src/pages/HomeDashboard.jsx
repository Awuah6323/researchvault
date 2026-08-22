import React, { useState } from 'react';
import { BookOpen, Sparkles, Plus, Search, ArrowRight, MessageSquare, FolderKanban, Compass, Download } from 'lucide-react';
import ResourceCard from '../components/ResourceCard';
import OnboardingCarousel from '../components/OnboardingCarousel';

export default function HomeDashboard({ 
  resources, 
  categories, 
  userProfile, 
  onNavigate, 
  onOpenReader, 
  onToggleFavorite, 
  onShowCitation, 
  onOpenAiSummarizer, 
  onOpenAddModal,
  onDeleteResource,
  onOpenInstallPwa,
  isStandalone
}) {
  const [showGuide, setShowGuide] = useState(() => {
    try {
      return localStorage.getItem('researchvault_hide_dashboard_guide') !== 'true';
    } catch (e) {
      return true;
    }
  });

  const handleCloseGuide = () => {
    setShowGuide(false);
    try {
      localStorage.setItem('researchvault_hide_dashboard_guide', 'true');
      localStorage.setItem('researchvault_has_seen_onboarding', 'true');
    } catch (e) {}
  };

  const handleToggleGuide = () => {
    const nextState = !showGuide;
    setShowGuide(nextState);
    try {
      if (!nextState) {
        localStorage.setItem('researchvault_hide_dashboard_guide', 'true');
      } else {
        localStorage.removeItem('researchvault_hide_dashboard_guide');
      }
    } catch (e) {}
  };

  const favoritePapers = resources.filter(r => r.isFavorite);
  const readingInProgress = resources.filter(r => r.readingProgressPercent > 0);
  const recentlyAdded = [...resources].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)).slice(0, 6);

  const displayName =
    userProfile?.name ||
    (userProfile?.email ? userProfile.email.split('@')[0] : 'Researcher');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Page header.
          Was a 32px-padded "hero banner" card with a 280px BookOpen watermark
          behind it, a gradient on the user's name and a sparkle badge claiming
          a Gemini version that did not match the API being called. A dashboard
          greeting does not need to be a marketing panel, so it is now a plain
          page header — the buttons underneath are the part that does work. */}
      <div className="hero-banner" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem' }}>
            Welcome back, {displayName}
          </h1>
          <p className="page-subtitle">
            {userProfile?.institution || 'Academic workspace'} · {userProfile?.fieldOfStudy || 'Literature research'}
          </p>
        </div>

        <div className="hero-buttons" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button onClick={onOpenAddModal} className="btn-primary">
            <Plus size={16} aria-hidden="true" />
            <span>Import paper</span>
          </button>
          <button onClick={() => onNavigate('search')} className="btn-secondary">
            <Search size={16} aria-hidden="true" />
            <span>Search academic sources</span>
          </button>
          {!isStandalone && onOpenInstallPwa && (
            <button onClick={onOpenInstallPwa} className="btn-secondary">
              <Download size={16} aria-hidden="true" />
              <span>Install app</span>
            </button>
          )}
          <button
            onClick={handleToggleGuide}
            className="btn-secondary"
            aria-expanded={showGuide}
          >
            <Compass size={16} aria-hidden="true" />
            <span>{showGuide ? 'Hide app guide' : 'App guide'}</span>
          </button>
        </div>
      </div>

      {/* Auto-sliding Feature Onboarding Carousel */}
      {showGuide && (
        <OnboardingCarousel
          onNavigate={onNavigate}
          onOpenAddModal={onOpenAddModal}
          onClose={handleCloseGuide}
        />
      )}

      {/* Library counters.
          Four floating shadowed cards, each with its own tinted icon chip in
          the corner, became one panel divided by hairlines. Same four numbers,
          same order, same responsive collapse — but the value is now the
          loudest thing in each cell, which is the only reason the row exists.
          The icons were dropped outright: the label already says "Total Papers",
          so a book glyph beside it carried no information. */}
      <div className="metrics-grid">
        <div className="metric-cell">
          <span className="metric-label">Total papers</span>
          <span className="metric-value">{resources.length}</span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">Starred</span>
          <span className="metric-value">{favoritePapers.length}</span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">In progress</span>
          <span className="metric-value">{readingInProgress.length}</span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">Categories</span>
          <span className="metric-value">{categories.length}</span>
        </div>
      </div>

      {/* Quick Action Navigation Hub.
          Kept as four navigation buttons in the same order. The icons stay
          (they match the sidebar's icon for the same destination, so they help
          you aim) but lost their filled colour chips — four identical tinted
          squares in a row read as decoration, not as four different places. */}
      <div className="quick-actions-grid">
        <button
          onClick={() => onNavigate('synthesis')}
          className="neu-button"
          style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textAlign: 'left' }}
        >
          <Sparkles size={18} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-md)' }}>AI synthesis</span>
            <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Literature reviews</span>
          </span>
        </button>

        <button
          onClick={() => onNavigate('search')}
          className="neu-button"
          style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textAlign: 'left' }}
        >
          <Search size={18} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-md)' }}>Global search</span>
            <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>OpenAlex &amp; DOIs</span>
          </span>
        </button>

        <button
          onClick={() => onNavigate('categories')}
          className="neu-button"
          style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textAlign: 'left' }}
        >
          <FolderKanban size={18} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-md)' }}>Folders &amp; tags</span>
            <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Topic organisation</span>
          </span>
        </button>

        <button
          onClick={() => onNavigate('aichat')}
          className="neu-button"
          style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textAlign: 'left' }}
        >
          <MessageSquare size={18} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-md)' }}>AI research chat</span>
            <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Conversational assistant</span>
          </span>
        </button>
      </div>

      {/* Continue Reading Section */}
      {readingInProgress.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-4)', gap: 'var(--space-3)' }}>
            <h2 className="section-title">Continue reading</h2>
            <button onClick={() => onNavigate('library')} style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View all <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="paper-card-grid">
            {readingInProgress.map(r => (
              <ResourceCard
                key={r.id}
                resource={r}
                onOpenReader={onOpenReader}
                onToggleFavorite={onToggleFavorite}
                onShowCitation={onShowCitation}
                onOpenAiSummarizer={onOpenAiSummarizer}
                onDeleteResource={onDeleteResource}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recently Saved Literature */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-4)', gap: 'var(--space-3)' }}>
          <h2 className="section-title">Recently added</h2>
          {resources.length > 0 && (
            <button onClick={() => onNavigate('library')} style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View library <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {resources.length === 0 ? (
          <div className="glass-card" style={{ padding: 'var(--space-10) var(--space-6)', textAlign: 'center' }}>
            <BookOpen size={26} aria-hidden="true" style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }} />
            <h3 className="section-title" style={{ marginBottom: '6px' }}>Your vault is empty</h3>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', maxWidth: '48ch', margin: '0 auto var(--space-5)', lineHeight: 'var(--leading-snug)' }}>
              Search open-access repositories, import a DOI, or attach a local PDF to start building your library.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => onNavigate('search')} className="btn-primary">
                <Search size={15} aria-hidden="true" /> Search papers
              </button>
              <button onClick={onOpenAddModal} className="btn-secondary">
                <Plus size={15} aria-hidden="true" /> Import paper
              </button>
            </div>
          </div>
        ) : (
          <div className="paper-card-grid">
            {recentlyAdded.map(r => (
              <ResourceCard
                key={r.id}
                resource={r}
                onOpenReader={onOpenReader}
                onToggleFavorite={onToggleFavorite}
                onShowCitation={onShowCitation}
                onOpenAiSummarizer={onOpenAiSummarizer}
                onDeleteResource={onDeleteResource}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
