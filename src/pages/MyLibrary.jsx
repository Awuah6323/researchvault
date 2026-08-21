import React, { useState } from 'react';
import { Search, Filter, ArrowUpDown, Grid, List, UploadCloud, RefreshCw, Loader2, Download, FileText } from 'lucide-react';
import ResourceCard from '../components/ResourceCard';
import { exportLibraryCitationsPdf } from '../services/citationPdfExporter';

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
  const [activeTabFilter, setActiveTabFilter] = useState('ALL');
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
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchAuthor = (r.authors || '').toLowerCase().includes(q);
      const matchCat = (r.category || '').toLowerCase().includes(q);
      if (!matchTitle && !matchAuthor && !matchCat) return false;
    }
    return true;
  });

  if (sortOption === 'RECENT') {
    filtered.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
  } else if (sortOption === 'TITLE') {
    filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (sortOption === 'YEAR') {
    filtered.sort((a, b) => (b.publicationYear || 0) - (a.publicationYear || 0));
  } else if (sortOption === 'CITATIONS') {
    filtered.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
  }

  const handleManualSync = async () => {
    if (!onSyncCloud || syncing) return;
    setSyncing(true);
    try {
      await onSyncCloud();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Literature Library</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage, read, and analyze your research papers ({resources.length} saved records)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={onOpenAddModal}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <UploadCloud size={16} />
            <span>Add Paper</span>
          </button>

          {onSyncCloud && (
            <button
              onClick={handleManualSync}
              className="btn-secondary"
              disabled={syncing}
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
              title="Sync library across devices"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>{syncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </button>
          )}

          <button
            onClick={() => exportLibraryCitationsPdf(filtered, 'APA')}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }}
            title="Export filtered papers as formatted PDF citation document"
          >
            <Download size={15} />
            <span>Export PDF Citations</span>
          </button>

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
            style={{ padding: '8px 12px', fontSize: '0.8rem', opacity: 0.8 }}
            title="Export as raw BibTeX (.bib) file"
          >
            .BIB
          </button>
        </div>
      </div>

      {/* Control Bar: Search input, Category Dropdown, Sort */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <label htmlFor="library-filter" className="sr-only">Filter library papers</label>
          <input
            id="library-filter"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter library papers..."
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
          />
        </div>

        {/* Category Filter */}
        <label htmlFor="library-category" className="sr-only">Filter by category</label>
        <select
          id="library-category"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        {/* Sort */}
        <label htmlFor="library-sort" className="sr-only">Sort papers by</label>
        <select
          id="library-sort"
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
        <div className="paper-card-grid" style={{ paddingBottom: '40px' }}>
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
