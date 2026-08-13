import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles, Bookmark, FileText, ChevronLeft, ChevronRight, Plus, Send, Download, ExternalLink, FileCode, ShieldCheck, X, Loader2, Copy, Check, BookmarkPlus, FileSearch, Trash2 } from 'lucide-react';
import { storage } from '../services/storage';
import { generatePaperSummary, askPaperQuestion, generatePeerReview } from '../services/geminiService';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';

// Sentinel value set by AddResourceModal when no real text could be extracted
const PLACEHOLDER_TEXT = 'Imported paper document in ResearchVault digital library.';

async function extractTextFromDataUrl(dataUrl, fileName) {
  try {
    const parts = dataUrl.split(';base64,');
    const contentType = parts[0].replace('data:', '') || 'application/pdf';
    const raw = atob(parts[1]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const blob = new Blob([bytes], { type: contentType });
    const file = new File([blob], fileName || 'document.pdf', { type: contentType });
    return await extractTextFromPdfFile(file);
  } catch {
    return '';
  }
}

// Papers added from search results / DOI lookup only ever come with a
// downloadUrl (an open-access PDF link), never a locally uploaded file.
// Fetch that PDF and run it through the same extractor so these papers can
// be fully read too, not just their abstract.
async function extractTextFromRemoteUrl(url, fileName) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    const file = new File([pdfBlob], fileName || 'document.pdf', { type: 'application/pdf' });
    return await extractTextFromPdfFile(file);
  } catch {
    return '';
  }
}

