import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles, Bookmark, FileText, ChevronLeft, ChevronRight, Plus, Send, Download, ExternalLink, FileCode, ShieldCheck, X, Loader2, Copy, Check, BookmarkPlus, FileSearch, Trash2, RefreshCw } from 'lucide-react';
import { storage } from '../services/storage';
import { generatePaperSummary, askPaperQuestion, generatePeerReview } from '../services/geminiService';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';
import { resolvePdfSource } from '../services/pdfResolver';
import MarkdownMessage from '../components/MarkdownMessage';
import { useConfirm, useAnnounce } from '../components/FeedbackProvider';

const PLACEHOLDER_TEXT = 'Imported paper document in ResearchVault digital library.';

function useIsSmallScreen(breakpoint = 880) {
  const [isSmall, setIsSmall] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsSmall(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, [breakpoint]);
  return isSmall;
}

export default function DocumentReader({ resource, onClose, onDeleteResource }) {
  const [currentPage, setCurrentPage] = useState(resource.lastPageRead || 1);
  const [fontSize, setFontSize] = useState(16);
  const [readerTheme, setReaderTheme] = useState('light');
  const [notes, setNotes] = useState([]);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [newNote, setNewNote] = useState('');
  const confirm = useConfirm();
  const announce = useAnnounce();
  const readerRef = useRef(null);
  const restoreFocusRef = useRef(null);

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiSummaryType, setAiSummaryType] = useState('Executive Summary');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummaryResult, setAiSummaryResult] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState([]);
  const [aiCopied, setAiCopied] = useState(false);
  const [aiExtractingText, setAiExtractingText] = useState(false);
  const resolvedContentRef = useRef(null);
  const aiChatEndRef = useRef(null);
  const isExtractingPdfTextRef = useRef(false);

  const aiSummaryTypes = ['Executive Summary', 'Key Takeaways', 'Methodology & Proofs', 'Limitations & Critique', 'Peer Review'];

  const [extractedFullText, setExtractedFullText] = useState(resource.fullText || '');
  const [isExtractingPdfText, setIsExtractingPdfText] = useState(false);
  const extractedFullTextRef = useRef(resource.fullText || '');
  useEffect(() => { isExtractingPdfTextRef.current = isExtractingPdfText; }, [isExtractingPdfText]);
  useEffect(() => { extractedFullTextRef.current = extractedFullText; }, [extractedFullText]);

  const isSmallScreen = useIsSmallScreen(880);
  const hasPdfSource = Boolean(
    resource.pdfFileData ||
    resource.downloadUrl ||
    resource.resolvedPdfUrl ||
    resource.sourceUrl ||
    resource.doi
  );
  
  const hasRealText = Boolean(
    extractedFullText &&
    extractedFullText.trim().length > 40 &&
    extractedFullText.trim() !== PLACEHOLDER_TEXT &&
    !extractedFullText.toLowerCase().includes('imported paper document in researchvault') &&
    extractedFullText.trim() !== (resource.abstractText || '').trim()
  );

  const rawPaperText = extractedFullText || resource.fullText || resource.abstractText || '';
  const isAbstractOnly = !hasRealText || (rawPaperText || '').length < 800 || rawPaperText === (resource.abstractText || '').trim();

  // A locally uploaded PDF always renders, and it is the thing the user just
  // handed us — open on it. Remote sources (DOI / search imports) still start on
  // the extracted text, because resolving those can fail and an abstract is a
  // better landing state than a retry card.
  const [viewMode, setViewMode] = useState(resource.pdfFileData ? 'pdf' : 'page');

  // `hasPdf` survives both sync and the quota eviction in storage.saveResources;
  // the bytes do not. So this covers a paper added on another device and one
  // whose attachment was dropped locally to make room.
  const pdfMissingLocally = Boolean(resource.hasPdf && !resource.pdfFileData && !hasPdfSource);

  const [readerState, setReaderState] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('Finding the PDF...');
  const [pdfUint8Data, setPdfUint8Data] = useState(null);
  const [pdfMeta, setPdfMeta] = useState({ sourceType: '', resolvedUrl: null, sourceName: '' });

  const [pdfJsDoc, setPdfJsDoc] = useState(null);
  const [pdfJsNumPages, setPdfJsNumPages] = useState(0);
  const [pdfJsPageNum, setPdfJsPageNum] = useState(1);
  const [pdfJsScale, setPdfJsScale] = useState(1.2);
  const [pdfJsLoading, setPdfJsLoading] = useState(false);
  const [pdfJsError, setPdfJsError] = useState('');
  const pdfCanvasRef = useRef(null);
  const pdfRenderTaskRef = useRef(null);

  // Initialize PDF Acquisition Pipeline
  const loadPdfDocument = async () => {
    setReaderState('resolving');
    setPdfJsError('');
    try {
      const resolved = await resolvePdfSource(resource, (msg) => setStatusMessage(msg));
      setPdfUint8Data(resolved.data);
      setPdfMeta({
        sourceType: resolved.sourceType,
        resolvedUrl: resolved.resolvedUrl,
        sourceName: resolved.sourceName || ''
      });
      setReaderState('ready');
    } catch (err) {
      setReaderState('failed');
    }
  };

  useEffect(() => {
    if (hasPdfSource) {
      loadPdfDocument();
    }
  }, [resource.id, resource.downloadUrl, resource.pdfFileData, resource.sourceUrl, resource.doi]);

  // Render PDF via PDF.js when uint8 byte stream is ready
  useEffect(() => {
    let active = true;
    if (!pdfUint8Data || readerState !== 'ready') return;

    setPdfJsLoading(true);
    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        try {
          const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url);
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.href;
        } catch {
          const ver = pdfjsLib.version || '4.0.379';
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${ver}/pdf.worker.min.mjs`;
        }

        const doc = await pdfjsLib.getDocument({ data: pdfUint8Data.slice(0) }).promise;
        if (!active) return;
        setPdfJsDoc(doc);
        setPdfJsNumPages(doc.numPages);

        // Background text extraction for AI Assistant & Pages mode
        const storedFullText = (resource.fullText || '').trim();
        const needsFullText = !storedFullText || storedFullText === PLACEHOLDER_TEXT || storedFullText.toLowerCase().includes('imported paper document in researchvault');

        if (needsFullText) {
          setIsExtractingPdfText(true);
          const pdfFile = new File([pdfUint8Data.slice(0)], resource.pdfFileName || 'document.pdf', { type: 'application/pdf' });
          extractTextFromPdfFile(pdfFile)
            .then(extracted => {
              if (active && extracted && extracted.trim().length > 40) {
                const cleanText = extracted.trim();
                setExtractedFullText(cleanText);
                try {
                  storage.updateResource(resource.id, { fullText: cleanText });
                } catch (e) {}
              }
            })
            .finally(() => { if (active) setIsExtractingPdfText(false); });
        }
      } catch (err) {
        if (active) {
          setPdfJsError("Could not render PDF pages directly. Try opening the external source.");
        }
      } finally {
        if (active) setPdfJsLoading(false);
      }
    })();

    return () => { active = false; };
  }, [pdfUint8Data, readerState]);

  // Render PDF.js Canvas Page
  const safePdfPage = Math.min(Math.max(1, pdfJsPageNum), Math.max(1, pdfJsNumPages || 1));

  // `viewMode` is a dependency because the canvas only exists while PDF mode is
  // showing. The document usually finishes loading while the text view is
  // mounted, so this effect's first run finds a null ref and gives up — and
  // without viewMode here nothing re-runs it when the canvas finally appears,
  // leaving an empty canvas until the reader happens to change page or zoom.
  useEffect(() => {
    let cancelled = false;
    if (viewMode !== 'pdf' || !pdfJsDoc || !pdfCanvasRef.current) return;

    (async () => {
      try {
        if (pdfRenderTaskRef.current) {
          pdfRenderTaskRef.current.cancel();
        }
        const page = await pdfJsDoc.getPage(safePdfPage);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: pdfJsScale });
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const renderTask = page.render({ canvasContext: context, viewport });
        pdfRenderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        // Ignored when page changes quickly
      }
    })();

    return () => { cancelled = true; };
  }, [pdfJsDoc, safePdfPage, pdfJsScale, viewMode]);

  // Text Pagination
  const paperPages = React.useMemo(() => {
    if (!rawPaperText || !rawPaperText.trim() || rawPaperText === PLACEHOLDER_TEXT) {
      return ['No extracted text content available for this literature record.'];
    }

    const text = rawPaperText.trim();
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    if (paragraphs.length <= 1) {
      const chunks = [];
      for (let i = 0; i < text.length; i += 1500) {
        chunks.push(text.slice(i, i + 1500));
      }
      return chunks.length > 0 ? chunks : [text];
    }
    const pages = [];
    let currentPageText = '';
    for (const p of paragraphs) {
      if ((currentPageText + '\n\n' + p).length > 1600 && currentPageText.trim().length > 0) {
        pages.push(currentPageText.trim());
        currentPageText = p;
      } else {
        currentPageText = currentPageText ? currentPageText + '\n\n' + p : p;
      }
    }
    if (currentPageText.trim()) pages.push(currentPageText.trim());
    return pages.length > 0 ? pages : [text];
  }, [rawPaperText]);

  const totalPages = Math.max(1, paperPages.length);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const activePageText = paperPages[safeCurrentPage - 1] || paperPages[0] || '';
  const progressPercent = Math.round((safeCurrentPage / totalPages) * 100);

  useEffect(() => {
    storage.updateReadingProgress(resource.id, progressPercent, safeCurrentPage);
    setNotes(storage.getNotes(resource.id));
  }, [safeCurrentPage]);

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const updated = storage.addNote(resource.id, newNote.trim(), safeCurrentPage);
    setNotes(updated);
    setNewNote('');
  };

  const themeColors = readerTheme === 'dark' ? { bg: '#0f172a', text: '#f1f5f9' }
                    : readerTheme === 'sepia' ? { bg: '#faf0e6', text: '#3b2f2f' }
                    : { bg: '#ffffff', text: '#0f172a' };

  // AI Assistant Handlers
  const getResolvedContent = async () => {
    if (resolvedContentRef.current !== null) return resolvedContentRef.current;
    if (isExtractingPdfTextRef.current) {
      setAiExtractingText(true);
      for (let i = 0; i < 20 && isExtractingPdfTextRef.current; i++) {
        await new Promise(r => setTimeout(r, 250));
      }
      setAiExtractingText(false);
    }
    const content = extractedFullTextRef.current || resource.fullText || resource.abstractText || '';
    resolvedContentRef.current = content;
    return content;
  };

  const handleAiGenerateSummary = async (type) => {
    setAiLoading(true);
    setAiError('');
    setAiSummaryResult('');
    try {
      const content = await getResolvedContent();
      const res = type === 'Peer Review'
        ? await generatePeerReview(resource.title, resource.authors, resource.journal || '', content)
        : await generatePaperSummary(resource.title, resource.authors, content, type);
      setAiSummaryResult(res);
    } catch (err) {
      setAiError(err.message || 'Failed to generate AI summary.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpenAiPanel = () => {
    setShowAiPanel(true);
    setShowNotesDrawer(false);
    if (!aiSummaryResult && !aiLoading) {
      handleAiGenerateSummary(aiSummaryType);
    }
  };

  const handleAiAskQuestion = async (e) => {
    e.preventDefault();
    if (!aiQuestion.trim() || aiLoading) return;
    const q = aiQuestion.trim();
    setAiQuestion('');
    setAiLoading(true);
    try {
      const content = await getResolvedContent();
      const answer = await askPaperQuestion(resource.title, content, q);
      setAiChatHistory(prev => [...prev, { q, a: answer }]);
    } catch (err) {
      setAiError('Failed to answer AI question.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (aiChatEndRef.current) {
      aiChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiChatHistory, aiLoading]);

  // The reader is a full-screen dialog: it needs the same Escape-to-close,
  // focus-in / focus-restore and scroll-lock behaviour as the Modal shell.
  // (It can't reuse Modal directly because it renders its own full-bleed
  // chrome rather than a centred panel.)
  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => {
      if (readerRef.current) {
        try {
          readerRef.current.focus({ preventScroll: true });
        } catch (e) { /* unmounted between frames */ }
      }
    });

    announce(`Opened reader for ${resource.title}. Press Escape to close.`);

    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      // Let a nested confirm/alertdialog handle its own Escape first.
      if (document.querySelector('[role="alertdialog"]')) return;
      e.preventDefault();
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const previous = restoreFocusRef.current;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        try {
          previous.focus({ preventScroll: true });
        } catch (e) { /* opener already gone */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAiSaveNote = (text) => {
    storage.addNote(resource.id, text, safeCurrentPage);
    setNotes(storage.getNotes(resource.id));
  };

  // Shared by the mobile and desktop delete buttons. Replaces two identical
  // window.confirm() calls.
  const handleDeleteRequest = async () => {
    const ok = await confirm({
      title: 'Delete this paper?',
      message: `"${resource.title}" will be removed from your library, along with any notes attached to it. This cannot be undone.`,
      confirmLabel: 'Delete paper',
      cancelLabel: 'Keep it',
      tone: 'danger'
    });
    if (ok) {
      onDeleteResource(resource.id);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Reading: ${resource.title}`}
      ref={readerRef}
      tabIndex={-1}
      style={{ position: 'fixed', inset: 0, zIndex: 500, backgroundColor: themeColors.bg, color: themeColors.text, display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <header className="reader-mobile-header" style={{
        padding: isSmallScreen ? '8px 12px' : '10px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: isSmallScreen ? 'column' : 'row',
        alignItems: isSmallScreen ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: isSmallScreen ? '8px' : '12px',
        backgroundColor: 'var(--header-bg)',
        backdropFilter: 'blur(8px)',
        zIndex: 510
      }}>
        {/* Row 1: Back Arrow + Paper Title (1-line Ellipsis) + Theme & Delete on Mobile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <button type="button" onClick={onClose} title="Back to Library" aria-label="Close reader and return to library" style={{ color: 'inherit', padding: '6px', flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="reader-title-text" style={{
              fontWeight: 700,
              fontSize: isSmallScreen ? '0.88rem' : '0.95rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              wordBreak: 'normal',
              lineHeight: 1.2
            }}>
              {resource.title}
            </div>
            {!isSmallScreen && (
              <div style={{ fontSize: '0.72rem', opacity: 0.8, marginTop: '2px', whiteSpace: 'nowrap' }}>
                {viewMode === 'pdf' ? (pdfJsDoc ? `Page ${safePdfPage} of ${pdfJsNumPages}` : statusMessage) : `Page ${safeCurrentPage} of ${totalPages}`}
              </div>
            )}
          </div>

          {isSmallScreen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <label htmlFor="reader-theme-mobile" className="sr-only">Reader colour theme</label>
              <select id="reader-theme-mobile" value={readerTheme} onChange={(e) => setReaderTheme(e.target.value)} style={{ padding: '4px 6px', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'inherit' }}>
                <option value="light">☀️</option>
                <option value="sepia">📜</option>
                <option value="dark">🌙</option>
              </select>
              {onDeleteResource && (
                <button
                  type="button"
                  onClick={handleDeleteRequest}
                  title="Delete paper"
                  aria-label={`Delete "${resource.title}" from library`}
                  style={{
                    padding: '5px',
                    borderRadius: '8px',
                    color: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Row 2 (Mobile) / Right Actions (Desktop): Status Badge & Reader Mode Switcher */}
        <div className="reader-mobile-actions" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSmallScreen ? 'space-between' : 'flex-end',
          gap: '6px',
          flexShrink: 0,
          width: isSmallScreen ? '100%' : 'auto',
          borderTop: isSmallScreen ? '1px solid var(--border-color)' : 'none',
          paddingTop: isSmallScreen ? '6px' : 0
        }}>
          {isSmallScreen && (
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--primary)',
              whiteSpace: 'nowrap'
            }}>
              {viewMode === 'pdf' ? (pdfJsDoc ? `Page ${safePdfPage} of ${pdfJsNumPages}` : 'PDF Stream') : `Page ${safeCurrentPage} of ${totalPages}`}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            {hasPdfSource && (
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-card)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button onClick={() => setViewMode('pdf')} style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: viewMode === 'pdf' ? 'var(--primary)' : 'transparent', color: viewMode === 'pdf' ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>PDF</button>
                <button onClick={() => setViewMode('page')} style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: viewMode === 'page' ? 'var(--primary)' : 'transparent', color: viewMode === 'page' ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>Pages</button>
              </div>
            )}

            <button onClick={handleOpenAiPanel} className="btn-primary" style={{ padding: '5px 9px', fontSize: '0.78rem', backgroundColor: showAiPanel ? 'var(--secondary)' : undefined, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={14} /> <span className="btn-text">AI</span>
            </button>

            {(pdfMeta.resolvedUrl || resource.downloadUrl || resource.sourceUrl) && (
              <a href={pdfMeta.resolvedUrl || resource.downloadUrl || resource.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '5px', color: '#10b981', display: 'inline-flex', alignItems: 'center' }} title="Download PDF">
                <Download size={16} />
              </a>
            )}

            <button type="button" onClick={() => { setShowNotesDrawer(!showNotesDrawer); setShowAiPanel(false); }} style={{ padding: '5px', color: 'inherit', border: 'none', background: 'none', cursor: 'pointer' }} title="Notes" aria-label={showNotesDrawer ? 'Hide notes panel' : 'Show notes panel'} aria-expanded={showNotesDrawer}>
              <FileText size={16} aria-hidden="true" />
            </button>

            {!isSmallScreen && (
              <>
                {onDeleteResource && (
                  <button
                    type="button"
                    onClick={handleDeleteRequest}
                    title="Delete paper"
                    aria-label={`Delete "${resource.title}" from library`}
                    style={{
                      padding: '5px',
                      borderRadius: '8px',
                      color: '#ef4444',
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}

                <label htmlFor="reader-theme-desktop" className="sr-only">Reader colour theme</label>
                <select id="reader-theme-desktop" value={readerTheme} onChange={(e) => setReaderTheme(e.target.value)} style={{ padding: '4px 6px', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'inherit' }}>
                  <option value="light">☀️</option>
                  <option value="sepia">📜</option>
                  <option value="dark">🌙</option>
                </select>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: isSmallScreen ? '16px' : '24px max(16px, (100vw - 840px) / 2)' }}>
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.65rem', fontWeight: 800, marginBottom: '6px' }}>{resource.title}</h1>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.85 }}>{resource.authors} ({resource.publicationYear})</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600, marginTop: '4px' }}>Published in: {resource.journal || 'Academic Repository'}</div>
          </div>

          {/* MODE 1: PDF VIEWER */}
          {viewMode === 'pdf' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {pdfMeta.sourceName && (
                <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} /> Open-access copy loaded from alternative repository: <strong>{pdfMeta.sourceName}</strong>
                </div>
              )}

              <div style={{ height: 'calc(100dvh - 200px)', minHeight: '480px', width: '100%', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
                {(readerState === 'resolving' || pdfJsLoading) ? (
                  <div style={{ textAlign: 'center', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
                    <div style={{ fontWeight: 700 }}>{statusMessage}</div>
                  </div>
                ) : readerState === 'ready' && !pdfJsError ? (
                  <canvas ref={pdfCanvasRef} style={{ maxWidth: '100%', height: 'auto', boxShadow: '0 4px 18px rgba(0,0,0,0.45)', borderRadius: '4px' }} />
                ) : (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#fff', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                    <FileCode size={42} style={{ color: 'var(--primary)' }} />
                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>We couldn't retrieve a readable PDF automatically.</div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.8, lineHeight: 1.5 }}>
                      The paper may still be freely available on the publisher's site or institutional catalog. You can open the direct link or switch to extracted text reading mode.
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {/* A locally uploaded PDF has no source URL, and an anchor
                          with href={undefined} is a button that reloads the app. */}
                      {(resource.downloadUrl || resource.sourceUrl) && (
                        <a href={resource.downloadUrl || resource.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <ExternalLink size={14} /> Open Source
                        </a>
                      )}
                      <button onClick={loadPdfDocument} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', backgroundColor: 'transparent' }}>
                        <RefreshCw size={14} /> Try Again
                      </button>
                      <button onClick={() => setViewMode('page')} style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', backgroundColor: 'transparent' }}>
                        Read Available Text
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODE 2: PAGINATED TEXT VIEWER */}
          {viewMode === 'page' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              {/* Active Extraction Loading Spinner */}
              {(isExtractingPdfText || readerState === 'resolving') && (
                <div style={{ padding: '24px 16px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
                  <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>Extracting Paper Pages & Text...</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Retrieving research document content for your device</div>
                  </div>
                </div>
              )}

              {/* Compact prompt when text extraction is placeholder but a PDF file/source is attached */}
              {!hasRealText && !isExtractingPdfText && readerState !== 'resolving' && hasPdfSource && (
                <div style={{
                  margin: '8px 0 12px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span>Original PDF Document Attached</span>
                  </div>
                  <button
                    onClick={() => setViewMode('pdf')}
                    className="btn-primary"
                    style={{
                      padding: '5px 12px',
                      borderRadius: '7px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      marginLeft: 'auto'
                    }}
                  >
                    Switch to PDF Mode
                  </button>
                </div>
              )}

              {/* The record says a PDF was attached, but its bytes are not on
                  this device — either it was added elsewhere (sync carries the
                  metadata only) or it was evicted when localStorage filled up.
                  Saying so beats a reader that just looks empty. */}
              {pdfMissingLocally && !isExtractingPdfText && (
                <div style={{
                  margin: '8px 0 12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <FileSearch size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-main)' }}>The original PDF file isn't stored on this device.</strong>{' '}
                    {hasRealText
                      ? 'The text below was extracted when the paper was added. Re-upload the PDF if you need the original pages.'
                      : 'Re-upload the PDF from the device you added it on to read the original pages.'}
                  </div>
                </div>
              )}

              {/* External Link Banner when only abstract/summary is available in Pages mode */}
              {isAbstractOnly && !isExtractingPdfText && (resource.sourceUrl || resource.downloadUrl || resource.doi) && (
                <div style={{
                  margin: '8px 0 12px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ExternalLink size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span>Viewing Abstract Summary</span>
                  </div>
                  <a
                    href={resource.sourceUrl || resource.downloadUrl || (resource.doi ? `https://doi.org/${resource.doi}` : '#')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{
                      padding: '5px 12px',
                      borderRadius: '7px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap',
                      marginLeft: 'auto'
                    }}
                  >
                    <ExternalLink size={13} /> Read Full Paper
                  </a>
                </div>
              )}

              <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '16px', fontFamily: 'var(--font-serif)', fontSize: `${fontSize}px`, lineHeight: 1.75 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>Page {safeCurrentPage} of {totalPages}</h2>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{activePageText}</div>
              </div>
            </div>
          )}
        </div>

        {/* AI PANEL */}
        {showAiPanel && (
          <div className="ai-reader-panel" style={{ width: isSmallScreen ? '100%' : '420px', borderLeft: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                <div style={{ fontWeight: 800 }}>AI Paper Assistant</div>
              </div>
              <button type="button" onClick={() => setShowAiPanel(false)} aria-label="Close AI paper assistant" style={{ color: 'var(--text-muted)' }}><X size={18} aria-hidden="true" /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {aiSummaryTypes.map(type => (
                  <button key={type} onClick={() => { setAiSummaryType(type); handleAiGenerateSummary(type); }} style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '0.73rem', backgroundColor: aiSummaryType === type ? 'var(--primary)' : 'var(--bg-main)', color: aiSummaryType === type ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                    {type}
                  </button>
                ))}
              </div>

              {aiLoading && (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--primary)' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Analyzing paper with Gemini AI...</div>
                </div>
              )}

              {aiSummaryResult && !aiLoading && (
                <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.82rem' }}>
                    <MarkdownMessage compact>{aiSummaryResult}</MarkdownMessage>
                  </div>
                </div>
              )}

              {aiChatHistory.length > 0 && (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px' }}>Q&A Conversation</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {aiChatHistory.map((item, idx) => (
                      <div key={idx} style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'var(--bg-main)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.78rem', marginBottom: '4px' }}>Q: {item.q}</div>
                        <div style={{ fontSize: '0.8rem' }}>
                          <MarkdownMessage compact>{item.a}</MarkdownMessage>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div ref={aiChatEndRef} />
            </div>

            <form onSubmit={handleAiAskQuestion} style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
              <label htmlFor="reader-ai-question" className="sr-only">Ask a question about this paper</label>
              <input id="reader-ai-question" type="text" value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} placeholder="Ask about this paper..." style={{ flex: 1, padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.82rem' }} />
              <button type="submit" className="btn-primary" aria-label="Send question to AI assistant" style={{ padding: '8px 12px' }}><Send size={14} aria-hidden="true" /></button>
            </form>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <footer style={{ padding: '12px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--header-bg)' }}>
        {viewMode === 'pdf' && pdfJsDoc ? (
          <>
            <button disabled={safePdfPage <= 1} onClick={() => setPdfJsPageNum(p => Math.max(1, p - 1))} style={{ opacity: safePdfPage <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ChevronLeft size={20} /> <span className="btn-text">Previous</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
              <button onClick={() => setPdfJsScale(s => Math.max(0.6, +(s - 0.2).toFixed(2)))} style={{ fontWeight: 800, padding: '2px 6px' }}>-</button>
              <span>{Math.round(pdfJsScale * 100)}%</span>
              <button onClick={() => setPdfJsScale(s => Math.min(3, +(s + 0.2).toFixed(2)))} style={{ fontWeight: 800, padding: '2px 6px' }}>+</button>
            </div>
            <button disabled={safePdfPage >= pdfJsNumPages} onClick={() => setPdfJsPageNum(p => Math.min(pdfJsNumPages, p + 1))} style={{ opacity: safePdfPage >= pdfJsNumPages ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="btn-text">Next</span> <ChevronRight size={20} />
            </button>
          </>
        ) : (
          <>
            <button disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ opacity: safeCurrentPage <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ChevronLeft size={20} /> <span className="btn-text">Previous</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
              <button onClick={() => setFontSize(prev => Math.max(12, prev - 2))} style={{ fontWeight: 800, padding: '2px 6px' }}>A-</button>
              <span>{fontSize}pt</span>
              <button onClick={() => setFontSize(prev => Math.min(28, prev + 2))} style={{ fontWeight: 800, padding: '2px 6px' }}>A+</button>
            </div>
            <button disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{ opacity: safeCurrentPage >= totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="btn-text">Next</span> <ChevronRight size={20} />
            </button>
          </>
        )}
      </footer>

      {/* Notes Drawer */}
      {showNotesDrawer && (
        <div className="notes-drawer-mobile" style={{
          position: 'fixed',
          right: 0,
          top: '60px',
          bottom: '60px',
          width: 'min(320px, 100vw)',
          backgroundColor: 'var(--bg-card)',
          borderLeft: '1px solid var(--border-color)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 110
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Notes for Page {currentPage}</h3>
            <button type="button" onClick={() => setShowNotesDrawer(false)} aria-label="Close notes panel"><X size={18} aria-hidden="true" /></button>
          </div>

          <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            <label htmlFor="reader-new-note" className="sr-only">Add a note for page {currentPage}</label>
            <input
              id="reader-new-note"
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add observation..."
              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            />
            <button type="submit" className="btn-primary" aria-label="Save note" style={{ padding: '8px' }}><Send size={14} aria-hidden="true" /></button>
          </form>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notes.map(n => (
              <div key={n.id} style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>Page {n.pageNumber} • {n.createdAt}</div>
                <div>{n.noteText}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
