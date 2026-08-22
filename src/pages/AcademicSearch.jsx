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
  Award,
  ArrowUpDown,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

import { searchAcademicSources, isDirectPdfUrl } from '../services/academicSearch';
import Modal from '../components/Modal';

export default function AcademicSearch({
  initialQuery,
  onAddResource,
  onOpenAiSummarizer
}) {
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedMap, setSavedMap] = useState({});
  const [sortBy, setSortBy] = useState('relevance');
  
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
        gap: 'var(--space-6)'
      }}
    >
      {/* PAGE HEADER */}
      <div>
        <h1 className="page-title">Academic Search</h1>
        <p className="page-subtitle">
          Search Semantic Scholar, OpenAlex, Crossref and arXiv by title, author, keyword or DOI.
        </p>
      </div>

      {/* SEARCH SECTION */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)'
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
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
              size={18}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }}
            />

            <label htmlFor="academic-search-query" className="sr-only">
              Search academic papers by author, title, keyword or DOI
            </label>
            <input
              id="academic-search-query"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Author, title, keyword or DOI…"
              style={{
                width: '100%',
                padding: '12px 16px 12px 42px',
                minHeight: '46px',
                backgroundColor: 'var(--bg-card)',
                fontSize: 'var(--text-lg)'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ padding: '0 22px', minHeight: '46px', flexShrink: 0 }}
          >
            {loading ? (
              <Loader2 size={18} aria-hidden="true" className="animate-spin" />
            ) : (
              <Search size={18} aria-hidden="true" />
            )}
            <span>Search</span>
          </button>

          {/* Was a bespoke pill with an emoji mortarboard. It is an ordinary
              secondary action that opens a new tab, so it looks like one. */}
          <button
            type="button"
            onClick={() => {
              const q = query.trim() || 'artificial intelligence';
              window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer');
            }}
            className="btn-secondary"
            style={{ padding: '0 16px', minHeight: '46px', flexShrink: 0 }}
            title="Search this query on Google Scholar in a new tab"
          >
            <ExternalLink size={15} aria-hidden="true" />
            <span>Google Scholar</span>
          </button>
        </form>

        {/* SORTING */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)'
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-md)',
              color: 'var(--text-muted)'
            }}
            role="status"
          >
            {loading ? (
              'Searching…'
            ) : totalCount > 0 ? (
              <span>
                <strong style={{ color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{(page - 1) * perPage + 1}–{Math.min(page * perPage, totalCount)}</strong>
                {' of '}
                <strong style={{ color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{totalCount.toLocaleString()}</strong>
                {` papers · page ${page} of ${totalPages || 1}`}
              </span>
            ) : (
              `${results.length} papers`
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              flexWrap: 'wrap'
            }}
          >
            <span className="overline" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ArrowUpDown size={13} aria-hidden="true" />
              Sort
            </span>

            {/* A segmented control now, so "which sort is active" is one
                consistent affordance shared with the reader and review tabs. */}
            <div className="segmented" role="group" aria-label="Sort results by">
              {[
                { id: 'relevance', label: 'Relevance' },
                { id: 'newest', label: 'Newest' },
                { id: 'citations', label: 'Most cited' },
                { id: 'openaccess', label: 'Open access' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className="segmented-item"
                  onClick={() => handleSortChange(tab.id)}
                  aria-pressed={sortBy === tab.id}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH RESULTS */}
      {loading ? (
        <div
          className="glass-card"
          style={{
            padding: 'var(--space-10)',
            textAlign: 'center'
          }}
          role="status"
        >
          <Loader2
            size={26}
            aria-hidden="true"
            className="animate-spin"
            style={{ margin: '0 auto var(--space-3)', color: 'var(--text-muted)' }}
          />

          <div className="section-title">Searching academic catalogues…</div>

          <div
            style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-muted)',
              marginTop: '4px'
            }}
          >
            Querying OpenAlex and Crossref metadata services
          </div>
        </div>
      ) : sortedResults.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: 'var(--space-10) var(--space-5)',
            textAlign: 'center'
          }}
        >
          <div className="section-title" style={{ marginBottom: '6px' }}>No papers found</div>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>
            {query ? <>Nothing matched “{query}”. Try fewer or broader terms.</> : 'Enter a search above to begin.'}
          </div>
        </div>
      ) : (
        <div
          ref={resultsRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)'
          }}
        >
          {sortedResults.map((item, idx) => {
            const paperKey = item.doi || item.title;
            const isSaved = savedMap[paperKey];

            return (
              /* The 4px --primary left border used to run down every single
                 result, which made the action colour the most repeated element
                 on the page and marked nothing in particular. Results are
                 separated by the card border alone now. */
              <div
                key={`${paperKey}-${idx}`}
                className="glass-card"
                style={{
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)'
                }}
              >
                {/* PAPER HEADER */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginBottom: 'var(--space-2)'
                    }}
                  >
                    <span className="badge">{item.resourceType}</span>

                    {hasPdf(item) && (
                      <span className="badge badge-success">PDF available</span>
                    )}

                    <span className="badge badge-quiet">
                      {item.suggestedCategory}
                    </span>
                  </div>

                  <h3>
                    <button
                      type="button"
                      className="text-button wrap-title"
                      onClick={() => openPreview(item)}
                      aria-label={`Preview "${item.title}"`}
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '1.1875rem',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        lineHeight: 1.3,
                        letterSpacing: '-0.008em'
                      }}
                    >
                      {item.title}
                    </button>
                  </h3>

                  {/* The author line was painted #10b981 — an emerald that
                      belongs to no theme and meant nothing here. Authors are
                      the emphasis; venue and year are the subordinate detail. */}
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-muted)',
                      marginTop: '6px',
                      lineHeight: 'var(--leading-snug)'
                    }}
                  >
                    <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                      {item.authors}
                    </span>
                    {' — '}
                    <span style={{ fontStyle: 'italic' }}>
                      {item.journalOrVenue}
                    </span>
                    {item.publicationYear ? `, ${item.publicationYear}` : ''}
                  </div>
                </div>

                {/* ABSTRACT */}
                <p
                  style={{
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-main)',
                    lineHeight: 'var(--leading-normal)',
                    maxWidth: '86ch',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {item.abstractText || 'No abstract available.'}
                </p>

                {/* ACTION BAR */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                    paddingTop: 'var(--space-3)',
                    borderTop: '1px solid var(--border-color)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                      flexWrap: 'wrap',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Award size={13} aria-hidden="true" />
                      Cited by <strong style={{ color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{getCitationCount(item)}</strong>
                    </span>

                    <span style={{ wordBreak: 'break-all' }}>
                      DOI: {item.doi || 'N/A'}
                    </span>
                  </div>

                  {/* Save is the one primary action. "Open PDF" used to be a
                      second filled button on the same row, so every result
                      offered two equally-weighted "main" actions. */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                      alignItems: 'center'
                    }}
                  >
                    <button
                      onClick={() => handleSave(item)}
                      className={isSaved ? 'btn-secondary' : 'btn-primary'}
                      disabled={isSaved}
                    >
                      {isSaved ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
                      <span>{isSaved ? 'Saved' : 'Save to vault'}</span>
                    </button>

                    <button
                      onClick={() => openPreview(item)}
                      className="btn-secondary"
                    >
                      <Eye size={15} aria-hidden="true" />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={() => onOpenAiSummarizer(item)}
                      className="btn-secondary"
                    >
                      <Sparkles size={15} aria-hidden="true" />
                      <span>AI summary</span>
                    </button>

                    {item.downloadUrl && (
                      <a
                        href={item.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="icon-button"
                        title="Open PDF in a new tab"
                        aria-label={`Open the PDF of "${item.title}" in a new tab`}
                        style={{ textDecoration: 'none' }}
                      >
                        <Download size={16} aria-hidden="true" />
                      </a>
                    )}

                    <a
                      href={`https://scholar.google.com/scholar?q=${encodeURIComponent(item.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="icon-button"
                      title="Find this paper on Google Scholar"
                      aria-label={`Find "${item.title}" on Google Scholar`}
                      style={{ textDecoration: 'none' }}
                    >
                      <ExternalLink size={16} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SEARCH RESULTS PAGINATION */}
      {totalPages > 1 && (
        <nav
          aria-label="Search results pages"
          className="glass-card"
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-4)'
          }}
        >
          {/* PAGE CONTROLS BAR */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              flexWrap: 'wrap'
            }}
          >
            {/* FIRST PAGE */}
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              disabled={page === 1 || loading}
              className="icon-button"
              title="First page"
              aria-label="Go to first page of results"
            >
              <ChevronsLeft size={16} aria-hidden="true" />
            </button>

            {/* PREVIOUS PAGE */}
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
              className="btn-secondary"
              style={{ padding: '7px 13px', minHeight: '34px' }}
            >
              <ChevronLeft size={15} aria-hidden="true" />
              <span>Previous</span>
            </button>

            {/* NUMERIC PAGE BUTTONS.
                The active page used to switch from a 1px to a 2px border,
                which nudged its digit by a pixel every time you paged. Same
                border width now; the fill carries the state. */}
            {getPageNumbers().map((pg, idx) => {
              if (pg === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    aria-hidden="true"
                    style={{
                      padding: '6px 8px',
                      color: 'var(--text-muted)',
                      fontSize: 'var(--text-md)'
                    }}
                  >
                    …
                  </span>
                );
              }

              const isActive = pg === page;
              return (
                <button
                  key={`page-btn-${pg}`}
                  type="button"
                  onClick={() => handlePageChange(pg)}
                  disabled={loading}
                  aria-label={`Page ${pg}`}
                  aria-current={isActive ? 'page' : undefined}
                  style={{
                    minWidth: '34px',
                    height: '34px',
                    padding: '0 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--primary)' : 'var(--border-color)',
                    backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-main)',
                    fontSize: 'var(--text-md)',
                    fontWeight: isActive ? 700 : 500,
                    fontVariantNumeric: 'tabular-nums',
                    cursor: 'pointer'
                  }}
                >
                  {pg}
                </button>
              );
            })}

            {/* NEXT PAGE */}
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="btn-secondary"
              style={{ padding: '7px 13px', minHeight: '34px' }}
            >
              <span>Next</span>
              <ChevronRight size={15} aria-hidden="true" />
            </button>

            {/* LAST PAGE */}
            <button
              type="button"
              onClick={() => handlePageChange(totalPages)}
              disabled={page >= totalPages || loading}
              className="icon-button"
              title="Last page"
              aria-label="Go to last page of results"
            >
              <ChevronsRight size={16} aria-hidden="true" />
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
              gap: 'var(--space-3)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--border-color)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)'
            }}
          >
            <div>
              Page <strong style={{ color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{page}</strong> of{' '}
              <strong style={{ color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{totalPages.toLocaleString()}</strong>
              {' · '}{totalCount.toLocaleString()} papers
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <label htmlFor="search-per-page">Per page</label>
              <select
                id="search-per-page"
                value={perPage}
                onChange={(e) => handlePerPageChange(e.target.value)}
                style={{
                  padding: '5px 8px',
                  minHeight: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-card)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer'
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </nav>
      )}

      {/* ========================================
          PAPER PREVIEW MODAL
      ======================================== */}

      {previewPaper && (
        <Modal
          onClose={closePreview}
          labelledBy="paper-preview-title"
          zIndex={300}
          overlayStyle={{ padding: 'var(--space-3)' }}
          panelClassName="glass-card"
          panelStyle={{
            width: '100%',
            maxWidth: '1000px',
            height: '94vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-overlay)'
          }}
        >
            {/* MODAL HEADER.
                Dropped the tinted icon chip: the heading already says what
                this dialog is. */}
            <div
              style={{
                padding: 'var(--space-4) var(--space-5)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                backgroundColor: 'var(--bg-card)',
                flexShrink: 0
              }}
            >
              <div>
                <h2
                  id="paper-preview-title"
                  style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text-main)' }}
                >
                  Paper preview
                </h2>
                <div className="overline">Academic reader</div>
              </div>

              <button
                type="button"
                onClick={closePreview}
                className="icon-button"
                aria-label="Close paper preview"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* MODAL BODY */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 'var(--space-5)',
                backgroundColor: 'var(--bg-main)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)'
              }}
            >
              {/* PAPER INFO */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: 'var(--space-5)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap',
                    marginBottom: 'var(--space-3)'
                  }}
                >
                  <span className="badge">
                    {previewPaper.resourceType}
                  </span>

                  {previewPaper.openAccess && (
                    <span className="badge badge-success">
                      Open access
                    </span>
                  )}

                  <span className="badge badge-quiet">
                    {getCitationCount(previewPaper)} citations
                  </span>
                </div>

                <h2
                  className="wrap-title"
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.375rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    marginBottom: 'var(--space-2)',
                    lineHeight: 1.28,
                    letterSpacing: '-0.01em'
                  }}
                >
                  {previewPaper.title}
                </h2>

                <div
                  style={{
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-muted)',
                    lineHeight: 'var(--leading-snug)'
                  }}
                >
                  <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                    {previewPaper.authors}
                  </span>
                  {' — '}
                  <span style={{ fontStyle: 'italic' }}>{previewPaper.journalOrVenue}</span>
                  {previewPaper.publicationYear ? ` (${previewPaper.publicationYear})` : ''}
                </div>
              </div>

              {/* PDF PREVIEW */}
              {previewStage !== 'failed' &&
              previewStage !== 'idle' ? (
                <div
                  style={{
                    minHeight: '520px',
                    height: '65vh',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* PREVIEW TOOLBAR FOR BLOCKED IFRAME HANDLING */}
                  <div
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      backgroundColor: 'var(--bg-card)',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      flexWrap: 'wrap',
                      zIndex: 2
                    }}
                  >
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={13} aria-hidden="true" />
                      <span>Blocked by the publisher? Open it directly instead.</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {previewPaper.downloadUrl && (
                        <a
                          href={previewPaper.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{
                            padding: '5px 11px',
                            minHeight: '30px',
                            fontSize: 'var(--text-xs)',
                            textDecoration: 'none'
                          }}
                        >
                          <ExternalLink size={13} aria-hidden="true" />
                          <span>Open PDF</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setPreviewStage('failed')}
                        className="btn-secondary"
                        style={{ padding: '5px 11px', minHeight: '30px', fontSize: 'var(--text-xs)' }}
                      >
                        Show abstract instead
                      </button>
                    </div>
                  </div>

                  <div style={{ flex: 1, position: 'relative' }}>
                    {(previewStage === 'checking' ||
                      previewStage === 'viewer-loading') && (
                      <div
                        role="status"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 'var(--space-2)',
                          backgroundColor: 'var(--bg-card)',
                          zIndex: 1
                        }}
                      >
                        <Loader2
                          size={24}
                          aria-hidden="true"
                          className="animate-spin"
                          style={{ color: 'var(--text-muted)' }}
                        />
                        <div style={{ fontSize: 'var(--text-md)', color: 'var(--text-muted)' }}>
                          Loading preview…
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
                /* Abstract-only fallback. This used to duplicate the full
                   abstract that the section immediately below already prints,
                   so it now only carries the explanation and the publisher
                   link — no second copy of the same paragraph. */
                <div className="notice" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <AlertCircle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                    No embeddable PDF was available — the abstract is below.
                  </span>

                  {previewPaper.downloadUrl && (
                    <a
                      href={previewPaper.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                      style={{ textDecoration: 'none', padding: '6px 12px', minHeight: '32px', fontSize: 'var(--text-xs)' }}
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                      <span>Publisher page</span>
                    </a>
                  )}
                </div>
              ) : null}

              {/* FULL UNTRUNCATED ABSTRACT */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: 'var(--space-5)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div
                  style={{
                    marginBottom: 'var(--space-3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    flexWrap: 'wrap'
                  }}
                >
                  <span className="overline">Abstract</span>
                  {previewPaper.abstractText && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {previewPaper.abstractText.split(/\s+/).length} words
                    </span>
                  )}
                </div>

                {/* Reading column: the abstract is prose, so it gets a measure
                    and a text serif rather than running the full 1000px width
                    of the dialog in the UI sans. */}
                <p
                  className="reading-column"
                  style={{
                    fontSize: '1.0625rem',
                    color: 'var(--text-main)',
                    whiteSpace: 'pre-wrap',
                    margin: 0
                  }}
                >
                  {previewPaper.abstractText || 'No abstract is available for this paper.'}
                </p>

                {/* KEY CONCEPTS & TOPICS.
                    Concepts were neon cyan chips and topics were mint green —
                    two saturated colours that encoded nothing beyond "this came
                    from a different array". They are one neutral chip style. */}
                {((previewPaper.concepts && previewPaper.concepts.length > 0) || (previewPaper.topics && previewPaper.topics.length > 0)) && (
                  <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
                    <div className="overline" style={{ marginBottom: 'var(--space-3)' }}>
                      Research topics
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {[...(previewPaper.concepts || []), ...(previewPaper.topics || [])].map((term, i) => (
                        <span key={`term-${i}`} className="badge badge-quiet">
                          {term}
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
                  padding: 'var(--space-5)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div className="overline" style={{ marginBottom: 'var(--space-4)' }}>
                  Publication metadata
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 'var(--space-4)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-main)'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Category</span>
                    <strong style={{ fontWeight: 600 }}>{previewPaper.suggestedCategory || '—'}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Journal / venue</span>
                    <strong style={{ fontWeight: 600 }}>{previewPaper.journalOrVenue || '—'}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Year</span>
                    <strong style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{previewPaper.publicationYear || '—'}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Citations</span>
                    <strong style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{previewPaper.citationCount ? previewPaper.citationCount.toLocaleString() : '—'}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Access</span>
                    <strong style={{ fontWeight: 600, color: previewPaper.openAccess ? 'var(--success)' : 'var(--text-main)' }}>
                      {previewPaper.openAccess ? 'Open access' : 'Subscription'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>DOI</span>
                    <strong style={{ fontWeight: 600, wordBreak: 'break-all' }}>{previewPaper.doi || '—'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-5)',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleSave(previewPaper)}
                  className={savedMap[previewPaper.doi || previewPaper.title] ? 'btn-secondary' : 'btn-primary'}
                  disabled={savedMap[previewPaper.doi || previewPaper.title]}
                >
                  {savedMap[previewPaper.doi || previewPaper.title]
                    ? <Check size={15} aria-hidden="true" />
                    : <Plus size={15} aria-hidden="true" />}
                  <span>
                    {savedMap[previewPaper.doi || previewPaper.title] ? 'Saved to library' : 'Save to library'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    const paper = previewPaper;
                    closePreview();
                    onOpenAiSummarizer(paper);
                  }}
                  className="btn-secondary"
                >
                  <Sparkles size={15} aria-hidden="true" />
                  <span>AI summary</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {previewPaper.downloadUrl && (
                  <a
                    href={previewPaper.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    <Download size={15} aria-hidden="true" />
                    <span>Open PDF</span>
                  </a>
                )}

                {previewPaper.sourceUrl && (
                  <a
                    href={previewPaper.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                    <span>Source</span>
                  </a>
                )}
              </div>
            </div>
        </Modal>
      )}

      {/* IN-APP GOOGLE SCHOLAR VIEWER MODAL */}
      {scholarModalQuery && (
        <Modal
          onClose={closeInAppScholar}
          label={`Google Scholar results for ${scholarModalQuery}`}
          zIndex={1000}
          overlayStyle={{ padding: 'var(--space-4)' }}
          panelClassName=""
          panelStyle={{
            width: '100%',
            maxWidth: '1000px',
            height: '88vh',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-overlay)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
            {/* Header Bar */}
            <div style={{
              padding: 'var(--space-3) var(--space-5)',
              backgroundColor: 'var(--bg-card)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              flexShrink: 0
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text-main)' }}>
                  Google Scholar
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  “{scholarModalQuery}”
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <a
                  href={`https://scholar.google.com/scholar?q=${encodeURIComponent(scholarModalQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ padding: '6px 12px', minHeight: '32px', fontSize: 'var(--text-xs)', textDecoration: 'none' }}
                >
                  <ExternalLink size={13} aria-hidden="true" />
                  <span>Open in new tab</span>
                </a>
                <button
                  type="button"
                  onClick={closeInAppScholar}
                  className="icon-button"
                  aria-label="Close Google Scholar viewer"
                >
                  <X size={18} aria-hidden="true" />
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
        </Modal>
      )}
    </div>
  );
}