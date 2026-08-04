import React, { useState, useEffect } from 'react';
import { Search, Loader2, Plus, ExternalLink, Sparkles, Check, Download } from 'lucide-react';
import { searchAcademicSources } from '../services/academicSearch';

export default function AcademicSearch({ initialQuery, onAddResource, onOpenAiSummarizer }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedMap, setSavedMap] = useState({});

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await searchAcademicSources(query.trim());
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      handleSearch();
    } else {
      setQuery('Transformers AI');
      handleSearch();
    }
  }, [initialQuery]);

  const handleSave = (item) => {
    onAddResource({
      title: item.title,
      authors: item.authors,
      abstractText: item.abstractText,
      publicationYear: item.publicationYear,
      journal: item.journalOrVenue,
      doi: item.doi,
      sourceUrl: item.sourceUrl,
      downloadUrl: item.downloadUrl,
      resourceType: item.resourceType,
      category: item.suggestedCategory,
      openAccess: item.openAccess,
      citationCount: item.citationCount,
      downloadStatus: 'COMPLETED'
    });
    setSavedMap(prev => ({ ...prev, [item.doi || item.title]: true }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 800 }}>Academic Search Engine</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Query over 250M open-access papers, DOIs, and journals via OpenAlex and Crossref repositories.</p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords, author names, paper titles, or DOI (e.g. 10.48550/arXiv.1706.03762)..."
            style={{
              width: '100%',
              padding: '14px 16px 14px 48px',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0 24px' }}>
          {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
          <span>Search</span>
        </button>
      </form>

      {/* Search Results */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--primary)' }}>
          <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700 }}>Searching Global Academic Catalogs...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {results.map((item, idx) => {
            const isSaved = savedMap[item.doi || item.title];
            return (
              <div key={idx} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span className="badge">{item.resourceType}</span>
                      {item.openAccess && <span className="badge">Open Access</span>}
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 700 }}>{item.title}</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <strong>{item.authors}</strong> • {item.publicationYear} • <span style={{ color: 'var(--primary)' }}>{item.journalOrVenue}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSave(item)}
                    className={isSaved ? "btn-secondary" : "btn-primary"}
                    disabled={isSaved}
                    style={{ flexShrink: 0, padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    {isSaved ? <Check size={16} /> : <Plus size={16} />}
                    <span>{isSaved ? 'Saved' : 'Save to Library'}</span>
                  </button>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {item.abstractText}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div>DOI: {item.doi || 'N/A'} • Citations: {item.citationCount}</div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => onOpenAiSummarizer(item)} style={{ color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={14} /> AI Summary
                    </button>
                    {(item.downloadUrl || item.sourceUrl) && (
                      <a 
                        href={item.downloadUrl || item.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                        title="Download or View PDF Document"
                      >
                        <Download size={14} /> Download PDF
                      </a>
                    )}
                    {item.sourceUrl && (
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                        Source Link <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
