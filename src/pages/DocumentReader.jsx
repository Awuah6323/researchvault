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

  const aiSummaryTypes = ['Executive Summary', 'Key Takeaways', 'Methodology & Proofs', 'Limitations & Critique', 'Peer Review'];

  const totalPages = 10;
  const progressPercent = Math.round((currentPage / totalPages) * 100);

  useEffect(() => {
    storage.updateReadingProgress(resource.id, progressPercent, currentPage);
    setNotes(storage.getNotes(resource.id));
  }, [currentPage]);

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const updated = storage.addNote(resource.id, newNote.trim(), currentPage);
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

  useEffect(() => {
    let createdUrl = null;
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
          setPdfBlobUrl(createdUrl);
        } catch (err) {
          console.error("Base64 PDF conversion error:", err);
          setPdfBlobUrl(resource.pdfFileData);
        }
      } else {
        setPdfBlobUrl(resource.pdfFileData);
      }
    } else if (resource.downloadUrl) {
      setPdfBlobUrl(resource.downloadUrl);
    }
    return () => {
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [resource.pdfFileData, resource.downloadUrl]);

  // --- AI Assistant Logic ---
  const getResolvedContent = async () => {
    if (resolvedContentRef.current !== null) return resolvedContentRef.current;
    const stored = resource.abstractText || '';
    const isPlaceholder =
      !stored.trim() ||
      stored.trim() === PLACEHOLDER_TEXT ||
      stored.trim().toLowerCase() === 'imported paper document in researchvault digital library.';

    if (isPlaceholder && resource.pdfFileData) {
      setAiExtractingText(true);
      const extracted = await extractTextFromDataUrl(
        resource.pdfFileData,
        resource.pdfFileName || `${resource.title}.pdf`
      );
      setAiExtractingText(false);
      const content = extracted && extracted.trim().length > 40 ? extracted.trim() : stored;
      resolvedContentRef.current = content;
      return content;
    }
    resolvedContentRef.current = stored;
    return stored;
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
    // Auto-generate summary on first open
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
    storage.addNote(resource.id, text, currentPage);
    setNotes(storage.getNotes(resource.id));
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      backgroundColor: themeColors.bg,
      color: themeColors.text,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Reader Header */}
      <header style={{
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--header-bg)',
        backdropFilter: 'blur(8px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
          <button onClick={onClose} style={{ color: 'inherit', padding: '6px', flexShrink: 0 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resource.title}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Page {currentPage} of {totalPages} • {progressPercent}% Completed</div>
          </div>
        </div>

        {/* Reader Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleOpenAiPanel}
            className="btn-primary"
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              backgroundColor: showAiPanel ? 'var(--secondary)' : undefined,
            }}
          >
            <Sparkles size={16} />
            <span>AI Assistant</span>
          </button>

          {(pdfBlobUrl || resource.pdfFileData || resource.downloadUrl || resource.sourceUrl) && (
            <a
              href={pdfBlobUrl || resource.pdfFileData || resource.downloadUrl || resource.sourceUrl}
              download={resource.pdfFileName || `${resource.title}.pdf`}
              target={pdfBlobUrl ? undefined : "_blank"}
              rel={pdfBlobUrl ? undefined : "noopener noreferrer"}
              title="Download PDF Document"
              style={{ padding: '8px', color: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Download size={18} />
            </a>
          )}

          <button onClick={() => { setShowNotesDrawer(!showNotesDrawer); setShowAiPanel(false); }} style={{ padding: '8px', color: 'inherit' }}>
            <FileText size={18} />
          </button>

          {/* Delete Paper Button */}
          {onDeleteResource && (
            <button
              onClick={() => {
                if (window.confirm(`Delete "${resource.title}" from your library?`)) {
                  onDeleteResource(resource.id);
                  onClose();
                }
              }}
              title="Delete paper from library"
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                color: '#ef4444',
                backgroundColor: 'rgba(239,68,68,0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          )}

          {/* Theme Selector */}
          <select
            value={readerTheme}
            onChange={(e) => setReaderTheme(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'inherit' }}
          >
            <option value="light">Light</option>
            <option value="sepia">Sepia</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </header>

      {/* Main Content Area — side-by-side with AI panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Document Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '30px max(20px, (100vw - 840px) / 2)', transition: 'all 0.3s ease' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>{resource.title}</h1>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, opacity: 0.8, marginBottom: '16px' }}>{resource.authors} ({resource.publicationYear})</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '24px' }}>Published in: {resource.journal || 'Academic Repository'}</div>

          {resource.pdfFileData ? (
            <div style={{ height: '700px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '24px', backgroundColor: '#1e293b' }}>
              {pdfBlobUrl ? (
                <object
                  data={pdfBlobUrl}
                  type="application/pdf"
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                >
                  <iframe
                    src={pdfBlobUrl}
                    title={resource.title}
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                  />
                </object>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <FileCode size={40} style={{ color: 'var(--primary)' }} />
                  <div style={{ fontWeight: 700 }}>Loading PDF Document...</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              {/* Publisher PDF Action Bar */}
              {(resource.downloadUrl || resource.sourceUrl) && (
                <div style={{
                  padding: '20px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ShieldCheck size={28} style={{ color: '#10b981' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                        Publisher Paper Document ({resource.openAccess ? 'Open Access' : 'Verified Metadata'})
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        External academic sources (arXiv, IEEE, OpenAlex) protect iframe embedding. Access full PDF directly:
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    {(resource.downloadUrl || resource.sourceUrl) && (
                      <a
                        href={resource.downloadUrl || resource.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                        style={{ padding: '8px 16px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Download size={16} />
                        <span>Open / Download Full PDF</span>
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Abstract Text Reader */}
              <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '20px', fontFamily: 'var(--font-serif)', fontSize: `${fontSize}px`, lineHeight: 1.7 }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Abstract</h2>
                <p style={{ marginBottom: '24px' }}>{resource.abstractText}</p>

                <h2 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Chapter {currentPage}: Research Background & Methodology</h2>
                <p style={{ marginBottom: '16px' }}>
                  Academic research requires methodical literature synthesis, persistent document storage, and flexible citation management. ResearchVault provides direct access to open-access scholarly materials.
                </p>
                <p style={{ marginBottom: '16px' }}>
                  In recent years, scholarly publications have accelerated in volume. Modern researchers require built-in annotation tools, citation formatting engines, and categorized collection managers to streamline their study workflows.
                </p>
                <p style={{ marginBottom: '16px' }}>
                  Experimental results confirm a significant reduction in citation assembly time and enhanced literature synthesis when utilizing structured data representation models.
                </p>
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
              width: '420px',
              maxWidth: '100vw',
              borderLeft: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
              zIndex: 110,
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
        <button 
          disabled={currentPage <= 1} 
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: currentPage <= 1 ? 0.4 : 1 }}
        >
          <ChevronLeft size={20} /> Previous Page
        </button>

        {/* Font Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem' }}>
          <button onClick={() => setFontSize(prev => Math.max(12, prev - 2))} style={{ fontWeight: 800 }}>A-</button>
          <span>{fontSize} pt</span>
          <button onClick={() => setFontSize(prev => Math.min(28, prev + 2))} style={{ fontWeight: 800 }}>A+</button>
        </div>

        <button 
          disabled={currentPage >= totalPages} 
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: currentPage >= totalPages ? 0.4 : 1 }}
        >
          Next Page <ChevronRight size={20} />
        </button>
      </footer>

      {/* Notes Drawer */}
      {showNotesDrawer && (
        <div className="notes-drawer-mobile" style={{
          position: 'fixed',
          right: 0,
          top: '60px',
          bottom: '60px',
          width: '320px',
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
