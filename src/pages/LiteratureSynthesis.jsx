import React, { useState } from 'react';
import { Sparkles, CheckSquare, Square, Loader2, Copy, Check, Download, FileText, Layers, CheckCircle } from 'lucide-react';
import { synthesizeLiteratureReview, generatePeerReview } from '../services/geminiService';
import { exportReviewToPdf } from '../utils/exportReviewToPdf';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';

export default function LiteratureSynthesis({ resources }) {
  const [mode, setMode] = useState('synthesis'); // 'synthesis', 'peer_review'
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState('');
  const [copied, setCopied] = useState(false);

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

  const handleGenerate = async () => {
    if (selectedIds.length === 0 || loading) return;
    setLoading(true);
    setReviewResult('');

    try {
      if (mode === 'synthesis') {
        const selectedPapers = resources.filter(r => selectedIds.includes(r.id));
        // Ensure each paper has extracted content
        const processedPapers = await Promise.all(selectedPapers.map(async p => ({
          ...p,
          abstractText: await getPaperContent(p)
        })));
        const result = await synthesizeLiteratureReview(processedPapers);
        setReviewResult(result);
      } else {
        const paper = selectedPaper;
        if (paper) {
          const content = await getPaperContent(paper);
          const result = await generatePeerReview(
            paper.title,
            paper.authors,
            `${paper.journal || ''}, ${paper.publicationYear || ''}`,
            content
          );
          setReviewResult(result);
        }
      }
    } catch (err) {
      setReviewResult("Failed to generate evaluation. Please verify Gemini API connectivity.");
    } finally {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 800 }}>AI Literature Review & Peer Review Engine</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Synthesize multi-paper literature reviews or generate single-paper formal academic peer review reports.</p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="ai-toolbar" style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--bg-card)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
        <button
          onClick={() => { setMode('synthesis'); setSelectedIds([]); setReviewResult(''); }}
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
          <Layers size={16} /> Literature Synthesis (Multi-Paper)
        </button>

        <button
          onClick={() => { setMode('peer_review'); setSelectedIds([]); setReviewResult(''); }}
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
          <FileText size={16} /> Professional Peer Review (Single Paper)
        </button>
      </div>

      <div className="synthesis-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Paper Selection */}
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

            <button
              onClick={handleGenerate}
              className="btn-primary"
              disabled={selectedIds.length === 0 || loading}
              style={{ opacity: selectedIds.length === 0 ? 0.5 : 1 }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>{mode === 'synthesis' ? 'Synthesize Review' : 'Generate Peer Review'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
            {resources.map(r => {
              const isSelected = selectedIds.includes(r.id);
              return (
                <div
                  key={r.id}
                  onClick={() => toggleSelect(r.id)}
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
                  <div style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {isSelected ? (mode === 'peer_review' ? <CheckCircle size={20} /> : <CheckSquare size={20} />) : <Square size={20} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.authors} ({r.publicationYear})</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Generated Report */}
        <div className="glass-card synthesis-output" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              {mode === 'synthesis' ? 'Generated Synthesis Review' : 'Peer Review Report Output'}
            </h3>
            {reviewResult && (
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

          {loading ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                border: '4px solid var(--border-color)',
                borderTopColor: 'var(--primary)',
                animation: 'spin 0.9s linear infinite',
                boxShadow: '0 0 20px rgba(0, 255, 136, 0.3)'
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
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-main)',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              overflowY: 'auto',
              maxHeight: '480px'
            }}>
              {reviewResult}
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
