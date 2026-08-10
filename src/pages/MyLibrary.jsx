import React, { useState } from 'react';
import { Search, Filter, ArrowUpDown, Grid, List, UploadCloud, RefreshCw, Loader2 } from 'lucide-react';
import ResourceCard from '../components/ResourceCard';

export default function MyLibrary({ 
  resources, 
  categories, 
  onOpenReader, 
  onToggleFavorite, 
  onShowCitation, 
  onOpenAiSummarizer,
  onDeleteResource,
  onOpenAddModal,
  onSyncCloud
}) {
  const [activeTabFilter, setActiveTabFilter] = useState('ALL'); // ALL, FAVORITES, COMPLETED
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortOption, setSortOption] = useState('RECENT');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  let filtered = resources.filter(r => {
    if (activeTabFilter === 'FAVORITES' && !r.isFavorite) return false;
    if (activeTabFilter === 'COMPLETED' && r.downloadStatus !== 'COMPLETED') return false;
    if (selectedCategory && r.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.authors.toLowerCase().includes(q) || r.abstractText.toLowerCase().includes(q);
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortOption === 'TITLE') return a.title.localeCompare(b.title);
    if (sortOption === 'YEAR') return b.publicationYear - a.publicationYear;
    if (sortOption === 'CITATIONS') return (b.citationCount || 0) - (a.citationCount || 0);
    return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 800 }}>My Academic Library</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Manage, filter, cite, and read your saved research collection.</p>
        </div>

        {/* Tab Filters & Batch Export */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-card)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setActiveTabFilter('ALL')}
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, backgroundColor: activeTabFilter === 'ALL' ? 'var(--primary)' : 'transparent', color: activeTabFilter === 'ALL' ? '#fff' : 'var(--text-muted)' }}
            >
              All ({resources.length})
            </button>
            <button
              onClick={() => setActiveTabFilter('FAVORITES')}
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, backgroundColor: activeTabFilter === 'FAVORITES' ? 'var(--primary)' : 'transparent', color: activeTabFilter === 'FAVORITES' ? '#fff' : 'var(--text-muted)' }}
            >
              Starred ({resources.filter(r => r.isFavorite).length})
            </button>
          </div>

          {onOpenAddModal && (
            <button
              onClick={onOpenAddModal}
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UploadCloud size={16} />
              <span>Upload PDF from Device</span>
            </button>
          )}

          {onSyncCloud && (
            <button
              onClick={async () => {
                if (syncing) return;
                setSyncing(true);
                try {
                  await onSyncCloud();
                } catch (e) {}
                setSyncing(false);
              }}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Sync library across devices"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>{syncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </button>
          )}

          <button
            onClick={() => {
              if (filtered.length === 0) return;
              const bibContent = filtered.map(r => `@article{${r.id},\n  title={${r.title}},\n  author={${r.authors}},\n  year={${r.publicationYear}}\n}`).join('\n\n');
              const blob = new Blob([bibContent], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `ResearchVault_Citations_${Date.now()}.bib`;
              a.click();
            }}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            title="Export filtered papers as BibTeX citation library"
          >
            Export .BIB Citations
          </button>
        </div>
      </div>

      {/* Control Bar: Search input, Category Dropdown, Sort */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter library papers..."
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        {/* Sort */}
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <option value="RECENT">Recently Added</option>
          <option value="TITLE">Title (A-Z)</option>
          <option value="YEAR">Publication Year</option>
          <option value="CITATIONS">Citation Count</option>
        </select>
      </div>

      {/* Grid of Resource Cards */}
      {filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>No research papers found</div>
          <div style={{ fontSize: '0.85rem' }}>Try clearing your filters or search query.</div>
        </div>
      ) : (
        <div className="paper-card-grid">
          {filtered.map(r => (
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
  );
}
