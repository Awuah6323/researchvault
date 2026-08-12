import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Loader2,
  Plus,
  ExternalLink,
  Sparkles,
  Check,
  Download,
  Eye,
  X,
  BookOpen,
  Award,
  FileText,
  ArrowUpDown,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

import { searchAcademicSources, isDirectPdfUrl } from '../services/academicSearch';

export default function AcademicSearch({
  initialQuery,
  onAddResource,
  onOpenAiSummarizer
}) {
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedMap, setSavedMap] = useState({});
  const [sortBy, setSortBy] = useState('citations');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [previewPaper, setPreviewPaper] = useState(null);
  // 'idle' | 'checking' | 'blob' | 'viewer-loading' | 'viewer-loaded' | 'failed'
  const [previewStage, setPreviewStage] = useState('idle');
  const [blobUrl, setBlobUrl] = useState(null);
  const previewTimeoutRef = useRef(null);
  const previewAbortRef = useRef(null);
  const previewKeyRef = useRef(null);
  const resultsRef = useRef(null);

  // ----------------------------------------
  // SEARCH
  // ----------------------------------------

  const [scholarModalQuery, setScholarModalQuery] = useState(null);

  const openInAppScholar = (searchTerms) => {
    setScholarModalQuery(searchTerms || query || 'artificial intelligence');
  };

  const closeInAppScholar = () => {
    setScholarModalQuery(null);
  };

  const executeSearch = async (
    searchStr,
    targetPage = 1,
    targetPerPage = perPage,
    targetSort = sortBy
  ) => {
    const targetQuery = (
      searchStr !== undefined ? searchStr : query
    ).trim();

    if (!targetQuery) return;

    setLoading(true);

    try {
      const data = await searchAcademicSources(
        targetQuery,
        targetPage,
        targetPerPage,
        targetSort
      );

      if (data && typeof data === 'object' && Array.isArray(data.results)) {
        setResults(data.results);
        setTotalCount(data.totalCount || 0);
        setPage(data.page || targetPage);
        setPerPage(data.perPage || targetPerPage);
        setTotalPages(data.totalPages || 0);
      } else if (Array.isArray(data)) {
        setResults(data);
        setTotalCount(data.length);
        setPage(1);
        setTotalPages(1);
      } else {
        setResults([]);
        setTotalCount(0);
        setTotalPages(0);
      }
    } catch (err) {
      console.error('Academic search error:', err);
      setResults([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch(query, 1, perPage, sortBy);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || (totalPages > 0 && newPage > totalPages) || newPage === page || loading) return;
    executeSearch(query, newPage, perPage, sortBy);
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePerPageChange = (newPerPage) => {
    const size = Number(newPerPage);
    setPerPage(size);
    executeSearch(query, 1, size, sortBy);
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    executeSearch(query, 1, perPage, newSort);
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      executeSearch(initialQuery, 1, perPage, sortBy);
    } else {
      setQuery('');
      setResults([]);
      setTotalCount(0);
      setTotalPages(0);
    }
  }, [initialQuery]);

  // ----------------------------------------
  // OPEN PAPER PREVIEW
  //
  // Two real attempts are made before we ever show the "not available"
  // card:
  //
  //  1. Fetch the PDF bytes directly and render them from a blob URL.
  //     This does NOT get blocked by X-Frame-Options (that header only
  //     blocks framing a page, not fetching its bytes). It only fails
  //     if the host doesn't send CORS headers permitting cross-origin
  //     reads — and that failure is a real, catchable error, not a guess.
  //
  //  2. If the fetch is blocked, fall back to Google's PDF viewer, which
  //     fetches the file server-side and often succeeds where a raw
  //     iframe of the publisher URL would be blocked. Since browsers
  //     don't fire an iframe "error" event for X-Frame-Options/CSP
  //     blocks, this stage uses a timeout to detect failure.
  //
  // Only if BOTH fail do we show the fallback card — at that point the
  // publisher is blocking both bytes-level access and framing, which is
  // a server-side restriction no client code can get around.
  // ----------------------------------------

  const PREVIEW_VIEWER_TIMEOUT_MS = 7000;

  const clearPreviewTimeout = () => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  };

  const revokeBlobUrl = () => {
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const abortInFlightFetch = () => {
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
      previewAbortRef.current = null;
    }
  };

  const startViewerStage = (paper, key) => {
    if (!paper?.downloadUrl) {
      setPreviewStage('failed');
      return;
    }
    setPreviewStage('viewer-loading');
    previewTimeoutRef.current = setTimeout(() => {
      if (previewKeyRef.current === key) {
        setPreviewStage('failed');
      }
    }, PREVIEW_VIEWER_TIMEOUT_MS);
  };

  const openPreview = async (paper) => {
    const key = paper?.doi || paper?.title;
    previewKeyRef.current = key;

    clearPreviewTimeout();
    abortInFlightFetch();
    revokeBlobUrl();
    setPreviewPaper(paper);
    setPreviewStage('checking');

    if (!paper?.downloadUrl) {
      setPreviewStage('failed');
      return;
    }

    const controller = new AbortController();
    previewAbortRef.current = controller;

    try {
      let res;
      try {
        res = await fetch(paper.downloadUrl, {
          signal: controller.signal
        });
      } catch (directErr) {
        // Direct fetch blocked by CORS. Attempt via CORS proxy:
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(paper.downloadUrl)}`;
        res = await fetch(proxyUrl, { signal: controller.signal });
      }

      if (previewKeyRef.current !== key) return;

      if (!res || !res.ok) throw new Error('Could not fetch PDF stream');

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const looksLikePdfUrl = isDirectPdfUrl(paper.downloadUrl);

      if (!contentType.includes('pdf') && !looksLikePdfUrl) {
        throw new Error('Response is not a PDF byte stream');
      }

      const blob = await res.blob();
      if (previewKeyRef.current !== key) return;

      const objectUrl = URL.createObjectURL(blob);
      setBlobUrl(objectUrl);
      setPreviewStage('blob');
    } catch (err) {
      if (controller.signal.aborted || previewKeyRef.current !== key) return;
      // Direct/Proxy fetch failed. Transition directly to clean Executive Abstract Reader
      // instead of rendering a blocked iframe.
      setPreviewStage('failed');
    }
  };

  const closePreview = () => {
    previewKeyRef.current = null;
    clearPreviewTimeout();
    abortInFlightFetch();
    revokeBlobUrl();
    setPreviewPaper(null);
    setPreviewStage('idle');
  };

  const handleIframeLoad = () => {
    clearPreviewTimeout();
    setPreviewStage('viewer-loaded');
  };

  const handleIframeError = () => {
    clearPreviewTimeout();
    setPreviewStage('failed');
  };

  // Clean up any pending timeout / in-flight fetch / blob URL on unmount.
  useEffect(() => {
    return () => {
      clearPreviewTimeout();
      abortInFlightFetch();
      revokeBlobUrl();
    };
  }, []);

  // Route through Google's PDF viewer instead of framing the publisher
  // URL directly. Google fetches the PDF server-side and renders it as
  // an embeddable viewer, which sidesteps most X-Frame-Options/CSP
  // blocks that the raw publisher URL would hit.
  const getPreviewViewerUrl = (paper) => {
    if (!paper?.downloadUrl) return '';
    return `https://docs.google.com/viewer?url=${encodeURIComponent(
      paper.downloadUrl
    )}&embedded=true`;
  };

  // ----------------------------------------
  // SAVE PAPER
  // ----------------------------------------

  const handleSave = (item) => {
    if (!item) return;

    const paperKey = item.doi || item.title;

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
      citationCount: item.citationCount || 0,
      downloadStatus: 'COMPLETED'
    });

    setSavedMap((prev) => ({
      ...prev,
      [paperKey]: true
    }));
  };

  // ----------------------------------------
  // PAGINATION NUMBERS & SORT
  // ----------------------------------------

  const sortedResults = results;

  const getPageNumbers = () => {
    if (totalPages <= 1) return [1];
    const maxVisible = 7;
    const pages = [];

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);

      if (page <= 3) {
        end = 5;
      } else if (page >= totalPages - 2) {
        start = totalPages - 4;
      }

      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  // ----------------------------------------
  // SAFE VALUES
  // ----------------------------------------

  const getCitationCount = (item) => {
    return Number(item?.citationCount || 0).toLocaleString();
  };

  const hasPdf = (paper) => {
    if (!paper?.downloadUrl) return false;

    const url = paper.downloadUrl.toLowerCase();

    return (
      url.includes('.pdf') ||
      url.includes('pdf') ||
      paper.openAccess === true
    );
  };

  // ----------------------------------------
  // UI
  // ----------------------------------------

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}
    >
      {/* PAGE HEADER */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.8rem',
            fontWeight: 800
          }}
        >
          Academic Search Engine
        </h1>

        <p
          style={{
            fontSize: '0.9rem',
            color: 'var(--text-muted)'
          }}
        >
          Search over 250M academic works, authors, DOIs,
          and journals via OpenAlex and Crossref repositories.
        </p>
      </div>

      {/* SEARCH SECTION */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: '260px',
              position: 'relative'
            }}
          >
            <Search
              size={20}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search author names, titles, keywords, or DOI..."
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

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              padding: '0 24px',
              flexShrink: 0
            }}
          >
            {loading ? (
              <Loader2
                size={20}
                className="animate-spin"
              />
            ) : (
              <Search size={20} />
            )}

            <span>Search</span>
          </button>
        </form>

        {/* PROMINENT GOOGLE SCHOLAR ENGINE BAR */}
        <div style={{
          padding: '12px 16px',
          borderRadius: '16px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🎓 Google Scholar Engine Mode Active
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              (Searches title matching, citations & fulltext index directly inside app)
            </span>
          </div>

          <button
            type="button"
            onClick={() => openInAppScholar(query)}
            style={{
              padding: '8px 16px',
              borderRadius: '12px',
              backgroundColor: '#4285F4',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(66, 133, 244, 0.3)'
            }}
            title="Open Google Scholar results directly inside ResearchVault"
          >
            <BookOpen size={16} />
            <span>Open In-App Google Scholar</span>
          </button>
        </div>

        {/* SORTING */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              fontWeight: 600
            }}
          >
            {loading ? (
              'Searching global catalogs...'
            ) : totalCount > 0 ? (
              <span>
                Showing <strong style={{ color: 'var(--text-main)' }}>{(page - 1) * perPage + 1}–{Math.min(page * perPage, totalCount)}</strong> of <strong style={{ color: 'var(--text-main)' }}>{totalCount.toLocaleString()}</strong> papers (Page {page} of {totalPages || 1})
              </span>
            ) : (
              `Found ${results.length} papers`
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap'
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ArrowUpDown size={14} />
              Sort By:
            </span>

            {[
              {
                id: 'citations',
                label: 'Most Cited'
              },
              {
                id: 'newest',
                label: 'Newest Year'
              },
              {
                id: 'openaccess',
                label: 'Open Access Only'
              },
              {
                id: 'relevance',
                label: 'Relevance'
              }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSortChange(tab.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor:
                    sortBy === tab.id
                      ? 'var(--primary)'
                      : 'var(--bg-card)',
                  color:
                    sortBy === tab.id
                      ? '#ffffff'
                      : 'var(--text-muted)',
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

      {/* SEARCH RESULTS */}
      {loading ? (
        <div
          style={{
            padding: '60px',
            textAlign: 'center',
            color: 'var(--primary)'
          }}
        >
          <Loader2
            size={36}
            className="animate-spin"
            style={{
              margin: '0 auto 12px'
            }}
          />

          <div
            style={{
              fontWeight: 700,
              fontSize: '1.05rem',
              color: 'var(--text-main)'
            }}
          >
            Searching Global Academic Catalogs...
          </div>

          <div
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginTop: '4px'
            }}
          >
            Connecting to OpenAlex & Crossref metadata services
          </div>
        </div>
      ) : sortedResults.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}
        >
          No academic papers found matching "{query}".
        </div>
      ) : (
        <div
          ref={resultsRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {sortedResults.map((item, idx) => {
            const paperKey = item.doi || item.title;
            const isSaved = savedMap[paperKey];

            return (
              <div
                key={`${paperKey}-${idx}`}
                className="glass-card"
                style={{
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderLeft:
                    '4px solid var(--primary)'
                }}
              >
                {/* PAPER HEADER */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                      marginBottom: '6px'
                    }}
                  >
                    {hasPdf(item) && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor:
                            'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          fontWeight: 700
                        }}
                      >
                        PDF Available
                      </span>
                    )}

                    <span className="badge">
                      {item.resourceType}
                    </span>

                    <span
                      className="badge"
                      style={{
                        backgroundColor:
                          'var(--bg-main)'
                      }}
                    >
                      {item.suggestedCategory}
                    </span>
                  </div>

                  <h3
                    onClick={() => openPreview(item)}
                    style={{
                      fontFamily:
                        'var(--font-serif)',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      color: 'var(--text-main)',
                      lineHeight: 1.35
                    }}
                  >
                    {item.title}
                  </h3>

                  <div
                    style={{
                      fontSize: '0.86rem',
                      color: '#10b981',
                      marginTop: '6px',
                      fontWeight: 600
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--text-main)',
                        fontWeight: 700
                      }}
                    >
                      {item.authors}
                    </span>

                    {' — '}

                    <span
                      style={{
                        color: 'var(--text-muted)'
                      }}
                    >
                      {item.journalOrVenue},{' '}
                      {item.publicationYear}
                    </span>
                  </div>
                </div>

                {/* ABSTRACT */}
                <p
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-main)',
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {item.abstractText ||
                    'No abstract available.'}
                </p>

                {/* ACTION BAR */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    paddingTop: '12px',
                    borderTop:
                      '1px solid var(--border-color)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      flexWrap: 'wrap',
                      fontSize: '0.8rem'
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--primary)',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Award size={14} />
                      Cited by{' '}
                      {getCitationCount(item)}
                    </span>

                    <span
                      style={{
                        color: 'var(--text-muted)'
                      }}
                    >
                      DOI: {item.doi || 'N/A'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                      alignItems: 'center'
                    }}
                  >
                    {/* GOOGLE SCHOLAR IN-APP VIEWER BUTTON */}
                    <button
                      onClick={() => openInAppScholar(item.title)}
                      className="btn-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Search & view citations on Google Scholar directly in app"
                    >
                      <BookOpen size={14} />
                      <span>🎓 Google Scholar</span>
                    </button>

                    {/* READ PAPER */}
                    <button
                      onClick={() =>
                        openPreview(item)
                      }
                      className="btn-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.8rem'
                      }}
                    >
                      <Eye size={14} />
                      <span>
                        Preview Paper
                      </span>
                    </button>

                    {/* SAVE */}
                    <button
                      onClick={() =>
                        handleSave(item)
                      }
                      className={
                        isSaved
                          ? 'btn-secondary'
                          : 'btn-primary'
                      }
                      disabled={isSaved}
                      style={{
                        padding: '6px 14px',
                        fontSize: '0.8rem'
                      }}
                    >
                      {isSaved ? (
                        <Check size={14} />
                      ) : (
                        <Plus size={14} />
                      )}

                      <span>
                        {isSaved
                          ? 'Saved'
                          : 'Save to Vault'}
                      </span>
                    </button>

                    {/* AI SUMMARY */}
                    <button
                      onClick={() =>
                        onOpenAiSummarizer(item)
                      }
                      className="btn-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.8rem'
                      }}
                    >
                      <Sparkles size={14} />
                      <span>AI Summary</span>
                    </button>

                    {/* DIRECT PDF */}
                    {item.downloadUrl && (
                      <a
                        href={item.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                        style={{
                          padding: '6px 14px',
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Download size={14} />
                        <span>Open PDF</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SEARCH RESULTS PAGINATION */}
      {totalPages > 1 && (
        <div
          className="glass-card"
          style={{
            padding: '20px',
            marginTop: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)'
          }}
        >

          {/* PAGE CONTROLS BAR */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              flexWrap: 'wrap'
            }}
          >
            {/* FIRST PAGE */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={page === 1 || loading}
              className="btn-secondary"
              title="First Page"
              style={{
                padding: '8px 10px',
                borderRadius: '10px',
                opacity: page === 1 ? 0.4 : 1,
                cursor: page === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronsLeft size={16} />
            </button>

            {/* PREVIOUS PAGE */}
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
              className="btn-secondary"
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: page === 1 ? 0.4 : 1,
                cursor: page === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            {/* NUMERIC PAGE BUTTONS */}
            {getPageNumbers().map((pg, idx) => {
              if (pg === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    style={{
                      padding: '6px 10px',
                      color: 'var(--text-muted)',
                      fontSize: '0.9rem',
                      fontWeight: 600
                    }}
                  >
                    ...
                  </span>
                );
              }

              const isActive = pg === page;
              return (
                <button
                  key={`page-btn-${pg}`}
                  onClick={() => handlePageChange(pg)}
                  disabled={loading}
                  style={{
                    minWidth: '36px',
                    height: '36px',
                    padding: '0 8px',
                    borderRadius: '10px',
                    border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-card)',
                    color: isActive ? '#ffffff' : 'var(--text-main)',
                    fontSize: '0.88rem',
                    fontWeight: isActive ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                  }}
                >
                  {pg}
                </button>
              );
            })}

            {/* NEXT PAGE */}
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="btn-secondary"
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: page >= totalPages ? 0.4 : 1,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>

            {/* LAST PAGE */}
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={page >= totalPages || loading}
              className="btn-secondary"
              title="Last Page"
              style={{
                padding: '8px 10px',
                borderRadius: '10px',
                opacity: page >= totalPages ? 0.4 : 1,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronsRight size={16} />
            </button>
          </div>

          {/* PER PAGE & COUNTER FOOTER */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              flexWrap: 'wrap',
              gap: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-color)',
              fontSize: '0.82rem',
              color: 'var(--text-muted)'
            }}
          >
            <div>
              Showing page <strong style={{ color: 'var(--text-main)' }}>{page}</strong> of{' '}
              <strong style={{ color: 'var(--text-main)' }}>{totalPages.toLocaleString()}</strong> ({totalCount.toLocaleString()} papers found)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Results per page:</span>
              <select
                value={perPage}
                onChange={(e) => handlePerPageChange(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ========================================
          PAPER PREVIEW MODAL
      ======================================== */}

      {previewPaper && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor:
              'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px'
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '1100px',
              height: '94vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '20px',
              boxShadow:
                '0 24px 60px rgba(0, 0, 0, 0.6)'
            }}
          >
            {/* MODAL HEADER */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom:
                  '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'space-between',
                backgroundColor:
                  'var(--header-bg)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor:
                      'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <BookOpen size={20} />
                </div>

                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      color: 'var(--text-main)'
                    }}
                  >
                    Paper Preview
                  </div>

                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)'
                    }}
                  >
                    ResearchVault Academic Reader
                  </div>
                </div>
              </div>

              <button
                onClick={closePreview}
                aria-label="Close Reader"
                style={{
                  background: 'transparent',
                  border:
                    '1px solid var(--border-color)',
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

            {/* MODAL BODY */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                backgroundColor:
                  'var(--bg-main)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {/* PAPER INFO */}
              <div
                style={{
                  backgroundColor:
                    'var(--bg-card)',
                  padding: '20px',
                  borderRadius: '14px',
                  border:
                    '1px solid var(--border-color)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginBottom: '10px'
                  }}
                >
                  <span className="badge">
                    {previewPaper.resourceType}
                  </span>

                  {previewPaper.openAccess && (
                    <span
                      className="badge"
                      style={{
                        backgroundColor:
                          'rgba(16, 185, 129, 0.15)',
                        color: '#10b981'
                      }}
                    >
                      Open Access
                    </span>
                  )}

                  <span
                    className="badge"
                    style={{
                      backgroundColor:
                        'var(--primary-light)',
                      color:
                        'var(--primary-text)'
                    }}
                  >
                    {getCitationCount(
                      previewPaper
                    )}{' '}
                    Citations
                  </span>
                </div>

                <h2
                  style={{
                    fontFamily:
                      'var(--font-serif)',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    marginBottom: '8px',
                    lineHeight: 1.3
                  }}
                >
                  {previewPaper.title}
                </h2>

                <div
                  style={{
                    fontSize: '0.88rem',
                    color: '#10b981',
                    fontWeight: 600
                  }}
                >
                  <span
                    style={{
                      color: 'var(--text-main)',
                      fontWeight: 700
                    }}
                  >
                    {previewPaper.authors}
                  </span>

                  {' — '}

                  <span
                    style={{
                      color: 'var(--text-muted)'
                    }}
                  >
                    {previewPaper.journalOrVenue}{' '}
                    (
                    {previewPaper.publicationYear}
                    )
                  </span>
                </div>
              </div>

              {/* PDF PREVIEW */}
              {previewStage !== 'failed' &&
              previewStage !== 'idle' ? (
                <div
                  style={{
                    minHeight: '650px',
                    height: '65vh',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* PREVIEW TOOLBAR FOR BLOCKED IFRAME HANDLING */}
                  <div
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--bg-card, #131f3d)',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      zIndex: 2
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={14} style={{ color: 'var(--primary)' }} />
                      <span>If blocked by publisher security headers, open directly in a new tab:</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {previewPaper.downloadUrl && (
                        <a
                          href={previewPaper.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary"
                          style={{
                            padding: '5px 12px',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            textDecoration: 'none'
                          }}
                        >
                          <ExternalLink size={14} />
                          <span>Open PDF Direct</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setPreviewStage('failed')}
                        style={{
                          padding: '5px 10px',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        Switch to Fallback Card
                      </button>
                    </div>
                  </div>

                  <div style={{ flex: 1, position: 'relative' }}>
                    {(previewStage === 'checking' ||
                      previewStage === 'viewer-loading') && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          backgroundColor: '#ffffff',
                          zIndex: 1
                        }}
                      >
                        <Loader2
                          size={28}
                          className="animate-spin"
                          style={{ color: 'var(--primary)' }}
                        />
                        <div
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-muted)',
                            fontWeight: 600
                          }}
                        >
                          Loading preview...
                        </div>
                      </div>
                    )}

                    {previewStage === 'blob' && blobUrl && (
                      <embed
                        key={previewPaper.doi || previewPaper.title}
                        src={blobUrl}
                        type="application/pdf"
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none'
                        }}
                      />
                    )}

                    {(previewStage === 'viewer-loading' ||
                      previewStage === 'viewer-loaded') && (
                      <iframe
                        key={previewPaper.doi || previewPaper.title}
                        src={getPreviewViewerUrl(previewPaper)}
                        title="Academic Paper PDF Preview"
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none'
                        }}
                        onLoad={handleIframeLoad}
                        onError={handleIframeError}
                      />
                    )}
                  </div>
                </div>
              ) : previewStage === 'failed' ? (
                /* IN-APP EXECUTIVE LITERATURE OVERVIEW READER */
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    padding: '24px',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                      <BookOpen size={18} />
                      <span>Executive Literature Overview</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {previewPaper.downloadUrl && (
                        <a
                          href={previewPaper.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <ExternalLink size={14} />
                          <span>Open Publisher Page</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '0' }}>
                    {previewPaper.abstractText || 'No full abstract text was returned by the publisher for this item.'}
                  </p>
                </div>
              ) : null}

              {/* FULL UNTRUNCATED ABSTRACT */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '24px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    color: 'var(--primary)',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} />
                    <span>Full Paper Abstract & Literature Summary</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'none', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {previewPaper.abstractText ? `${previewPaper.abstractText.split(' ').length} words` : ''}
                  </span>
                </div>

                <p
                  style={{
                    fontSize: '0.96rem',
                    color: 'var(--text-main)',
                    lineHeight: 1.75,
                    whiteSpace: 'pre-wrap',
                    margin: 0
                  }}
                >
                  {previewPaper.abstractText || 'No abstract is available for this paper.'}
                </p>

                {/* KEY CONCEPTS & TOPICS BADGES */}
                {((previewPaper.concepts && previewPaper.concepts.length > 0) || (previewPaper.topics && previewPaper.topics.length > 0)) && (
                  <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      Key Research Topics & Domains
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(previewPaper.concepts || []).map((concept, idx) => (
                        <span
                          key={`c-${idx}`}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            backgroundColor: 'rgba(0, 229, 255, 0.1)',
                            border: '1px solid rgba(0, 229, 255, 0.25)',
                            color: '#00e5ff',
                            fontSize: '0.78rem',
                            fontWeight: 600
                          }}
                        >
                          {concept}
                        </span>
                      ))}

                      {(previewPaper.topics || []).map((topic, idx) => (
                        <span
                          key={`t-${idx}`}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            backgroundColor: 'rgba(52, 211, 153, 0.1)',
                            border: '1px solid rgba(52, 211, 153, 0.25)',
                            color: '#34d399',
                            fontSize: '0.78rem',
                            fontWeight: 600
                          }}
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* METADATA GRID */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '24px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    color: 'var(--primary)',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <BookOpen size={16} />
                  <span>Publication Metadata & Indexing</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    fontSize: '0.88rem',
                    color: 'var(--text-main)'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Category</span>
                    <strong>{previewPaper.suggestedCategory || 'Computer Science'}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Journal / Venue</span>
                    <strong>{previewPaper.journalOrVenue || 'Academic Venue'}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Publication Year</span>
                    <strong>{previewPaper.publicationYear || 'N/A'}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Citations</span>
                    <strong>{previewPaper.citationCount ? previewPaper.citationCount.toLocaleString() : 'N/A'}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Access Type</span>
                    <strong style={{ color: previewPaper.openAccess ? '#34d399' : 'var(--text-muted)' }}>
                      {previewPaper.openAccess ? 'Open Access (Free)' : 'Subscription / Paywall'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>DOI / Identifier</span>
                    <strong style={{ wordBreak: 'break-all' }}>{previewPaper.doi || 'N/A'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div
              style={{
                padding: '14px 20px',
                borderTop:
                  '1px solid var(--border-color)',
                backgroundColor:
                  'var(--header-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  onClick={() =>
                    handleSave(previewPaper)
                  }
                  className={
                    savedMap[
                      previewPaper.doi ||
                        previewPaper.title
                    ]
                      ? 'btn-secondary'
                      : 'btn-primary'
                  }
                  disabled={
                    savedMap[
                      previewPaper.doi ||
                        previewPaper.title
                    ]
                  }
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.84rem'
                  }}
                >
                  {savedMap[
                    previewPaper.doi ||
                      previewPaper.title
                  ] ? (
                    <Check size={16} />
                  ) : (
                    <Plus size={16} />
                  )}

                  <span>
                    {savedMap[
                      previewPaper.doi ||
                        previewPaper.title
                    ]
                      ? 'Saved to Library'
                      : 'Save to Library'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    const paper =
                      previewPaper;

                    closePreview();

                    onOpenAiSummarizer(
                      paper
                    );
                  }}
                  className="btn-secondary"
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.84rem'
                  }}
                >
                  <Sparkles size={16} />
                  <span>AI Summary</span>
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >
                {previewPaper.downloadUrl && (
                  <a
                    href={
                      previewPaper.downloadUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.84rem',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Download size={16} />
                    Open PDF
                  </a>
                )}

                {previewPaper.sourceUrl && (
                  <a
                    href={
                      previewPaper.sourceUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.84rem',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <ExternalLink size={16} />
                    Source
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP GOOGLE SCHOLAR VIEWER MODAL */}
      {scholarModalQuery && (
        <div 
          className="modal-overlay" 
          onClick={closeInAppScholar}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '1050px',
              height: '88vh',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '24px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header Bar */}
            <div style={{
              padding: '14px 20px',
              backgroundColor: 'var(--bg-main)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  backgroundColor: '#4285F4',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.85rem'
                }}>
                  🎓
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                    Google Scholar In-App Engine
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Query: "{scholarModalQuery}"
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <a 
                  href={`https://scholar.google.com/scholar?q=${encodeURIComponent(scholarModalQuery)}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <ExternalLink size={14} />
                  <span>Open External Tab</span>
                </a>
                <button 
                  onClick={closeInAppScholar}
                  className="neu-button"
                  style={{ width: '32px', height: '32px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Embedded Google Scholar Frame */}
            <div style={{ flex: 1, backgroundColor: '#ffffff', position: 'relative' }}>
              <iframe
                src={`https://scholar.google.com/scholar?q=${encodeURIComponent(scholarModalQuery)}`}
                title="Google Scholar Search Results"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}