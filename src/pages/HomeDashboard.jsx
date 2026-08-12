import React, { useState } from 'react';
import { BookOpen, Sparkles, Plus, TrendingUp, Star, Award, Search, ArrowRight, MessageSquare, FolderKanban, FileCode, Compass } from 'lucide-react';
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
  onDeleteResource
}) {
  const [showGuide, setShowGuide] = useState(true);
  const favoritePapers = resources.filter(r => r.isFavorite);
  const readingInProgress = resources.filter(r => r.readingProgressPercent > 0);
  const recentlyAdded = [...resources].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)).slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Glassmorphic Hero Welcome Banner */}
      <div className="glass-card-accent hero-banner" style={{
        padding: '32px',
        borderRadius: '24px',
        color: 'var(--text-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ maxWidth: '640px', zIndex: 10 }}>
          <div className="badge" style={{ marginBottom: '12px' }}>
            <Sparkles size={14} /> Gemini 2.5 AI Research Vault
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '12px' }}>
            Welcome back, <span className="text-gradient-emerald">{userProfile?.name || (userProfile?.email ? userProfile.email.split('@')[0] : 'Researcher')}</span>
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
            {userProfile?.institution || 'Academic Workspace'} • {userProfile?.fieldOfStudy || 'Literature Research'}. Organize your literature library, synthesize research papers with Gemini AI, and export instant citations.
          </p>

          <div className="hero-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={onOpenAddModal} className="btn-primary">
              <Plus size={18} />
              <span>Import Paper</span>
            </button>
            <button onClick={() => onNavigate('search')} className="btn-secondary">
              <Search size={18} />
              <span>Search Academic Sources</span>
            </button>
            <button 
              onClick={() => setShowGuide(!showGuide)} 
              className="neu-button" 
              style={{ padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontWeight: 600 }}
            >
              <Compass size={18} style={{ color: 'var(--primary)' }} />
              <span>{showGuide ? 'Hide App Guide' : '💡 User Guide & Navigation'}</span>
            </button>
          </div>
        </div>

        {/* Decorative background element */}
        <div className="hero-bg-icon" style={{ opacity: 0.07, color: 'var(--primary)', position: 'absolute', right: '-20px', bottom: '-30px', pointerEvents: 'none' }}>
          <BookOpen size={280} />
        </div>
      </div>

      {/* Auto-sliding 3s Feature Onboarding Carousel */}
      {showGuide && (
        <OnboardingCarousel 
          onNavigate={onNavigate}
          onOpenAddModal={onOpenAddModal}
          onClose={() => setShowGuide(false)}
        />
      )}

      {/* Neumorphic Metric Cards Grid */}
      <div className="metrics-grid">
        <div className="neu-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Papers</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)' }}>{resources.length}</div>
        </div>

        <div className="neu-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Starred Favorites</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: 'var(--accent-gold-light)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)' }}>{favoritePapers.length}</div>
        </div>

        <div className="neu-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Reading</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)' }}>{readingInProgress.length}</div>
        </div>

        <div className="neu-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Categories</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)' }}>{categories.length}</div>
        </div>
      </div>

      {/* Quick Action Navigation Hub */}
      <div className="glass-panel quick-actions-grid" style={{ padding: '16px' }}>
        <button 
          onClick={() => onNavigate('synthesis')}
          className="neu-button"
          style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', textAlign: 'left' }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>AI Synthesis</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Literature Reviews</div>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('search')}
          className="neu-button"
          style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', textAlign: 'left' }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Search size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Global Search</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>OpenAlex & DOIs</div>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('categories')}
          className="neu-button"
          style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', textAlign: 'left' }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary-light)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FolderKanban size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Folders & Tags</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Topic Organization</div>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('aichat')}
          className="neu-button"
          style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', textAlign: 'left' }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MessageSquare size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>AI Research Chat</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Conversational Assistant</div>
          </div>
        </button>
      </div>

      {/* Continue Reading Section */}
      {readingInProgress.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Continue Reading</h2>
            <button onClick={() => onNavigate('library')} style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View All <ArrowRight size={14} />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Recently Added Literature</h2>
          {resources.length > 0 && (
            <button onClick={() => onNavigate('library')} style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View Complete Library <ArrowRight size={14} />
            </button>
          )}
        </div>

        {resources.length === 0 ? (
          <div className="glass-card" style={{ padding: '36px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>Your Vault is Currently Empty</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                Query over 250M+ open-access papers, import DOIs, or attach local PDF files to build your personalized research library.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => onNavigate('search')} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  <Search size={15} /> Search Academic Papers
                </button>
                <button onClick={onOpenAddModal} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  <Plus size={15} /> Import Paper
                </button>
              </div>
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
