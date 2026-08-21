import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Copy, Check, Loader2, BookmarkPlus, FileSearch } from 'lucide-react';
import { generatePaperSummary, askPaperQuestion } from '../services/geminiService';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';
import Modal from './Modal';
import MarkdownMessage from './MarkdownMessage';
import { useAnnounce, useToast } from './FeedbackProvider';

// Sentinel value set by AddResourceModal when no real text could be extracted
const PLACEHOLDER_TEXT = 'Imported paper document in ResearchVault digital library.';

/**
 * Converts a base64 data-URL PDF string back to a File object so we can
 * re-run pdfExtractor on it if the stored abstractText is just a placeholder.
 */
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

export default function AiSummarizerModal({ resource, onClose, onSaveNote }) {
  const [summaryType, setSummaryType] = useState('Executive Summary');
  const [loading, setLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState('');
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const [extractingText, setExtractingText] = useState(false);
  // Cache the resolved content so we only extract once per modal open
  const resolvedContentRef = useRef(null);
  const announce = useAnnounce();
  const notify = useToast();

  const summaryTypes = ['Executive Summary', 'Key Takeaways', 'Methodology & Proofs', 'Limitations & Critique'];

  /**
   * Returns the best available text for this resource.
   * If the stored abstractText is the placeholder and a pdfFileData blob is
   * present, we re-extract the real text from the PDF.
   */
  const getResolvedContent = async () => {
    if (resolvedContentRef.current !== null) return resolvedContentRef.current;

    const stored = resource.abstractText || '';
    const isPlaceholder =
      !stored.trim() ||
      stored.trim() === PLACEHOLDER_TEXT ||
      stored.trim().toLowerCase() === 'imported paper document in researchvault digital library.';

    if (isPlaceholder && resource.pdfFileData) {
      setExtractingText(true);
      const extracted = await extractTextFromDataUrl(
        resource.pdfFileData,
        resource.pdfFileName || `${resource.title}.pdf`
      );
      setExtractingText(false);
      const content = extracted && extracted.trim().length > 40
        ? extracted.trim()
        : stored; // fall back to whatever was stored (even the placeholder)
      resolvedContentRef.current = content;
      return content;
    }

    resolvedContentRef.current = stored;
    return stored;
  };

  const handleGenerateSummary = async (type) => {
    setLoading(true);
    setError('');
    setSummaryResult('');
    announce(`Generating ${type} with Gemini AI. This may take a moment.`);
    try {
      const content = await getResolvedContent();
      const res = await generatePaperSummary(resource.title, resource.authors, content, type);
      setSummaryResult(res);
      announce(`${type} ready.`);
    } catch (err) {
      setError(err.message || 'Failed to generate AI summary.');
      announce(err.message || 'Failed to generate AI summary.', { assertive: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resource) {
      handleGenerateSummary(summaryType);
    }
  }, [resource]);

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim() || loading) return;
    const q = question.trim();
    setQuestion('');
    setLoading(true);
    announce('Sending your question to Gemini AI.');

    try {
      const content = await getResolvedContent();
      const answer = await askPaperQuestion(resource.title, content, q);
      setChatHistory(prev => [...prev, { q, a: answer }]);
      announce('Answer received.');
    } catch (err) {
      setError('Failed to answer AI question.');
      announce('Failed to answer AI question.', { assertive: true });
    } finally {
      setLoading(false);
    }
  };

  if (!resource) return null;

  return (
    <Modal
      onClose={onClose}
      labelledBy="ai-summarizer-title"
      zIndex={50}
      panelStyle={{ width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div aria-hidden="true" style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h2 id="ai-summarizer-title" style={{ fontSize: '1.1rem', fontWeight: 800 }}>Gemini AI Paper Assistant</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Powered by Gemini 2.0 Flash</div>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close AI paper assistant" style={{ color: 'var(--text-muted)' }}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Content Scrollable Container */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {/* Paper Info */}
        <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-main)', marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{resource.title}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{resource.authors} • {resource.publicationYear}</div>
        </div>

        {/* Mode Tabs */}
        <div role="group" aria-label="Summary type" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {summaryTypes.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setSummaryType(type);
                handleGenerateSummary(type);
              }}
              aria-pressed={summaryType === type}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                backgroundColor: summaryType === type ? 'var(--primary)' : 'var(--bg-main)',
                color: summaryType === type ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer'
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* AI Result Box */}
        {extractingText && (
          <div role="status" style={{ padding: '24px', textAlign: 'center', color: 'var(--primary)' }}>
            <FileSearch size={28} aria-hidden="true" style={{ margin: '0 auto 10px', display: 'block' }} />
            <div style={{ fontWeight: 600 }}>Reading PDF content for AI analysis...</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Extracting text from your uploaded document</div>
          </div>
        )}
        {loading && !extractingText && (
          <div role="status" style={{ padding: '30px', textAlign: 'center', color: 'var(--primary)' }}>
            <Loader2 size={28} aria-hidden="true" className="animate-spin" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 600 }}>Analyzing paper with Gemini AI...</div>
          </div>
        )}

        {error && (
          <div role="alert" style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.85rem', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {summaryResult && !loading && (
          <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>Generated {summaryType}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(summaryResult);
                    setCopied(true);
                    announce('Summary copied to clipboard.');
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  aria-label={copied ? 'Summary copied to clipboard' : 'Copy summary to clipboard'}
                  style={{ color: 'var(--primary)', padding: '4px' }}
                >
                  {copied
                    ? <Check size={16} aria-hidden="true" />
                    : <Copy size={16} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSaveNote(resource.id, `AI ${summaryType}:\n${summaryResult}`, 1);
                    notify({ message: `Saved ${summaryType} to your research notes.`, tone: 'success' });
                  }}
                  aria-label="Save summary to research notes"
                  title="Save to Research Notes"
                  style={{ color: 'var(--primary)', padding: '4px' }}
                >
                  <BookmarkPlus size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              <MarkdownMessage>{summaryResult}</MarkdownMessage>
            </div>
          </div>
        )}

        {/* Q&A Chat History */}
        {chatHistory.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '10px' }}>Q&amp;A Conversation</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {chatHistory.map((item, idx) => (
                <div key={idx} style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--bg-main)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem', marginBottom: '4px' }}>Q: {item.q}</div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <MarkdownMessage compact>{item.a}</MarkdownMessage>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Question Input Form */}
      <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
        <label htmlFor="ai-paper-question" className="sr-only">
          Ask a question about this paper
        </label>
        <input
          id="ai-paper-question"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask Gemini AI any question about this paper..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-main)',
            fontSize: '0.85rem'
          }}
        />
        <button type="submit" className="btn-primary" disabled={loading || !question.trim()} aria-label="Send question to Gemini AI">
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </Modal>
  );
}