// A small screen (phone or tablet) can't reliably render an inline PDF the
// way a laptop browser can — most mobile browsers have no embedded PDF
// plugin, so <object>/<iframe> just shows blank space. Default those
// devices to the extracted-text reading mode, and lay out side panels as
// full-screen overlays instead of squeezing the reading column to nothing.
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
  const [readerTheme, setReaderTheme] = useState('light'); // light, sepia, dark
  const [notes, setNotes] = useState([]);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [newNote, setNewNote] = useState('');

  // --- AI Assistant Panel State ---
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

  // --- Auto Full Text Resolution & Background Extraction ---
  const [extractedFullText, setExtractedFullText] = useState(resource.fullText || '');
  const [isExtractingPdfText, setIsExtractingPdfText] = useState(false);
  const extractedFullTextRef = useRef(resource.fullText || '');
  useEffect(() => { isExtractingPdfTextRef.current = isExtractingPdfText; }, [isExtractingPdfText]);
  useEffect(() => { extractedFullTextRef.current = extractedFullText; }, [extractedFullText]);

  useEffect(() => {
    let active = true;
    const storedFullText = (resource.fullText || '').trim();

    const alreadyHasFullText =
      storedFullText.length > 0 &&
      storedFullText !== PLACEHOLDER_TEXT &&
      !storedFullText.toLowerCase().includes('imported paper document in researchvault') &&
      storedFullText !== (resource.abstractText || '').trim();

    const hasExtractableSource = Boolean(resource.pdfFileData || resource.downloadUrl);

    if (!alreadyHasFullText && hasExtractableSource) {
      setIsExtractingPdfText(true);
      const extractPromise = resource.pdfFileData
        ? extractTextFromDataUrl(resource.pdfFileData, resource.pdfFileName)
        : extractTextFromRemoteUrl(resource.downloadUrl, resource.pdfFileName || `${resource.title || 'document'}.pdf`);

      extractPromise
        .then(extracted => {
          if (!active) return;
          if (extracted && extracted.trim().length > 40) {
            const cleanText = extracted.trim();
            setExtractedFullText(cleanText);
            try {
              storage.updateResource(resource.id, { fullText: cleanText });
            } catch (e) {}
          } else {
            setExtractedFullText(resource.abstractText || '');
          }
        })
        .catch(() => {
          if (active) setExtractedFullText(resource.abstractText || '');
        })
        .finally(() => {
          if (active) setIsExtractingPdfText(false);
        });
    } else {
      setExtractedFullText(storedFullText || resource.abstractText || '');
    }

    return () => { active = false; };
  }, [resource.id, resource.pdfFileData, resource.downloadUrl, resource.fullText, resource.abstractText]);

  // --- View Mode & Reader Engine ---
  const isSmallScreen = useIsSmallScreen(880);
  const hasPdfSource = Boolean(resource.pdfFileData || resource.downloadUrl);
  const [viewMode, setViewMode] = useState(hasPdfSource ? 'pdf' : 'page');

  const hasFullText = Boolean(
    extractedFullText &&
    extractedFullText.trim() &&
    extractedFullText.trim() !== (resource.abstractText || '').trim()
  );
  const publisherLink = resource.downloadUrl || resource.sourceUrl || '';

  const rawPaperText = extractedFullText || resource.fullText || resource.abstractText || '';
  const paperPages = React.useMemo(() => {
    if (!rawPaperText || !rawPaperText.trim()) {
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
    if (currentPageText.trim()) {
      pages.push(currentPageText.trim());
    }

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

  const getReaderColors = () => {
    if (readerTheme === 'dark') return { bg: '#0f172a', text: '#f1f5f9' };
    if (readerTheme === 'sepia') return { bg: '#faf0e6', text: '#3b2f2f' };
    return { bg: '#ffffff', text: '#0f172a' };
  };

  const themeColors = getReaderColors();

  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfEmbedBlocked, setPdfEmbedBlocked] = useState(false);

  // Auto-fetch PDF bytes for searched papers (downloadUrl) & convert uploaded base64 data into Blob URL
  useEffect(() => {
    let active = true;
    let createdUrl = null;
    setPdfEmbedBlocked(false);

    if (resource.pdfFileData) {
      if (resource.pdfFileData.startsWith('data:')) {
        try {
          const parts = resource.pdfFileData.split(';base64,');
          const contentType = parts[0].split(':')[1] || 'application/pdf';
          const raw = window.atob(parts[1]);
          const uInt8Array = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) {
            uInt8Array[i] = raw.charCodeAt(i);
          }
          const blob = new Blob([uInt8Array], { type: contentType });
          createdUrl = URL.createObjectURL(blob);
          if (active) setPdfBlobUrl(createdUrl);
        } catch (err) {
          if (active) setPdfBlobUrl(resource.pdfFileData);
        }
      } else {
        if (active) setPdfBlobUrl(resource.pdfFileData);
      }
    } else if (resource.downloadUrl) {
      setPdfLoading(true);
      setPdfBlobUrl('');
      fetch(resource.downloadUrl)
        .then(res => {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.blob();
        })
        .then(blob => {
          const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
          createdUrl = URL.createObjectURL(pdfBlob);
          if (active) setPdfBlobUrl(createdUrl);
        })
        .catch(() => {
          if (active) setPdfEmbedBlocked(true);
        })
        .finally(() => {
          if (active) setPdfLoading(false);
        });
    }

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [resource.pdfFileData, resource.downloadUrl]);

  // --- True in-app PDF page rendering (pdf.js -> <canvas>) ---
  const [pdfJsDoc, setPdfJsDoc] = useState(null);
  const [pdfJsNumPages, setPdfJsNumPages] = useState(0);
  const [pdfJsPageNum, setPdfJsPageNum] = useState(1);
  const [pdfJsScale, setPdfJsScale] = useState(1.2);
  const [pdfJsLoading, setPdfJsLoading] = useState(false);
  const [pdfJsError, setPdfJsError] = useState('');
  const pdfCanvasRef = useRef(null);
  const pdfRenderTaskRef = useRef(null);

  useEffect(() => {
    let active = true;
    setPdfJsDoc(null);
    setPdfJsNumPages(0);
    setPdfJsPageNum(1);
    setPdfJsError('');

    if (!pdfBlobUrl) return;

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

        const res = await fetch(pdfBlobUrl);
        const buf = await res.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        if (!active) return;
        setPdfJsDoc(doc);
        setPdfJsNumPages(doc.numPages);
      } catch (err) {
        console.warn('pdf.js render setup failed:', err);
        if (active) setPdfJsError("Couldn't render this PDF page-by-page — try Open PDF Fullscreen, or read the extracted text in Pages.");
      } finally {
        if (active) setPdfJsLoading(false);
      }
    })();

    return () => { active = false; };
  }, [pdfBlobUrl]);

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
        // Render-cancelled errors are expected when flipping pages quickly.
      }
    })();

    return () => { cancelled = true; };
  }, [pdfJsDoc, safePdfPage, pdfJsScale]);

  // --- AI Assistant Logic ---
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
      let res;
      if (type === 'Peer Review') {
        res = await generatePeerReview(
          resource.title,
          resource.authors,
          resource.journal || '',
          content
        );
      } else {
        res = await generatePaperSummary(resource.title, resource.authors, content, type);
      }
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

  const handleAiSaveNote = (text) => {
    storage.addNote(resource.id, text, safeCurrentPage);
    setNotes(storage.getNotes(resource.id));
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 500,
      backgroundColor: themeColors.bg,
      color: themeColors.text,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Reader Header */}
      <header className="reader-mobile-header" style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--header-bg)',
        backdropFilter: 'blur(8px)',
        zIndex: 510
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <button onClick={onClose} title="Back to Library" style={{ color: 'inherit', padding: '6px', flexShrink: 0 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resource.title}</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
              {viewMode === 'pdf'
                ? (pdfJsDoc ? `Page ${safePdfPage} of ${pdfJsNumPages}` : 'PDF Document Viewer')
                : `Page ${safeCurrentPage} of ${totalPages}`}
            </div>
          </div>
        </div>

        {/* Reader Actions & View Mode Selector */}
        <div className="reader-mobile-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Reader View Mode Switcher */}
          {hasPdfSource && (
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-card)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)', marginRight: '4px' }}>
              <button
                onClick={() => setViewMode('pdf')}
                style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: viewMode === 'pdf' ? 'var(--primary)' : 'transparent', color: viewMode === 'pdf' ? '#fff' : 'var(--text-muted)' }}
                title="Interactive PDF Viewer"
              >
                PDF
              </button>
              <button
                onClick={() => setViewMode('page')}
                style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: viewMode === 'page' ? 'var(--primary)' : 'transparent', color: viewMode === 'page' ? '#fff' : 'var(--text-muted)' }}
                title="Paginated Page Turn Mode"
              >
                Pages
              </button>
            </div>
          )}

          <button
            onClick={handleOpenAiPanel}
            className="btn-primary"
            title="Gemini AI Assistant"
            style={{
              padding: '6px 10px',
              fontSize: '0.78rem',
              backgroundColor: showAiPanel ? 'var(--secondary)' : undefined,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Sparkles size={15} />
            <span className="btn-text">AI</span>
          </button>

          {(pdfBlobUrl || resource.pdfFileData || resource.downloadUrl || resource.sourceUrl) && (
            <a
              href={pdfBlobUrl || resource.pdfFileData || resource.downloadUrl || resource.sourceUrl}
              download={resource.pdfFileName || `${resource.title}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              title="Download / Open Full PDF Document"
              style={{ padding: '6px', color: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Download size={17} />
            </a>
          )}

          <button onClick={() => { setShowNotesDrawer(!showNotesDrawer); setShowAiPanel(false); }} title="Notes" style={{ padding: '6px', color: 'inherit' }}>
            <FileText size={17} />
          </button>

          {onDeleteResource && (
            <button
              onClick={() => {
                if (window.confirm(`Delete "${resource.title}" from your library?`)) {
                  onDeleteResource(resource.id);
                  onClose();
                }
              }}
              title="Delete paper"
              style={{
                padding: '6px',
                borderRadius: '8px',
                color: '#ef4444',
                backgroundColor: 'rgba(239,68,68,0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={15} />
            </button>
          )}

          <select
            value={readerTheme}
            onChange={(e) => setReaderTheme(e.target.value)}
            style={{ padding: '4px 6px', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'inherit' }}
          >
            <option value="light">☀️</option>
            <option value="sepia">📜</option>
            <option value="dark">🌙</option>
          </select>
        </div>
      </header>

      {/* Main Content Area — side-by-side with AI panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Document Content */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isSmallScreen ? '16px' : '24px max(16px, (100vw - 840px) / 2)', transition: 'all 0.3s ease' }}>
          {/* Header Metadata */}
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.65rem', fontWeight: 800, marginBottom: '6px', lineHeight: 1.3 }}>{resource.title}</h1>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.85, marginBottom: '8px' }}>{resource.authors} ({resource.publicationYear})</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>Published in: {resource.journal || 'Academic Repository'}</div>
          </div>

          {/* ============================================================ */}
          {/* MODE 1: INTERACTIVE PDF DOCUMENT VIEWER                      */}
          {/* ============================================================ */}
          {viewMode === 'pdf' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>PDF Reader & Document Frame</span>
                {(pdfBlobUrl || resource.downloadUrl || resource.pdfFileData) && (
                  <a
                    href={pdfBlobUrl || resource.downloadUrl || resource.pdfFileData}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ExternalLink size={14} />
                    <span>Open PDF Fullscreen</span>
                  </a>
                )}
              </div>

              {isSmallScreen && pdfJsLoading && (
                <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                  Rendering pages for a smooth reading experience on this device — this only takes a moment.
                </div>
              )}

              <div style={{ height: 'calc(100dvh - 200px)', minHeight: '480px', width: '100%', borderRadius: '12px', overflow: 'auto', border: '1px solid var(--border-color)', backgroundColor: '#1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: pdfJsDoc ? '20px 0' : 0 }}>
                {pdfLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#fff' }}>
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
                    <div style={{ fontWeight: 700 }}>Fetching Full PDF Document...</div>
                  </div>
                ) : pdfBlobUrl ? (
                  pdfJsLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#fff' }}>
                      <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
                      <div style={{ fontWeight: 700 }}>Rendering PDF pages...</div>
                    </div>
                  ) : pdfJsError ? (
                    <div style={{ padding: '40px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: '#fff' }}>
                      <FileCode size={40} style={{ color: 'var(--primary)' }} />
                      <div style={{ fontSize: '0.85rem', maxWidth: '360px', lineHeight: 1.5, opacity: 0.85 }}>{pdfJsError}</div>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <a
                          href={pdfBlobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <ExternalLink size={14} />
                          <span>Open PDF Fullscreen</span>
                        </a>
                        <button
                          onClick={() => setViewMode('page')}
                          style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', backgroundColor: 'transparent' }}
                        >
                          Switch to Pages
                        </button>
                      </div>
                    </div>
                  ) : (
                    <canvas
                      ref={pdfCanvasRef}
                      style={{ maxWidth: '100%', height: 'auto', boxShadow: '0 4px 18px rgba(0,0,0,0.45)', borderRadius: '4px' }}
                    />
                  )
                ) : pdfEmbedBlocked ? (
                  <div style={{ padding: '40px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: '#fff' }}>
                    <FileCode size={40} style={{ color: 'var(--primary)' }} />
                    <div style={{ fontWeight: 700, maxWidth: '360px' }}>Couldn't load this PDF's content directly into the app</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.75, maxWidth: '360px', lineHeight: 1.5 }}>
                      This publisher's server doesn't allow another website's code to download the file directly (a common browser security default, not a deliberate block on you) — it's still open access and fully downloadable. Open it directly to read it, or switch to Pages for the abstract and a link back to the source (the same restriction usually means full text couldn't be pulled in either).
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <a
                        href={resource.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                        style={{ padding: '8px 16px', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <ExternalLink size={14} />
                        <span>Open PDF in New Tab</span>
                      </a>
                      <button
                        onClick={() => setViewMode('page')}
                        style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', backgroundColor: 'transparent' }}
                      >
                        Switch to Pages
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <FileCode size={40} style={{ color: 'var(--primary)' }} />
                    <div style={{ fontWeight: 700 }}>PDF Stream Unavailable</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODE 2: CONTINUOUS SCROLL PAPER READER                       */}
          {/* ============================================================ */}
          {viewMode === 'scroll' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              {(resource.downloadUrl || resource.sourceUrl) && (
                <div style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={24} style={{ color: '#10b981' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                        Verified Literature Source ({resource.openAccess ? 'Open Access PDF' : 'Academic Index'})
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Direct publisher PDF available:
                      </div>
                    </div>
                  </div>

                  <a
                    href={resource.downloadUrl || resource.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={14} />
                    <span>Open / Download Publisher PDF</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              <div style={{
                borderTop: '2px solid var(--border-color)',
                paddingTop: '20px',
                fontFamily: 'var(--font-serif)',
                fontSize: `${fontSize}px`,
                lineHeight: 1.8
              }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '12px', color: 'var(--primary)' }}>
                  Abstract & Key Overview
                </h2>
                <p style={{ marginBottom: '28px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'inherit' }}>
                  {resource.abstractText || rawPaperText}
                </p>

                {rawPaperText && rawPaperText !== resource.abstractText && (
                  <>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '12px', color: 'var(--primary)' }}>
                      Full Research Document Content
                    </h2>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'inherit' }}>
                      {rawPaperText}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODE 3: PAGINATED PAGE TURN READER                            */}
          {/* ============================================================ */}
          {viewMode === 'page' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '16px', fontFamily: 'var(--font-serif)', fontSize: `${fontSize}px`, lineHeight: 1.75 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                    Section / Page {safeCurrentPage} of {totalPages}
                  </h2>
                  <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>
                    {activePageText.length} characters
                  </span>
                </div>

                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'inherit' }}>
                  {activePageText}
                </div>

                {!hasFullText && !isExtractingPdfText && safeCurrentPage >= totalPages && (
                  <div style={{
                    marginTop: '24px',
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <ShieldCheck size={20} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', fontFamily: 'var(--font-sans, inherit)' }}>
                          End of available text
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans, inherit)', lineHeight: 1.5, marginTop: '2px' }}>
                          {publisherLink
                            ? "This is the abstract — we couldn't pull the full text into your library (the publisher may block automatic downloads). Continue reading the rest of the paper on the publisher's site."
                            : "This is the abstract — no PDF is attached to this paper, so the full text isn't available in your library. Attach a PDF from the library screen, or find the paper's source to keep reading."}
                        </div>
                      </div>
                    </div>
                    {publisherLink && (
                      <a
                        href={publisherLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                        style={{ padding: '8px 14px', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }}
                      >
                        <span>Continue Reading at Publisher</span>
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* AI ASSISTANT SIDE PANEL — slides in from the right            */}
        {/* ============================================================ */}
        {showAiPanel && (
          <div
            className="ai-reader-panel"
            style={{
              width: isSmallScreen ? '100%' : '420px',
              maxWidth: '100vw',
              position: isSmallScreen ? 'fixed' : 'relative',
              inset: isSmallScreen ? 0 : 'auto',
              borderLeft: isSmallScreen ? 'none' : '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
              zIndex: isSmallScreen ? 600 : 110,
              animation: 'slideInRight 0.25s ease-out'
            }}
          >
            {/* AI Panel Header */}
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card)',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                  <Sparkles size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>AI Paper Assistant</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600 }}>Powered by Gemini AI</div>
                </div>
              </div>
              <button onClick={() => setShowAiPanel(false)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {/* AI Panel Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              {/* Summary Type Tabs */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {aiSummaryTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      setAiSummaryType(type);
                      handleAiGenerateSummary(type);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      backgroundColor: aiSummaryType === type ? 'var(--primary)' : 'var(--bg-main)',
                      color: aiSummaryType === type ? '#fff' : 'var(--text-muted)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Extraction Status */}
              {aiExtractingText && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--primary)' }}>
                  <FileSearch size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Reading PDF content...</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Extracting text from your uploaded document</div>
                </div>
              )}

              {/* Loading Spinner */}
              {aiLoading && !aiExtractingText && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--primary)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Analyzing paper with Gemini AI...</div>
                </div>
              )}

              {/* Error */}
              {aiError && (
                <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.8rem', marginBottom: '12px' }}>
                  {aiError}
                </div>
              )}

              {/* AI Generated Summary Result */}
              {aiSummaryResult && !aiLoading && (
                <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>Generated {aiSummaryType}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(aiSummaryResult);
                          setAiCopied(true);
                          setTimeout(() => setAiCopied(false), 2000);
                        }}
                        style={{ color: 'var(--primary)', padding: '3px' }}
                        title="Copy to clipboard"
                      >
                        {aiCopied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button
                        onClick={() => handleAiSaveNote(`AI ${aiSummaryType}:\n${aiSummaryResult}`)}
                        title="Save to Research Notes"
                        style={{ color: 'var(--primary)', padding: '3px' }}
                      >
                        <BookmarkPlus size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.55, whiteSpace: 'pre-line', color: 'var(--text-main)' }}>
                    {aiSummaryResult}
                  </div>
                </div>
              )}

              {/* Q&A Chat History */}
              {aiChatHistory.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px', color: 'var(--text-main)' }}>Q&A Conversation</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {aiChatHistory.map((item, idx) => (
                      <div key={idx} style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'var(--bg-main)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.78rem', marginBottom: '4px' }}>Q: {item.q}</div>
                        <div style={{ fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--text-main)' }}>{item.a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div ref={aiChatEndRef} />
            </div>

            {/* AI Question Input */}
            <form onSubmit={handleAiAskQuestion} style={{
              display: 'flex',
              gap: '8px',
              padding: '12px 16px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              flexShrink: 0
            }}>
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Ask about this paper..."
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  fontSize: '0.82rem',
                  color: 'var(--text-main)'
                }}
              />
              <button type="submit" className="btn-primary" disabled={aiLoading || !aiQuestion.trim()} style={{ padding: '8px 12px' }}>
                <Send size={14} />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Reader Footer Controls */}
      <footer style={{
        padding: '12px 24px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--header-bg)'
      }}>
        {viewMode === 'pdf' && pdfJsDoc ? (
          <>
            <button
              disabled={safePdfPage <= 1}
              onClick={() => setPdfJsPageNum(p => Math.max(1, p - 1))}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: safePdfPage <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={20} /> <span className="btn-text">Previous</span>
            </button>

            {/* PDF Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
              <button onClick={() => setPdfJsScale(s => Math.max(0.6, +(s - 0.2).toFixed(2)))} style={{ fontWeight: 800, padding: '2px 6px' }}>-</button>
              <span>{Math.round(pdfJsScale * 100)}%</span>
              <button onClick={() => setPdfJsScale(s => Math.min(3, +(s + 0.2).toFixed(2)))} style={{ fontWeight: 800, padding: '2px 6px' }}>+</button>
            </div>

            <button
              disabled={safePdfPage >= pdfJsNumPages}
              onClick={() => setPdfJsPageNum(p => Math.min(pdfJsNumPages, p + 1))}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: safePdfPage >= pdfJsNumPages ? 0.4 : 1 }}
            >
              <span className="btn-text">Next</span> <ChevronRight size={20} />
            </button>
          </>
        ) : (
          <>
            <button 
              disabled={safeCurrentPage <= 1} 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: safeCurrentPage <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={20} /> <span className="btn-text">Previous</span>
            </button>

            {/* Font Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
              <button onClick={() => setFontSize(prev => Math.max(12, prev - 2))} style={{ fontWeight: 800, padding: '2px 6px' }}>A-</button>
              <span>{fontSize}pt</span>
              <button onClick={() => setFontSize(prev => Math.min(28, prev + 2))} style={{ fontWeight: 800, padding: '2px 6px' }}>A+</button>
            </div>

            <button 
              disabled={safeCurrentPage >= totalPages} 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: safeCurrentPage >= totalPages ? 0.4 : 1 }}
            >
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
            <button onClick={() => setShowNotesDrawer(false)}><X size={18} /></button>
          </div>

          <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add observation..."
              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '8px' }}><Send size={14} /></button>
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
