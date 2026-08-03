import React, { useState, useEffect } from 'react';
import { X, Sparkles, Send, Copy, Check, Loader2, BookmarkPlus } from 'lucide-react';
import { generatePaperSummary, askPaperQuestion } from '../services/geminiService';

export default function AiSummarizerModal({ resource, onClose, onSaveNote }) {
  const [summaryType, setSummaryType] = useState('Executive Summary');
  const [loading, setLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState('');
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [copied, setCopied] = useState(false);

  const summaryTypes = ['Executive Summary', 'Key Takeaways', 'Methodology & Proofs', 'Limitations & Critique'];

  const handleGenerateSummary = async (type) => {
    setLoading(true);
    setError('');
    setSummaryResult('');
    try {
      const res = await generatePaperSummary(resource.title, resource.authors, resource.abstractText, type);
      setSummaryResult(res);
    } catch (err) {
      setError(err.message || 'Failed to generate AI summary.');
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

    try {
      const answer = await askPaperQuestion(resource.title, resource.abstractText, q);
      setChatHistory(prev => [...prev, { q, a: answer }]);
    } catch (err) {
      setError('Failed to answer AI question.');
    } finally {
      setLoading(false);
    }
  };

  if (!resource) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Gemini AI Paper Assistant</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Powered by Gemini 2.0 Flash</div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        {/* Content Scrollable Container */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {/* Paper Info */}
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-main)', marginBottom: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{resource.title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{resource.authors} • {resource.publicationYear}</div>
          </div>

          {/* Mode Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {summaryTypes.map(type => (
              <button
                key={type}
                onClick={() => {
                  setSummaryType(type);
                  handleGenerateSummary(type);
                }}
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
          {loading && (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--primary)' }}>
              <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 600 }}>Analyzing paper with Gemini AI...</div>
            </div>
          )}

          {error && (
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.85rem', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {summaryResult && !loading && (
            <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>Generated {summaryType}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(summaryResult);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{ color: 'var(--primary)', padding: '4px' }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  <button 
                    onClick={() => onSaveNote(resource.id, `AI ${summaryType}:\n${summaryResult}`, 1)}
                    title="Save to Research Notes"
                    style={{ color: 'var(--primary)', padding: '4px' }}
                  >
                    <BookmarkPlus size={16} />
                  </button>
                </div>
              </div>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {summaryResult}
              </div>
            </div>
          )}

          {/* Q&A Chat History */}
          {chatHistory.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '10px' }}>Q&A Conversation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {chatHistory.map((item, idx) => (
                  <div key={idx} style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--bg-main)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem', marginBottom: '4px' }}>Q: {item.q}</div>
                    <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>{item.a}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Question Input Form */}
        <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
          <input
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
          <button type="submit" className="btn-primary" disabled={loading || !question.trim()}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
