import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, CheckSquare, Square, StopCircle, Copy, Check, Download, FileText, Layers, CheckCircle, Maximize2, Minimize2 } from 'lucide-react';
import { synthesizeLiteratureReview, generatePeerReview } from '../services/geminiService';
import { exportReviewToPdf } from '../utils/exportReviewToPdf';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';
import MarkdownMessage from '../components/MarkdownMessage';

export default function LiteratureSynthesis({ resources }) {
  const [mode, setMode] = useState('synthesis');
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const abortRef = useRef(null);

  const stopGenerating = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  useEffect(() => stopGenerating, []);

  const toggleSelect = (id) => {
    if (mode === 'peer_review') {
      setSelectedIds(prev => prev.includes(id) ? [] : [id]);
    } else {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }
  };

  const selectedPaper = mode === 'peer_review' ? resources.find(r => r.id === selectedIds[0]) : null;

  const getPaperContent = async (paper) => {
    let content = paper.abstractText;
    const isPlaceholder = !content || content.includes('Imported paper document in ResearchVault');

    if (isPlaceholder && paper.pdfFileData && paper.pdfFileData.startsWith('data:')) {
      try {
        const parts = paper.pdfFileData.split(';base64,');
        if (parts[1]) {
          const raw = window.atob(parts[1]);
          const u8 = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
          const file = new File([u8], paper.pdfFileName || 'paper.pdf', { type: 'application/pdf' });
          const extracted = await extractTextFromPdfFile(file);
          if (extracted && extracted.trim().length > 30) {
            content = extracted;
          }
        }
      } catch (err) {
        console.warn("On-the-fly extraction error:", err);
      }
    }

    return content || paper.title;
  };

  const minPapers = mode === 'synthesis' ? 2 : 1;
  const canGenerate = selectedIds.length >= minPapers;

  const handleGenerate = async () => {
    if (!canGenerate || loading) return;
    setLoading(true);
    setReviewResult('');
    setIsExpanded(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const options = {
      onChunk: (chunk) => setReviewResult(prev => prev + chunk),
      signal: controller.signal
    };

    try {
      if (mode === 'synthesis') {
        const selectedPapers = resources.filter(r => selectedIds.includes(r.id));
        const processedPapers = await Promise.all(selectedPapers.map(async p => ({
          ...p,
          abstractText: await getPaperContent(p)
        })));
        const result = await synthesizeLiteratureReview(processedPapers, options);
        setReviewResult(result);
      } else {
        const paper = selectedPaper;
        if (paper) {
          const content = await getPaperContent(paper);
          const result = await generatePeerReview(
            paper.title,
            paper.authors,
            `${paper.journal || ''}, ${paper.publicationYear || ''}`,
            content,
            options
          );
          setReviewResult(result);
        }
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setReviewResult(prev => prev || 'Failed to generate evaluation. Please verify Gemini API connectivity.');
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const handleExportPdf = () => {
    if (!reviewResult) return;
    const title = mode === 'peer_review' 
      ? `Peer Review Report - ${selectedPaper?.title || 'Paper'}` 
      : 'Systematic Literature Review';
    exportReviewToPdf(reviewResult, title);
  };

  const awaitingFirstToken = loading && !reviewResult.trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 800 }}>AI Literature Review & Peer Review Engine</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Synthesize multi-paper literature reviews or generate single-paper formal academic peer review reports.</p>
      </div>

      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className="ai-toolbar" role="group" aria-label="Review mode" style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--bg-card)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
          <button
            type="button"
            onClick={() => { setMode('synthesis'); setSelectedIds([]); setReviewResult(''); setIsExpanded(false); }}
            aria-pressed={mode === 'synthesis'}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: mode === 'synthesis' ? 'var(--primary)' : 'transparent',
              color: mode === 'synthesis' ? '#ffffff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Layers size={16} aria-hidden="true" /> Literature Synthesis (Multi-Paper)
          </button>

          <button
            type="button"
            onClick={() => { setMode('peer_review'); setSelectedIds([]); setReviewResult(''); setIsExpanded(false); }}
            aria-pressed={mode === 'peer_review'}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: mode === 'peer_review' ? 'var(--primary)' : 'transparent',
              color: mode === 'peer_review' ? '#ffffff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FileText size={16} aria-hidden="true" /> Professional Peer Review (Single Paper)
          </button>
        </div>

        {/* Focus Mode Toggle Button */}
        {isExpanded ? (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Minimize2 size={16} aria-hidden="true" /> Show Paper Selector
          </button>
        ) : reviewResult ? (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Maximize2 size={16} aria-hidden="true" /> Expand Full Reading View
          </button>
        ) : null}
      </div>

      <div className="synthesis-grid" style={{ display: 'grid', gridTemplateColumns: isExpanded ? '1fr' : '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Paper Selection (Hidden in Focus Reading Mode) */}
        {!isExpanded && (
          <div className="glass-card ai-review-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  {mode === 'synthesis' ? `Select Papers (${selectedIds.length} Selected)` : `Select 1 Paper to Review (${selectedIds.length} Selected)`}
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {mode === 'synthesis' ? 'Choose 2 or more papers to compare' : 'Choose 1 paper for a full Peer Review Report'}
                </div>
              </div>

              {loading ? (
                <button
                  type="button"
                  onClick={stopGenerating}
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <StopCircle size={16} aria-hidden="true" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="btn-primary"
                  disabled={!canGenerate}
                  style={{ opacity: canGenerate ? 1 : 0.5 }}
                >
                  <Sparkles size={16} aria-hidden="true" />
                  <span>{mode === 'synthesis' ? 'Synthesize Review' : 'Generate Peer Review'}</span>
                </button>
              )}
            </div>

            <div role="group" aria-label="Select papers to include" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
              {resources.map(r => {
                const isSelected = selectedIds.includes(r.id);
                return (
                  <label
                    key={r.id}
                    htmlFor={`synthesis-paper-${r.id}`}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-main)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <input
                      id={`synthesis-paper-${r.id}`}
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => toggleSelect(r.id)}
                    />
                    <span aria-hidden="true" style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
                      {isSelected ? (mode === 'peer_review' ? <CheckCircle size={20} /> : <CheckSquare size={20} />) : <Square size={20} />}
                    </span>
                    <span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block' }}>{r.title}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{r.authors} ({r.publicationYear})</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Right Column: Generated Report (Expands to 100% width when reading) */}
        <div className="glass-card synthesis-output" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                {mode === 'synthesis' ? 'Generated Synthesis Review' : 'Peer Review Report Output'}
              </h3>
              {isExpanded && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  title="Show paper selection list again"
                >
                  <Minimize2 size={12} />
                  <span>Exit Focus View</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isExpanded && reviewResult && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className="btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  title="Enlarge reading panel"
                >
                  <Maximize2 size={14} />
                  <span>Enlarge</span>
                </button>
              )}

              {loading && isExpanded && (
                <button
                  type="button"
                  onClick={stopGenerating}
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <StopCircle size={16} aria-hidden="true" />
                  <span>Stop</span>
                </button>
              )}

              {/* Action buttons when complete */}
              {reviewResult && !loading && (
                <div className="action-button-group" style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(reviewResult);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <button 
                    onClick={handleExportPdf}
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Download size={14} />
                    <span>Download PDF</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {awaitingFirstToken ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                border: '4px solid var(--border-color)',
                borderTopColor: 'var(--primary)',
                animation: 'spin 0.9s linear infinite'
              }} />
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                {mode === 'synthesis' ? 'Gemini AI is synthesizing methodologies & research gaps...' : 'Gemini AI is drafting formal Peer Review Report...'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Parsing document text content & running academic evaluation...
              </div>
            </div>
          ) : reviewResult ? (
            <div className="synthesis-output-content" style={{
              flex: 1,
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-main)',
              fontSize: '0.92rem',
              overflowY: 'auto',
              maxHeight: isExpanded ? 'calc(100vh - 220px)' : '480px',
              minHeight: isExpanded ? '320px' : 'auto'
            }}>
              <MarkdownMessage>{reviewResult}</MarkdownMessage>
              {loading && (
                <div className="md-streaming" style={{ fontSize: '0.8rem', marginTop: '10px' }}>
                  Writing the review…
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {mode === 'synthesis' 
                ? 'Select 2 or more papers on the left and click "Synthesize Review" to generate a comparative synthesis.'
                : 'Select 1 paper on the left and click "Generate Peer Review" to produce a formal academic Peer Review Report.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
