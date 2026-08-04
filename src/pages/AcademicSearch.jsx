// src/pages/AcademicSearch.jsx
import React, { useState, useEffect } from 'react';
import { Search, Loader2, Plus, ExternalLink, Sparkles, Check, Download, Eye, X, BookOpen, Award, FileText, ArrowUpDown, AlertCircle } from 'lucide-react';
import { searchAcademicSources } from '../services/academicSearch';

export default function AcademicSearch({ initialQuery, onAddResource, onOpenAiSummarizer }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedMap, setSavedMap] = useState({});
  const [sortBy, setSortBy] = useState('citations'); // Options: 'citations', 'newest', 'relevance', 'openaccess'
  const [previewPaper, setPreviewPaper] = useState(null);

  const executeSearch = async (searchStr) => {
    const targetQuery = (searchStr !== undefined ? searchStr : query).trim();
    if (!targetQuery) return;
    
    setLoading(true);
    try {
      const data = await searchAcademicSources(targetQuery);
      setResults(data);
    } catch (err) {
      console.error("Academic search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    executeSearch(query);
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      executeSearch(initialQuery);
    } else {
      setQuery('Transformers AI');
      executeSearch('Transformers AI');
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

  // Filter and sort search results
  const sortedResults = [...results].filter(item => {
    if (sortBy === 'openaccess') return item.openAccess;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'citations') return (b.citationCount || 0) - (a.citationCount || 0);
    if (sortBy === 'newest') return (b.publicationYear || 0) - (a.publicationYear || 0);
    return 0;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 800 }}>Academic Search Engine</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Search over 250M academic works, authors, DOIs, and journals via OpenAlex and Crossref repositories.</p>
      </div>

      {/* Search Input & Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search author names (e.g. Hinton, Vaswani), titles, keywords, or DOI..."
              style={{
                width: '100%',
                padding: '14px 16px 14px 48px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                fontSize: '1rem',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0 24px', flexShrink: 0 }}>
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            <span>Search</span>
          </button>
        </form>

        {/* Sorting Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {loading ? 'Searching...' : `Found ${sortedResults.length} paper${sortedResults.length === 1 ? '' : 's'}`}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpDown size={14} /> Sort By:
            </span>
            {[
              { id: 'citations', label: 'Most Cited' },
              { id: 'newest', label: 'Newest Year' },
              { id: 'openaccess', label: 'Open Access Only' },
              { id: 'relevance', label: 'Relevance' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSortBy(tab.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: sortBy === tab.id ? 'var(--primary)' : 'var(--bg-card)',
                  color: sortBy === tab.id ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Listing */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--primary)' }}>
          <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>Searching Global Academic Catalogs...</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Connecting to OpenAlex & Crossref metadata services</div>
        </div>
      ) : sortedResults.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No academic papers found matching "{query}". Try searching by author surname, topic keywords, or DOI.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sortedResults.map((item, idx) => {
            const isSaved = savedMap[item.doi || item.title];
            return (
              <div key={idx} className="glass-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--primary)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    {(item.downloadUrl || item.openAccess) && (
                      <a 
                        href={item.downloadUrl || item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="badge"
                        style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700, textDecoration: 'none' }}
                      >
                        [PDF] {item.pdfDomain || 'scholar.org'}
                      </a>
                    )}
                    <span className="badge">{item.resourceType}</span>
                    <span className="badge" style={{ backgroundColor: 'var(--bg-main)' }}>{item.suggestedCategory}</span>
                  </div>

                  <h3 
                    onClick={() => setPreviewPaper(item)}
                    style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 800, cursor: 'pointer', color: 'var(--text-main)', lineHeight: 1.35 }}
                  >
                    {item.title}
                  </h3>

                  <div style={{ fontSize: '0.86rem', color: '#10b981', marginTop: '6px', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{item.authors}</span> — <span style={{ color: 'var(--text-muted)' }}>{item.journalOrVenue}, {item.publicationYear}</span> — <span style={{ color: 'var(--primary)' }}>{item.pdfDomain || 'openalex.org'}</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {item.abstractText}
                </p>

                {/* Card Action Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Award size={14} />
                      Cited by {item.citationCount.toLocaleString()}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>DOI: {item.doi || 'N/A'}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      onClick={() => setPreviewPaper(item)}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      title="Read paper contents and document stream"
                    >
                      <Eye size={14} />
                      <span>Read Paper</span>
                    </button>

                    <button
                      onClick={() => handleSave(item)}
                      className={isSaved ? "btn-secondary" : "btn-primary"}
                      disabled={isSaved}
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                    >
                      {isSaved ? <Check size={14} /> : <Plus size={14} />}
                      <span>{isSaved ? 'Saved' : 'Save to Vault'}</span>
                    </button>

                    <button onClick={() => onOpenAiSummarizer(item)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      <Sparkles size={14} />
                      <span>AI Summary</span>
                    </button>

                    {(item.downloadUrl || item.sourceUrl) && (
                      <a 
                        href={item.downloadUrl || item.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '0.8rem', textDecoration: 'none', backgroundColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Download size={14} />
                        <span>Download PDF</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAPER PREVIEW MODAL (OPTION 3 FALLBACK IMPLEMENTATION) */}
      {previewPaper && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(8px)',
          zIndex: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '960px',
            height: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '20px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--header-bg)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    {previewPaper.downloadUrl ? 'Interactive Document Reader' : 'Paper Extract & Structural Overview'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {previewPaper.downloadUrl ? 'Embedded PDF Stream & Source Viewer' : 'Publisher restricted document fallback'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setPreviewPaper(null)}
                aria-label="Close Reader"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content Body */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '20px',
              backgroundColor: 'var(--bg-main)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              WebkitOverflowScrolling: 'touch'
            }}>
              {/* Paper Information Banner */}
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <span className="badge">{previewPaper.resourceType}</span>
                  {previewPaper.openAccess && (
                    <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                      Open Access
                    </span>
                  )}
                  <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-text)' }}>
                    {previewPaper.citationCount.toLocaleString()} Citations
                  </span>
                </div>

                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px', lineHeight: 1.3 }}>
                  {previewPaper.title}
                </h2>
                
                <div style={{ fontSize: '0.88rem', color: '#10b981', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{previewPaper.authors}</span> — <span style={{ color: 'var(--text-muted)' }}>{previewPaper.journalOrVenue} ({previewPaper.publicationYear})</span>
                </div>
              </div>

              {/* RENDER PATH 1: Embed Open Access PDF via Google Docs Proxy */}
              {previewPaper.downloadUrl ? (
                <div style={{ flex: 1, minHeight: '500px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewPaper.downloadUrl)}&embedded=true`}
                    title="Full Document Reader Stream"
                    style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#ffffff' }}
                  />
                </div>
              ) : (
                /* RENDER PATH 2: Fallback Reader Card for Restricted / Paywalled Publisher Content */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px 20px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <BookOpen size={44} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Publisher Frame Restrictions Active
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '480px', marginBottom: '18px', lineHeight: 1.5 }}>
                      This journal provider restricts direct iframe embedding. You can view the full paper and download the official PDF directly at the publisher site.
                    </p>
                    <a
                      href={previewPaper.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                      style={{ padding: '10px 22px', fontSize: '0.88rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <span>Read Full Document at Publisher</span>
                      <ExternalLink size={16} />
                    </a>
                  </div>

                  {/* Extract Section 1: Abstract */}
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={16} /> Section 1: Comprehensive Abstract & Problem Statement
                    </div>
                    <p style={{ fontSize: '0.94rem', color: 'var(--text-main)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                      {previewPaper.abstractText}
                    </p>
                  </div>

                  {/* Extract Section 2: Metadata */}
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BookOpen size={16} /> Section 2: Venue Metadata & DOI Reference
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                      <p><strong>Field Classification:</strong> {previewPaper.suggestedCategory}</p>
                      <p style={{ marginTop: '4px' }}><strong>Source Index:</strong> {previewPaper.journalOrVenue}</p>
                      <p style={{ marginTop: '4px' }}><strong>DOI Accession:</strong> {previewPaper.doi || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Action Toolbar */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--header-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleSave(previewPaper)}
                  className={savedMap[previewPaper.doi || previewPaper.title] ? "btn-secondary" : "btn-primary"}
                  disabled={savedMap[previewPaper.doi || previewPaper.title]}
                  style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                >
                  {savedMap[previewPaper.doi || previewPaper.title] ? <Check size={16} /> : <Plus size={16} />}
                  <span>{savedMap[previewPaper.doi || previewPaper.title] ? 'Saved to Library' : 'Save to Library'}</span>
                </button>

                <button
                  onClick={() => {
                    const p = previewPaper;
                    setPreviewPaper(null);
                    onOpenAiSummarizer(p);
                  }}
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                >
                  <Sparkles size={16} />
                  <span>AI Summary</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href={previewPaper.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.84rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>Open Publisher Source</span>
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}