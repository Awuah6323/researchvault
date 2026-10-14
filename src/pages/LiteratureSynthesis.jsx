import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, CheckSquare, Square, StopCircle, Copy, Check, Download, FileText, Layers, CheckCircle, Maximize2, Minimize2, ShieldAlert, Compass, Volume2, Code2 } from 'lucide-react';
import { synthesizeLiteratureReview, generatePeerReview, generateResearchGaps, generateRedTeamCritique } from '../services/geminiService';
import { generateLatexSynthesisDocument } from '../services/citationGenerator';
import { exportReviewToPdf } from '../utils/exportReviewToPdf';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';
import MarkdownMessage from '../components/MarkdownMessage';
import AudioBriefPlayer from '../components/AudioBriefPlayer';
import { useToast } from '../components/FeedbackProvider';

export default function LiteratureSynthesis({ resources = [] }) {
  const [mode, setMode] = useState('synthesis'); // 'synthesis', 'gaps', 'red_team', 'peer_review'
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAudioBrief, setShowAudioBrief] = useState(false);
  const abortRef = useRef(null);
  const toast = useToast();

  const stopGenerating = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  useEffect(() => stopGenerating, []);

  const isSinglePaperMode = mode === 'peer_review' || mode === 'red_team';

  const toggleSelect = (id) => {
    if (isSinglePaperMode) {
      setSelectedIds(prev => prev.includes(id) ? [] : [id]);
    } else {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }
  };

  const selectedPaper = isSinglePaperMode ? resources.find(r => r.id === selectedIds[0]) : null;

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

  const minPapers = isSinglePaperMode ? 1 : 2;
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
      } else if (mode === 'gaps') {
        const selectedPapers = resources.filter(r => selectedIds.includes(r.id));
        const processedPapers = await Promise.all(selectedPapers.map(async p => ({
          ...p,
          abstractText: await getPaperContent(p)
        })));
        const result = await generateResearchGaps(processedPapers, options);
        setReviewResult(result);
      } else if (mode === 'red_team') {
        const paper = selectedPaper;
        if (paper) {
          const content = await getPaperContent(paper);
          const result = await generateRedTeamCritique({ ...paper, abstractText: content }, options);
          setReviewResult(result);
        }
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
    const title = isSinglePaperMode 
      ? `${mode === 'red_team' ? 'Red-Team Audit' : 'Peer Review'} - ${selectedPaper?.title || 'Paper'}` 
      : (mode === 'gaps' ? 'Research Gap Analysis' : 'Systematic Literature Review');
    exportReviewToPdf(reviewResult, title);
  };

  const handleExportLatex = () => {
    if (!reviewResult) return;
    const selectedPapers = resources.filter(r => selectedIds.includes(r.id));
    const title = isSinglePaperMode
      ? `${mode === 'red_team' ? 'Methodology Audit' : 'Peer Review'}: ${selectedPaper?.title || 'Paper'}`
      : (mode === 'gaps' ? 'Research Gap & Boundary Analysis' : 'Comparative Literature Synthesis');

    const latexDoc = generateLatexSynthesisDocument({
      title,
      reviewText: reviewResult,
      papers: selectedPapers
    });

    const blob = new Blob([latexDoc], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Literature_Review_${Date.now()}.tex`;
    a.click();
    toast({ message: "Downloaded LaTeX (.tex) document for Overleaf!", tone: 'success' });
  };

  const awaitingFirstToken = loading && !reviewResult.trim();

  const selectedPapersList = resources.filter(r => selectedIds.includes(r.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>
          Literature Review &amp; Synthesis Engine
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Synthesize cross-paper reviews, discover research gaps, stress-test methodology, or conduct peer reviews.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className="ai-toolbar" role="group" aria-label="Review mode" style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-card)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          {[
            { id: 'synthesis', label: 'Comparative Synthesis', icon: Layers },
            { id: 'gaps', label: 'Research Gap Finder', icon: Compass },
            { id: 'red_team', label: 'Methodology Red-Team', icon: ShieldAlert },
            { id: 'peer_review', label: 'Formal Peer Review', icon: FileText }
          ].map(m => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMode(m.id); setSelectedIds([]); setReviewResult(''); setIsExpanded(false); }}
                aria-pressed={isActive}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Focus Mode Toggle */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {isExpanded ? (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Minimize2 size={15} /> <span>Show Papers</span>
            </button>
          ) : reviewResult ? (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Maximize2 size={15} /> <span>Expand View</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="synthesis-grid" style={{ display: 'grid', gridTemplateColumns: isExpanded ? '1fr' : '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Paper Selection */}
        {!isExpanded && (
          <div className="glass-card ai-review-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  {isSinglePaperMode ? `Select 1 Paper to Audit (${selectedIds.length} Selected)` : `Select Papers to Analyze (${selectedIds.length} Selected)`}
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isSinglePaperMode ? 'Select a single paper for deep methodological audit' : 'Choose 2 or more papers to detect boundaries & gaps'}
                </div>
              </div>

              {!isSinglePaperMode && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedIds.length === resources.length) setSelectedIds([]);
                    else setSelectedIds(resources.slice(0, 6).map(r => r.id));
                  }}
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  {selectedIds.length === resources.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {/* Papers List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
              {resources.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No papers in your library yet. Add papers from Academic Search or Batch Import.
                </div>
              ) : (
                resources.map(r => {
                  const isSelected = selectedIds.includes(r.id);
                  return (
                    <div
                      key={r.id}
                      onClick={() => toggleSelect(r.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                        backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-main)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isSelected ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} color="var(--text-muted)" />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {(r.authors || 'Author').split(',')[0]} • {r.publicationYear}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Launch Button */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate || loading}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              >
                {loading ? <StopCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>
                  {loading ? 'Synthesizing...' : (
                    mode === 'synthesis' ? `Synthesize Review (${selectedIds.length} Papers)` :
                    mode === 'gaps' ? `Discover Research Gaps (${selectedIds.length} Papers)` :
                    mode === 'red_team' ? 'Run Red-Team Stress-Test' :
                    'Generate Peer Review Report'
                  )}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Right Column: Output / Reader */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '440px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              {mode === 'synthesis' ? 'Comparative Synthesis' :
               mode === 'gaps' ? 'Research Gap & Boundary Analysis' :
               mode === 'red_team' ? 'Red-Team Audit Scorecard' :
               'Peer Review Report'}
            </h3>

            {/* Export and Audio Controls */}
            {reviewResult && !loading && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowAudioBrief(true)}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                  title="Listen to 2-voice conversational audio overview"
                >
                  <Volume2 size={14} />
                  <span>Audio Brief</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(reviewResult);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportLatex}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  title="Download .tex document for Overleaf"
                >
                  <Code2 size={14} />
                  <span>.TEX</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  <Download size={14} />
                  <span>PDF</span>
                </button>
              </div>
            )}
          </div>

          {awaitingFirstToken ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: '3px solid var(--border-color)',
                borderTopColor: 'var(--primary)',
                animation: 'spin 0.9s linear infinite'
              }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                Gemini AI is analyzing literature methodologies &amp; evidence...
              </div>
            </div>
          ) : reviewResult ? (
            <div style={{
              flex: 1,
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-main)',
              fontSize: '0.9rem',
              overflowY: 'auto',
              maxHeight: isExpanded ? 'calc(100vh - 220px)' : '480px'
            }}>
              <MarkdownMessage>{reviewResult}</MarkdownMessage>
            </div>
          ) : (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Select papers on the left and click the generate button to begin synthesis.
            </div>
          )}
        </div>
      </div>

      {/* Audio Brief Modal Player */}
      {showAudioBrief && (
        <AudioBriefPlayer
          item={selectedPapersList.length > 0 ? selectedPapersList : selectedPaper}
          isOpen={showAudioBrief}
          onClose={() => setShowAudioBrief(false)}
        />
      )}
    </div>
  );
}
