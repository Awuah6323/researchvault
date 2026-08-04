import React, { useState, useEffect } from 'react';
import { Search, Loader2, Plus, ExternalLink, Sparkles, Check, Download, Eye, X, BookOpen, Award, FileText, ArrowUpDown } from 'lucide-react';
import { searchAcademicSources } from '../services/academicSearch';

export default function AcademicSearch({ initialQuery, onAddResource, onOpenAiSummarizer }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedMap, setSavedMap] = useState({});
  const [sortBy, setSortBy] = useState('citations'); // 'citations', 'newest', 'relevance', 'openaccess'
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

  // Process and sort search results
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

      {/* Search Input & Sort Bar */}
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

        {/* Filter & Sort Controls */}
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

      {/* Search Results List */}
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
              <div key={idx} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span className="badge">{item.resourceType}</span>
                      {item.openAccess && <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>Open Access</span>}
                      {item.citationCount > 0 && (
                        <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-text)' }}>
                          <Award size={12} style={{ display: 'inline', marginRight: '3px' }} />
                          {item.citationCount.toLocaleString()} Citations
                        </span>
                      )}
                    </div>
                    <h3 
                      onClick={() => setPreviewPaper(item)}
                      style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-main)' }}
                    >
                      {item.title}
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <strong>{item.authors}</strong> • {item.publicationYear} • <span style={{ color: 'var(--primary)' }}>{item.journalOrVenue}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => setPreviewPaper(item)}
                      className="btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                      title="Preview paper details and document summary before saving"
                    >
                      <Eye size={16} />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={() => handleSave(item)}
                      className={isSaved ? "btn-secondary" : "btn-primary"}
                      disabled={isSaved}
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      {isSaved ? <Check size={16} /> : <Plus size={16} />}
                      <span>{isSaved ? 'Saved' : 'Save to Library'}</span>
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {item.abstractText}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div>DOI: {item.doi || 'N/A'}</div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => onOpenAiSummarizer(item)} style={{ color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
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

      {/* PAPER PREVIEW MODAL OVERLAY */}
      {previewPaper && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '760px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Preview Modal Header */}
            <div style={{
              padding: '20px 24px',
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
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>Academic Work Preview</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ResearchVault Catalog Review</div>
                </div>
              </div>

              <button
                onClick={() => setPreviewPaper(null)}
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

            {/* Preview Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
              {/* Badges */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="badge">{previewPaper.resourceType}</span>
                {previewPaper.openAccess && <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>Open Access</span>}
                {previewPaper.citationCount > 0 && (
                  <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-text)' }}>
                    {previewPaper.citationCount.toLocaleString()} Citations
                  </span>
                )}
                <span className="badge" style={{ backgroundColor: 'var(--bg-main)' }}>
                  Category: {previewPaper.suggestedCategory}
                </span>
              </div>

              {/* Title & Metadata */}
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                  {previewPaper.title}
                </h2>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <strong>Authors:</strong> {previewPaper.authors}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <strong>Published in:</strong> {previewPaper.journalOrVenue} ({previewPaper.publicationYear})
                </div>
                {previewPaper.doi && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '4px' }}>
                    DOI: {previewPaper.doi}
                  </div>
                )}
              </div>

              {/* Full Abstract Section */}
              <div style={{
                backgroundColor: 'var(--bg-main)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} /> Abstract & Overview
                </div>
                <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {previewPaper.abstractText}
                </p>
              </div>

              {/* PDF Viewer Frame Preview (If Direct Download/PDF URL Available) */}
              {previewPaper.downloadUrl && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>Live Document Stream Preview</span>
                    <a href={previewPaper.downloadUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                      Open PDF in New Window <ExternalLink size={12} />
                    </a>
                  </div>
                  <iframe
                    src={previewPaper.downloadUrl}
                    title="PDF Document Preview"
                    style={{ width: '100%', height: '240px', border: 'none' }}
                  />
                </div>
              )}
            </div>

            {/* Preview Modal Actions */}
            <div style={{
              padding: '16px 24px',
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
                  onClick={() => {
                    handleSave(previewPaper);
                  }}
                  className={savedMap[previewPaper.doi || previewPaper.title] ? "btn-secondary" : "btn-primary"}
                  disabled={savedMap[previewPaper.doi || previewPaper.title]}
                  style={{ padding: '8px 18px', fontSize: '0.85rem' }}
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
                  style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                >
                  <Sparkles size={16} />
                  <span>AI Summary</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {(previewPaper.downloadUrl || previewPaper.sourceUrl) && (
                  <a
                    href={previewPaper.downloadUrl || previewPaper.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem', textDecoration: 'none', backgroundColor: '#10b981' }}
                  >
                    <Download size={16} />
                    <span>Download Document</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
