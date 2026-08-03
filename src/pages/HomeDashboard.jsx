import React from 'react';
import { BookOpen, Sparkles, Plus, TrendingUp, Star, Award, Search, ArrowRight } from 'lucide-react';
import ResourceCard from '../components/ResourceCard';

export default function HomeDashboard({ 
  resources, 
  categories, 
  userProfile, 
  onNavigate, 
  onOpenReader, 
  onToggleFavorite, 
  onShowCitation, 
  onOpenAiSummarizer, 
  onOpenAddModal 
}) {
  const favoritePapers = resources.filter(r => r.isFavorite);
  const readingInProgress = resources.filter(r => r.readingProgressPercent > 0);
  const recentlyAdded = [...resources].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)).slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Welcome Banner */}
      <div className="glass-card-accent" style={{
        padding: '36px',
        borderRadius: '24px',
        color: 'var(--text-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ maxWidth: '640px', zIndex: 10 }}>
          <div className="badge" style={{ marginBottom: '16px' }}>
            <Sparkles size={14} /> Gemini 2.0 AI Research Vault
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '12px' }}>
            Welcome back, <span className="text-gradient-emerald">{userProfile?.name || 'Researcher'}</span>
          </h1>
          <p style={{ fontSize: '0.98rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '22px' }}>
            {userProfile?.institution || 'Stanford University'} • {userProfile?.fieldOfStudy || 'Computer Science'}. Access your literature library, synthesize papers with Gemini AI, and format instant citations.
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <button onClick={onOpenAddModal} className="btn-primary">
              <Plus size={18} />
              <span>Import Paper</span>
            </button>
            <button onClick={() => onNavigate('search')} className="btn-secondary">
              <Search size={18} />
              <span>Search Academic Sources</span>
            </button>
          </div>
        </div>

        {/* Decorative badge */}
        <div style={{ opacity: 0.08, color: 'var(--primary)', position: 'absolute', right: '-20px', bottom: '-30px' }}>
          <BookOpen size={260} />
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Library Papers</span>
            <BookOpen size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{resources.length}</div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Starred Favorites</span>
            <Star size={20} style={{ color: 'var(--accent-gold)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{favoritePapers.length}</div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Reading</span>
            <TrendingUp size={20} style={{ color: 'var(--secondary)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{readingInProgress.length}</div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Categories</span>
            <Award size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{categories.length}</div>
        </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {readingInProgress.map(r => (
              <ResourceCard
                key={r.id}
                resource={r}
                onOpenReader={onOpenReader}
                onToggleFavorite={onToggleFavorite}
                onShowCitation={onShowCitation}
                onOpenAiSummarizer={onOpenAiSummarizer}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recently Saved Papers */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Recently Added Papers</h2>
          {resources.length > 0 && (
            <button onClick={() => onNavigate('library')} style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View Library <ArrowRight size={14} />
            </button>
          )}
        </div>

        {resources.length === 0 ? (
          <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>Your Vault is Empty</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px' }}>
                Search over 250M+ open-access papers, import DOIs, or attach local PDF files to build your personalized research library.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => onNavigate('search')} className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
                  <Search size={16} /> Search Papers
                </button>
                <button onClick={onOpenAddModal} className="btn-secondary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
                  <Plus size={16} /> Import Paper
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {recentlyAdded.map(r => (
              <ResourceCard
                key={r.id}
                resource={r}
                onOpenReader={onOpenReader}
                onToggleFavorite={onToggleFavorite}
                onShowCitation={onShowCitation}
                onOpenAiSummarizer={onOpenAiSummarizer}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
