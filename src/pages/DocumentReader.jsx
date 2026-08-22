import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles, FileText, ChevronLeft, ChevronRight, Send, Download, ExternalLink, FileCode, ShieldCheck, X, Loader2, Trash2, RefreshCw } from 'lucide-react';
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

  const [viewMode, setViewMode] = useState('page');

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
          setPdfJsError("Couldn't render PDF pages directly — try opening external source.");
        }
      } finally {
        if (active) setPdfJsLoading(false);
      }
    })();

    return () => { active = false; };
  }, [pdfUint8Data, readerState]);

  // Render PDF.js Canvas Page
  const safePdfPage = Math.min(Math.max(1, pdfJsPageNum), Math.max(1, pdfJsNumPages || 1));

  useEffect(() => {
    let cancelled = false;
    if (!pdfJsDoc || !pdfCanvasRef.current) return;

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
  }, [pdfJsDoc, safePdfPage, pdfJsScale]);

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

  /* Reader surface colours. Pure white and slate-900 were both slightly
     hostile for a long session: white is the harshest possible page and the
     slate carried a blue cast that fought every theme. Off-white and a neutral
     warm dark now, with sepia unchanged. */
  const themeColors = readerTheme === 'dark' ? { bg: '#1a1a1c', text: '#e8e6e3' }
                    : readerTheme === 'sepia' ? { bg: '#faf0e6', text: '#3b2f2f' }
                    : { bg: '#fdfdfb', text: '#22201e' };

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
        padding: isSmallScreen ? '8px 12px' : '9px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: isSmallScreen ? 'column' : 'row',
        alignItems: isSmallScreen ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: isSmallScreen ? '8px' : '12px',
        backgroundColor: 'var(--header-bg)',
        color: 'var(--text-main)',
        flexShrink: 0,
        zIndex: 510
      }}>
        {/* Row 1: Back Arrow + Paper Title (1-line Ellipsis) + Theme & Delete on Mobile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <button type="button" onClick={onClose} className="icon-button" title="Back to library" aria-label="Close reader and return to library" style={{ flexShrink: 0 }}>
            <ArrowLeft size={19} aria-hidden="true" />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="reader-title-text" style={{
              fontWeight: 600,
              fontSize: isSmallScreen ? 'var(--text-md)' : 'var(--text-base)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              wordBreak: 'normal',
              lineHeight: 1.25
            }}>
              {resource.title}
            </div>
            {!isSmallScreen && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '1px', whiteSpace: 'nowrap' }}>
                {viewMode === 'pdf' ? (pdfJsDoc ? `Page ${safePdfPage} of ${pdfJsNumPages}` : statusMessage) : `Page ${safeCurrentPage} of ${totalPages}`}
              </div>
            )}
          </div>

          {isSmallScreen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <label htmlFor="reader-theme-mobile" className="sr-only">Reader colour theme</label>
              <select id="reader-theme-mobile" value={readerTheme} onChange={(e) => setReaderTheme(e.target.value)} style={{ padding: '4px 6px', minHeight: '34px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', backgroundColor: 'transparent', color: 'inherit' }}>
                <option value="light">Light</option>
                <option value="sepia">Sepia</option>
                <option value="dark">Dark</option>
              </select>
              {onDeleteResource && (
                <button
                  type="button"
                  onClick={handleDeleteRequest}
                  className="icon-button icon-button-danger"
                  title="Delete paper"
                  aria-label={`Delete "${resource.title}" from library`}
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
          {/* The mobile page counter was an emerald-tinted pill with brand-
              coloured text on top of it — two unrelated accents in one 60px
              chip, for what is plain status text. */}
          {isSmallScreen && (
            <div style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums'
            }}>
              {viewMode === 'pdf' ? (pdfJsDoc ? `Page ${safePdfPage} of ${pdfJsNumPages}` : 'Loading PDF') : `Page ${safeCurrentPage} of ${totalPages}`}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
            {hasPdfSource && (
              <div className="segmented" role="group" aria-label="Reading mode">
                <button
                  type="button"
                  className="segmented-item"
                  aria-pressed={viewMode === 'pdf'}
                  onClick={() => setViewMode('pdf')}
                  style={{ padding: '5px 10px', fontSize: 'var(--text-xs)' }}
                >
                  PDF
                </button>
                <button
                  type="button"
                  className="segmented-item"
                  aria-pressed={viewMode === 'page'}
                  onClick={() => setViewMode('page')}
                  style={{ padding: '5px 10px', fontSize: 'var(--text-xs)' }}
                >
                  Text
                </button>
              </div>
            )}

            {/* Was styled with --secondary while open, a colour used for
                "active" nowhere else in the app. aria-pressed plus the standard
                primary/secondary pair carries the state instead. */}
            <button
              type="button"
              onClick={handleOpenAiPanel}
              className={showAiPanel ? 'btn-secondary' : 'btn-primary'}
              aria-pressed={showAiPanel}
              aria-label="Open AI paper assistant"
              style={{ padding: '5px 10px', minHeight: '32px', fontSize: 'var(--text-xs)' }}
            >
              <Sparkles size={14} aria-hidden="true" /> <span className="btn-text">AI</span>
            </button>

            {(pdfMeta.resolvedUrl || resource.downloadUrl || resource.sourceUrl) && (
              <a
                href={pdfMeta.resolvedUrl || resource.downloadUrl || resource.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="icon-button"
                title="Download PDF"
                aria-label="Download this paper's PDF"
                style={{ textDecoration: 'none' }}
              >
                <Download size={16} aria-hidden="true" />
              </a>
            )}

            <button
              type="button"
              onClick={() => { setShowNotesDrawer(!showNotesDrawer); setShowAiPanel(false); }}
              className="icon-button"
              title="Notes"
              aria-label={showNotesDrawer ? 'Hide notes panel' : 'Show notes panel'}
              aria-expanded={showNotesDrawer}
            >
              <FileText size={16} aria-hidden="true" />
            </button>

            {!isSmallScreen && (
              <>
                {onDeleteResource && (
                  <button
                    type="button"
                    onClick={handleDeleteRequest}
                    className="icon-button icon-button-danger"
                    title="Delete paper"
                    aria-label={`Delete "${resource.title}" from library`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}

                {/* Emoji-only options (☀️ 📜 🌙) gave no readable label and were
                    unusable to anyone whose font lacked them. */}
                <label htmlFor="reader-theme-desktop" className="sr-only">Reader colour theme</label>
                <select id="reader-theme-desktop" value={readerTheme} onChange={(e) => setReaderTheme(e.target.value)} style={{ padding: '5px 8px', minHeight: '32px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', backgroundColor: 'transparent', color: 'inherit' }}>
                  <option value="light">Light</option>
                  <option value="sepia">Sepia</option>
                  <option value="dark">Dark</option>
                </select>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div className="document-reader-content" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: isSmallScreen ? '20px 16px' : '32px max(24px, (100% - 760px) / 2)' }}>
          <div style={{ marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
            <h1 className="wrap-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.012em', marginBottom: '8px' }}>{resource.title}</h1>
            <div style={{ fontSize: 'var(--text-base)', opacity: 0.75, lineHeight: 'var(--leading-snug)' }}>
              {resource.authors}{resource.publicationYear ? ` (${resource.publicationYear})` : ''}
              {resource.journal ? <span style={{ fontStyle: 'italic' }}>{` · ${resource.journal}`}</span> : null}
            </div>
          </div>

          {/* MODE 1: PDF VIEWER */}
          {viewMode === 'pdf' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {pdfMeta.sourceName && (
                <div className="notice notice-success">
                  <ShieldCheck size={15} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--success)' }} />
                  <span>Open-access copy loaded from <strong>{pdfMeta.sourceName}</strong></span>
                </div>
              )}

              {/* The canvas stage was hardcoded #1e293b — a slate that matched
                  no theme and clashed with sepia especially badly. It follows
                  the reader's own surface now, one step darker. */}
              <div style={{
                height: 'calc(100dvh - 220px)',
                minHeight: '460px',
                width: '100%',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                backgroundColor: readerTheme === 'dark' ? '#101012' : '#efece6',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'auto'
              }}>
                {(readerState === 'resolving' || pdfJsLoading) ? (
                  <div role="status" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: themeColors.text }}>
                    <Loader2 size={28} aria-hidden="true" className="animate-spin" />
                    <div style={{ fontSize: 'var(--text-base)' }}>{statusMessage}</div>
                  </div>
                ) : readerState === 'ready' && !pdfJsError ? (
                  <canvas ref={pdfCanvasRef} style={{ maxWidth: '100%', height: 'auto', boxShadow: '0 2px 12px rgba(0,0,0,0.18)' }} />
                ) : (
                  <div style={{ padding: '32px', textAlign: 'center', maxWidth: '44ch', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', color: themeColors.text }}>
                    <FileCode size={30} aria-hidden="true" style={{ opacity: 0.6 }} />
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>No readable PDF could be retrieved</div>
                    <div style={{ fontSize: 'var(--text-base)', opacity: 0.75, lineHeight: 'var(--leading-normal)' }}>
                      The paper may still be free on the publisher's site. Open the direct link, retry, or read the extracted text instead.
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <a href={resource.downloadUrl || resource.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ textDecoration: 'none' }}>
                        <ExternalLink size={14} aria-hidden="true" /> Open source
                      </a>
                      <button onClick={loadPdfDocument} className="btn-secondary">
                        <RefreshCw size={14} aria-hidden="true" /> Try again
                      </button>
                      <button onClick={() => setViewMode('page')} className="btn-secondary">
                        Read available text
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
                <div className="notice" role="status" style={{ flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', padding: 'var(--space-5)' }}>
                  <Loader2 size={22} aria-hidden="true" className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Extracting text…</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '2px' }}>Reading the document on this device</div>
                  </div>
                </div>
              )}

              {/* These three banners were three separate hand-rolled boxes, each
                  hardcoding rgba(59,130,246,…) — Tailwind blue-500 — as a tint
                  that belonged to none of the four themes. They share the one
                  .notice style now. */}
              {!hasRealText && !isExtractingPdfText && readerState !== 'resolving' && hasPdfSource && (
                <div className="notice" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <FileText size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                    <span>A PDF is attached to this record</span>
                  </span>
                  <button
                    onClick={() => setViewMode('pdf')}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', minHeight: '32px', fontSize: 'var(--text-xs)' }}
                  >
                    Switch to PDF
                  </button>
                </div>
              )}

              {/* External Link Banner when only abstract/summary is available */}
              {isAbstractOnly && !isExtractingPdfText && (resource.sourceUrl || resource.downloadUrl || resource.doi) && (
                <div className="notice" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <ExternalLink size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                    <span>Showing the abstract only</span>
                  </span>
                  <a
                    href={resource.sourceUrl || resource.downloadUrl || (resource.doi ? `https://doi.org/${resource.doi}` : '#')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ padding: '6px 12px', minHeight: '32px', fontSize: 'var(--text-xs)', textDecoration: 'none' }}
                  >
                    <ExternalLink size={12} aria-hidden="true" /> Read full paper
                  </a>
                </div>
              )}

              {/* The extracted text.
                  Two changes, both about sustained reading:
                  1. It was set in Playfair Display — a high-contrast display
                     face whose hairline strokes are punishing at paragraph size.
                     --font-reading is a text serif intended for body copy.
                  2. It had no measure, so on a wide window the column ran the
                     full 840px and produced roughly 100-character lines.
                     .reading-column caps it at 72ch.
                  The page counter above it was an h2 in --primary at weight 800,
                  louder than the paper's own title; it is a quiet label now. */}
              <div>
                <div className="overline" style={{ marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                  Page {safeCurrentPage} of {totalPages}
                </div>
                <div
                  className="reading-column"
                  style={{
                    fontSize: `${fontSize}px`,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'break-word',
                    wordBreak: 'normal'
                  }}
                >
                  {activePageText}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI PANEL.
            A quiet utility column beside the paper, not a feature launch. The
            header lost its tinted sparkle badge and its weight-800 title; the
            summary-type buttons are the same segmented control used everywhere
            else rather than a bespoke set of pill toggles. */}
        {showAiPanel && (
          <div className="ai-reader-panel" style={{ width: isSmallScreen ? '100%' : '400px', flexShrink: 0, borderLeft: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h2 style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>Paper assistant</h2>
              <button type="button" onClick={() => setShowAiPanel(false)} className="icon-button" aria-label="Close AI paper assistant">
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
              <div className="segmented" role="group" aria-label="Summary type" style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 'var(--space-4)', width: '100%' }}>
                {aiSummaryTypes.map(type => (
                  <button
                    key={type}
                    type="button"
                    className="segmented-item"
                    aria-pressed={aiSummaryType === type}
                    onClick={() => { setAiSummaryType(type); handleAiGenerateSummary(type); }}
                    style={{ padding: '5px 9px', fontSize: 'var(--text-xs)' }}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {aiLoading && (
                <div role="status" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <Loader2 size={20} aria-hidden="true" className="animate-spin" style={{ margin: '0 auto var(--space-2)', color: 'var(--text-muted)' }} />
                  <div style={{ fontSize: 'var(--text-md)', color: 'var(--text-muted)' }}>Analysing the paper…</div>
                </div>
              )}

              {aiError && !aiLoading && (
                <div role="alert" className="notice notice-danger" style={{ marginBottom: 'var(--space-3)' }}>
                  {aiError}
                </div>
              )}

              {aiSummaryResult && !aiLoading && (
                <div style={{ fontSize: 'var(--text-md)' }}>
                  <MarkdownMessage compact>{aiSummaryResult}</MarkdownMessage>
                </div>
              )}

              {aiChatHistory.length > 0 && (
                <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
                  <div className="overline" style={{ marginBottom: 'var(--space-3)' }}>Questions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {aiChatHistory.map((item, idx) => (
                      <div key={idx}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-md)', marginBottom: '5px' }}>{item.q}</div>
                        <div style={{ fontSize: 'var(--text-md)', color: 'var(--text-muted)' }}>
                          <MarkdownMessage compact>{item.a}</MarkdownMessage>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div ref={aiChatEndRef} />
            </div>

            <form onSubmit={handleAiAskQuestion} style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
              <label htmlFor="reader-ai-question" className="sr-only">Ask a question about this paper</label>
              <input id="reader-ai-question" type="text" value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} placeholder="Ask about this paper…" style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-md)' }} />
              <button type="submit" className="btn-primary" disabled={!aiQuestion.trim() || aiLoading} aria-label="Send question to the paper assistant" style={{ padding: '0 12px', flexShrink: 0 }}>
                <Send size={15} aria-hidden="true" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Footer Controls.
          These were bare <button> elements with no border, no hover and only an
          opacity change when disabled — nothing marked them as controls. They
          use the shared quiet-button styling now, and the zoom / text-size
          steppers read as one grouped control. */}
      <footer style={{ padding: '10px var(--space-5)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', backgroundColor: 'var(--header-bg)', color: 'var(--text-main)', flexShrink: 0 }}>
        {viewMode === 'pdf' && pdfJsDoc ? (
          <>
            <button type="button" className="btn-secondary" disabled={safePdfPage <= 1} onClick={() => setPdfJsPageNum(p => Math.max(1, p - 1))} style={{ padding: '7px 12px', minHeight: '34px' }}>
              <ChevronLeft size={16} aria-hidden="true" /> <span className="btn-text">Previous</span>
            </button>
            <div className="segmented" style={{ alignItems: 'center' }}>
              <button type="button" className="segmented-item" onClick={() => setPdfJsScale(s => Math.max(0.6, +(s - 0.2).toFixed(2)))} aria-label="Zoom out">−</button>
              <span style={{ padding: '0 8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', alignSelf: 'center' }}>{Math.round(pdfJsScale * 100)}%</span>
              <button type="button" className="segmented-item" onClick={() => setPdfJsScale(s => Math.min(3, +(s + 0.2).toFixed(2)))} aria-label="Zoom in">+</button>
            </div>
            <button type="button" className="btn-secondary" disabled={safePdfPage >= pdfJsNumPages} onClick={() => setPdfJsPageNum(p => Math.min(pdfJsNumPages, p + 1))} style={{ padding: '7px 12px', minHeight: '34px' }}>
              <span className="btn-text">Next</span> <ChevronRight size={16} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-secondary" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ padding: '7px 12px', minHeight: '34px' }}>
              <ChevronLeft size={16} aria-hidden="true" /> <span className="btn-text">Previous</span>
            </button>
            <div className="segmented" style={{ alignItems: 'center' }}>
              <button type="button" className="segmented-item" onClick={() => setFontSize(prev => Math.max(12, prev - 2))} aria-label="Decrease text size">A−</button>
              <span style={{ padding: '0 8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', alignSelf: 'center' }}>{fontSize}px</span>
              <button type="button" className="segmented-item" onClick={() => setFontSize(prev => Math.min(28, prev + 2))} aria-label="Increase text size">A+</button>
            </div>
            <button type="button" className="btn-secondary" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{ padding: '7px 12px', minHeight: '34px' }}>
              <span className="btn-text">Next</span> <ChevronRight size={16} aria-hidden="true" />
            </button>
          </>
        )}
      </footer>

      {/* Notes Drawer */}
      {showNotesDrawer && (
        <div className="notes-drawer-mobile" style={{
          position: 'fixed',
          right: 0,
          top: '56px',
          bottom: '54px',
          width: 'min(320px, 100vw)',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-main)',
          borderLeft: '1px solid var(--border-color)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-overlay)',
          zIndex: 110
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Notes · page {safeCurrentPage}</h3>
            <button type="button" onClick={() => setShowNotesDrawer(false)} className="icon-button" aria-label="Close notes panel">
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleAddNote} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <label htmlFor="reader-new-note" className="sr-only">Add a note for page {safeCurrentPage}</label>
            <input
              id="reader-new-note"
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add an observation…"
              style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-md)' }}
            />
            <button type="submit" className="btn-primary" disabled={!newNote.trim()} aria-label="Save note" style={{ padding: '0 12px', flexShrink: 0 }}>
              <Send size={15} aria-hidden="true" />
            </button>
          </form>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {notes.length === 0 ? (
              <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-muted)' }}>
                No notes on this paper yet.
              </p>
            ) : notes.map(n => (
              <div key={n.id} style={{ paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-color)' }}>
                <div className="overline" style={{ marginBottom: '4px' }}>Page {n.pageNumber} · {n.createdAt}</div>
                <div style={{ fontSize: 'var(--text-md)', lineHeight: 'var(--leading-snug)' }}>{n.noteText}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
