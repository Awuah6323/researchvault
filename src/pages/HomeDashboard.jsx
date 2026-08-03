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
      <div style={{
        padding: '32px',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, var(--primary), #1e1b4b)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 10px 30px rgba(37, 99, 235, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ maxWidth: '600px', zIndex: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', backgroundColor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '14px' }}>
            <Sparkles size={14} /> Gemini 2.0 AI Research Vault
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '10px' }}>
            Welcome back, {userProfile?.name || 'Researcher'}
          </h1>
          <p style={{ fontSize: '0.95rem', opacity: 0.9, lineHeight: 1.5, marginBottom: '20px' }}>
            {userProfile?.institution || 'Stanford University'} • {userProfile?.fieldOfStudy || 'Computer Science'}. Access your literature library, synthesize papers with Gemini AI, and format instant citations.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={onOpenAddModal} className="btn-primary" style={{ backgroundColor: '#ffffff', color: 'var(--primary)', border: 'none' }}>
              <Plus size={18} />
              <span>Import Paper</span>
            </button>
            <button onClick={() => onNavigate('search')} className="btn-secondary" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', color: '#fff', borderColor: 'rgba(255, 255, 255, 0.3)' }}>
              <Search size={18} />
              <span>Search Academic Sources</span>
            </button>
          </div>
        </div>

        {/* Decorative badge */}
        <div style={{ opacity: 0.15, position: 'absolute', right: '-20px', bottom: '-30px' }}>
          <BookOpen size={240} />
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
          <button onClick={() => onNavigate('library')} style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            View Library <ArrowRight size={14} />
          </button>
        </div>
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
      </div>
    </div>
  );
}
