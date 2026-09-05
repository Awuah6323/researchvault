import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles, FileText, ChevronLeft, ChevronRight, Send, Download, ExternalLink, Trash2, Loader2, X, FileSearch } from 'lucide-react';
import { storage } from '../services/storage';
import { generatePaperSummary, askPaperQuestion, generatePeerReview } from '../services/geminiService';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';
import { getPdfData, dataUrlToUint8Array } from '../services/pdfStorage';
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
  const [fontSize, setFontSize] = useState(17);
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
  const [aiExtractingText, setAiExtractingText] = useState(false);
  const resolvedContentRef = useRef(null);
  const aiChatEndRef = useRef(null);
  const isExtractingPdfTextRef = useRef(false);

  const aiSummaryTypes = ['Executive Summary', 'Key Takeaways', 'Methodology & Proofs', 'Limitations & Critique', 'Peer Review'];

  const [extractedFullText, setExtractedFullText] = useState(resource.fullText || '');
  const [isExtractingText, setIsExtractingText] = useState(false);
  const extractedFullTextRef = useRef(resource.fullText || '');
  useEffect(() => { isExtractingPdfTextRef.current = isExtractingText; }, [isExtractingText]);
  useEffect(() => { extractedFullTextRef.current = extractedFullText; }, [extractedFullText]);

  const isSmallScreen = useIsSmallScreen(880);

  // Background auto-extraction if full text is missing but document bytes are available
  useEffect(() => {
    let active = true;
    const currentText = (resource.fullText || extractedFullText || '').trim();
    const needsExtraction = !currentText || currentText === PLACEHOLDER_TEXT || currentText.toLowerCase().includes('imported paper document in researchvault');

    if (needsExtraction && resource.id) {
      (async () => {
        try {
          let bytes = await getPdfData(resource.id);
          if (!bytes && resource.pdfFileData) {
            bytes = dataUrlToUint8Array(resource.pdfFileData);
          }
          if (active && bytes && bytes.length > 50) {
            setIsExtractingText(true);
            const file = new File([bytes], resource.pdfFileName || 'paper.pdf', { type: 'application/pdf' });
            const extracted = await extractTextFromPdfFile(file);
            if (active && extracted && extracted.trim().length > 40) {
              const cleanText = extracted.trim();
              setExtractedFullText(cleanText);
              try {
                storage.updateResource(resource.id, { fullText: cleanText });
              } catch (e) {}
            }
          }
        } catch (err) {
          console.warn('[DocumentReader] Text extraction error:', err);
        } finally {
          if (active) setIsExtractingText(false);
        }
      })();
    }
    return () => { active = false; };
  }, [resource.id]);

  const hasRealText = Boolean(
    extractedFullText &&
    extractedFullText.trim().length > 40 &&
    extractedFullText.trim() !== PLACEHOLDER_TEXT &&
    !extractedFullText.toLowerCase().includes('imported paper document in researchvault') &&
    extractedFullText.trim() !== (resource.abstractText || '').trim()
  );

  const rawPaperText = extractedFullText || resource.fullText || resource.abstractText || '';
  const isAbstractOnly = !hasRealText || (rawPaperText || '').length < 800 || rawPaperText === (resource.abstractText || '').trim();

  // Text Pagination
  const paperPages = React.useMemo(() => {
    if (!rawPaperText || !rawPaperText.trim() || rawPaperText === PLACEHOLDER_TEXT) {
      return ['No text content available for this document.'];
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

  // Sync reading progress and notes
  useEffect(() => {
    storage.updateReadingProgress(resource.id, progressPercent, safeCurrentPage);
    setNotes(storage.getNotes(resource.id));
  }, [safeCurrentPage, resource.id]);

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
  }, [aiChatHistory]);

  // Modal setup, key navigation & focus management
  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => {
      readerRef.current?.focus();
    });

    announce(`Opened reader for ${resource.title}. Page ${safeCurrentPage} of ${totalPages}.`);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (document.querySelector('[role="alertdialog"]')) return;
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
        setCurrentPage(p => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
        setCurrentPage(p => Math.min(totalPages, p + 1));
      }
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
        } catch (e) {}
      }
    };
  }, [totalPages, safeCurrentPage]);

  // Delete paper confirmation
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
        padding: isSmallScreen ? '8px 12px' : '10px 18px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        backgroundColor: 'var(--header-bg)',
        backdropFilter: 'blur(8px)',
        zIndex: 510,
        flexShrink: 0
      }}>
        {/* Left: Back button + Title & Page Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <button
            type="button"
            onClick={onClose}
            title="Back to Library"
            aria-label="Close reader and return to library"
            style={{ color: 'inherit', padding: '6px', flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '6px' }}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="reader-title-text" style={{
              fontWeight: 700,
              fontSize: isSmallScreen ? '0.88rem' : '0.96rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.2
            }}>
              {resource.title}
            </div>
            <div style={{ fontSize: '0.74rem', opacity: 0.8, marginTop: '2px', whiteSpace: 'nowrap' }}>
              Page {safeCurrentPage} of {totalPages} • {progressPercent}% read
            </div>
          </div>
        </div>

        {/* Right Actions: Page Badge, AI, Notes, Links, Theme, Delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: '6px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            color: 'var(--primary)',
            whiteSpace: 'nowrap'
          }}>
            Page {safeCurrentPage} / {totalPages}
          </span>

          <button
            type="button"
            onClick={handleOpenAiPanel}
            className="btn-primary"
            style={{ padding: '5px 10px', fontSize: '0.78rem', backgroundColor: showAiPanel ? 'var(--secondary)' : undefined, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Open AI Paper Assistant"
          >
            <Sparkles size={14} /> <span className="btn-text">AI</span>
          </button>

          {(resource.downloadUrl || resource.sourceUrl) && (
            <a
              href={resource.downloadUrl || resource.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '6px', color: '#10b981', display: 'inline-flex', alignItems: 'center' }}
              title="Download or View Original Source"
            >
              <Download size={16} />
            </a>
          )}

          <button
            type="button"
            onClick={() => { setShowNotesDrawer(!showNotesDrawer); setShowAiPanel(false); }}
            style={{ padding: '6px', color: 'inherit', border: 'none', background: 'none', cursor: 'pointer' }}
            title="Notes for this page"
            aria-label={showNotesDrawer ? 'Hide notes panel' : 'Show notes panel'}
            aria-expanded={showNotesDrawer}
          >
            <FileText size={16} aria-hidden="true" />
          </button>

          <label htmlFor="reader-theme-select" className="sr-only">Reader colour theme</label>
          <select
            id="reader-theme-select"
            value={readerTheme}
            onChange={(e) => setReaderTheme(e.target.value)}
            style={{ padding: '4px 6px', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'inherit' }}
          >
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
      </header>

      {/* Main Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          padding: isSmallScreen ? '16px' : '24px max(20px, (100vw - 860px) / 2)'
        }}>
          {/* Paper Metadata Header */}
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: isSmallScreen ? '1.4rem' : '1.75rem', fontWeight: 800, marginBottom: '6px', lineHeight: 1.25 }}>
              {resource.title}
            </h1>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.85 }}>
              {resource.authors} {resource.publicationYear ? `(${resource.publicationYear})` : ''}
            </div>
            {resource.journal && (
              <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600, marginTop: '4px' }}>
                Published in: {resource.journal}
              </div>
            )}
          </div>

          {/* Active Extraction Loading Spinner */}
          {isExtractingText && (
            <div style={{ padding: '24px 16px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', marginBottom: '20px' }}>
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>Extracting Paper Pages & Text...</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Preparing pages for your reader</div>
              </div>
            </div>
          )}

          {/* External Link Banner when only abstract is available */}
          {isAbstractOnly && !isExtractingText && (resource.sourceUrl || resource.downloadUrl || resource.doi) && (
            <div style={{
              margin: '8px 0 16px',
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ExternalLink size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>Viewing Abstract Summary</span>
              </div>
              <a
                href={resource.sourceUrl || resource.downloadUrl || (resource.doi ? `https://doi.org/${resource.doi}` : '#')}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{
                  padding: '6px 14px',
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
                <ExternalLink size={13} /> Read Full Paper Online
              </a>
            </div>
          )}

          {/* Paginated Page Content */}
          <div style={{
            borderTop: '2px solid var(--border-color)',
            paddingTop: '18px',
            fontFamily: 'var(--font-serif)',
            fontSize: `${fontSize}px`,
            lineHeight: 1.8,
            minHeight: '400px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                Page {safeCurrentPage} of {totalPages}
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {progressPercent}% completed
              </span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', letterSpacing: '0.01em' }}>
              {activePageText}
            </div>
          </div>
        </div>

        {/* AI Paper Assistant Drawer */}
        {showAiPanel && (
          <div className="ai-reader-panel" style={{ width: isSmallScreen ? '100%' : '420px', borderLeft: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                <div style={{ fontWeight: 800 }}>AI Paper Assistant</div>
              </div>
              <button type="button" onClick={() => setShowAiPanel(false)} aria-label="Close AI paper assistant" style={{ color: 'var(--text-muted)', border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {aiSummaryTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => { setAiSummaryType(type); handleAiGenerateSummary(type); }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      backgroundColor: aiSummaryType === type ? 'var(--primary)' : 'var(--bg-main)',
                      color: aiSummaryType === type ? '#fff' : 'var(--text-muted)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                  >
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
              <input
                id="reader-ai-question"
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Ask about this paper..."
                style={{ flex: 1, padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.82rem' }}
              />
              <button type="submit" className="btn-primary" aria-label="Send question to AI assistant" style={{ padding: '8px 12px' }}>
                <Send size={14} aria-hidden="true" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Footer Controls: Previous, Font Size A- / A+, Next */}
      <footer style={{ padding: '12px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--header-bg)', flexShrink: 0 }}>
        <button
          disabled={safeCurrentPage <= 1}
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          style={{ opacity: safeCurrentPage <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '4px', cursor: safeCurrentPage <= 1 ? 'default' : 'pointer' }}
          aria-label="Previous Page"
        >
          <ChevronLeft size={18} /> <span className="btn-text">Previous</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem' }}>
          <button
            type="button"
            onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
            style={{ fontWeight: 800, padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'inherit', cursor: 'pointer' }}
            title="Decrease font size"
            aria-label="Decrease font size"
          >
            A-
          </button>
          <span style={{ fontWeight: 600, minWidth: '40px', textAlign: 'center' }}>{fontSize}pt</span>
          <button
            type="button"
            onClick={() => setFontSize(prev => Math.min(28, prev + 2))}
            style={{ fontWeight: 800, padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'inherit', cursor: 'pointer' }}
            title="Increase font size"
            aria-label="Increase font size"
          >
            A+
          </button>
        </div>

        <button
          disabled={safeCurrentPage >= totalPages}
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          style={{ opacity: safeCurrentPage >= totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '4px', cursor: safeCurrentPage >= totalPages ? 'default' : 'pointer' }}
          aria-label="Next Page"
        >
          <span className="btn-text">Next</span> <ChevronRight size={18} />
        </button>
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
          zIndex: 520
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Notes for Page {safeCurrentPage}</h3>
            <button type="button" onClick={() => setShowNotesDrawer(false)} aria-label="Close notes panel" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            <label htmlFor="reader-new-note" className="sr-only">Add a note for page {safeCurrentPage}</label>
            <input
              id="reader-new-note"
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add observation..."
              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            />
            <button type="submit" className="btn-primary" aria-label="Save note" style={{ padding: '8px' }}>
              <Send size={14} aria-hidden="true" />
            </button>
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
