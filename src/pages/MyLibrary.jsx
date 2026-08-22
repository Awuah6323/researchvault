import React, { useState } from 'react';
import { Search, RefreshCw, Loader2, Download, FileText, UploadCloud } from 'lucide-react';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header Bar.
          This h1 was the one page title in the app set in the sans face while
          the other seven were serif. It uses the shared .page-title now. */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Literature Library</h1>
          <p className="page-subtitle">
            {resources.length} {resources.length === 1 ? 'paper' : 'papers'} saved
          </p>
        </div>

        {/* Add Paper is the only primary action here. Export, Sync and .BIB are
            all secondary and now look it — "Export PDF Citations" used to be a
            third, hardcoded emerald button colour sitting between two outline
            buttons, for no semantic reason. */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button
            onClick={onOpenAddModal}
            className="btn-primary"
          >
            <UploadCloud size={16} aria-hidden="true" />
            <span>Add paper</span>
          </button>

          {onSyncCloud && (
            <button
              onClick={handleManualSync}
              className="btn-secondary"
              disabled={syncing}
              title="Sync library across devices"
            >
              {syncing
                ? <Loader2 size={15} aria-hidden="true" className="animate-spin" />
                : <RefreshCw size={15} aria-hidden="true" />}
              <span>{syncing ? 'Syncing…' : 'Sync'}</span>
            </button>
          )}

          <button
            onClick={() => exportLibraryCitationsPdf(filtered, 'APA')}
            className="btn-secondary"
            title="Export the papers currently shown as a formatted PDF citation list"
          >
            <Download size={15} aria-hidden="true" />
            <span>Export PDF</span>
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
            disabled={filtered.length === 0}
            title="Export the papers currently shown as a BibTeX (.bib) file"
          >
            <FileText size={15} aria-hidden="true" />
            <span>BibTeX</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Search input, Category Dropdown, Sort */}
      <div className="glass-card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <label htmlFor="library-filter" className="sr-only">Filter library papers</label>
          <input
            id="library-filter"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by title, author or category…"
            style={{ width: '100%', paddingLeft: '34px', fontSize: 'var(--text-md)' }}
          />
        </div>

        {/* Category Filter */}
        <label htmlFor="library-category" className="sr-only">Filter by category</label>
        <select
          id="library-category"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ fontSize: 'var(--text-md)', fontWeight: 500 }}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        {/* Sort */}
        <label htmlFor="library-sort" className="sr-only">Sort papers by</label>
        <select
          id="library-sort"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          style={{ fontSize: 'var(--text-md)', fontWeight: 500 }}
        >
          <option value="RECENT">Recently added</option>
          <option value="TITLE">Title (A–Z)</option>
          <option value="YEAR">Publication year</option>
          <option value="CITATIONS">Citation count</option>
        </select>
      </div>

      {/* Grid of Resource Cards */}
      {filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: 'var(--space-10) var(--space-5)', textAlign: 'center' }}>
          <div className="section-title" style={{ marginBottom: '6px' }}>No papers found</div>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>
            {resources.length === 0
              ? 'Add your first paper to get started.'
              : 'Try clearing your filters or search query.'}
          </div>
        </div>
      ) : (
        <div className="paper-card-grid" style={{ paddingBottom: 'var(--space-6)' }}>
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
