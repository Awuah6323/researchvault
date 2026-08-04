import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Bookmark, FileText, ChevronLeft, ChevronRight, Plus, Send, Download, ExternalLink, FileCode, ShieldCheck, X } from 'lucide-react';
import { storage } from '../services/storage';

export default function DocumentReader({ resource, onClose, onOpenAiSummarizer }) {
  const [currentPage, setCurrentPage] = useState(resource.lastPageRead || 1);
  const [fontSize, setFontSize] = useState(16);
  const [readerTheme, setReaderTheme] = useState('light'); // light, sepia, dark
  const [notes, setNotes] = useState([]);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [newNote, setNewNote] = useState('');

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={onClose} style={{ color: 'inherit', padding: '6px' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{resource.title}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Page {currentPage} of {totalPages} • {progressPercent}% Completed</div>
          </div>
        </div>

        {/* Reader Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => onOpenAiSummarizer(resource)} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
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

          <button onClick={() => setShowNotesDrawer(!showNotesDrawer)} style={{ padding: '8px', color: 'inherit' }}>
            <FileText size={18} />
          </button>

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

      {/* Main Document Text Content Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '30px max(20px, (100vw - 840px) / 2)' }}>
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
        <div style={{
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
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)'
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
