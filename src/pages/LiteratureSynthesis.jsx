import React, { useState } from 'react';
import { Sparkles, CheckSquare, Square, Loader2, Copy, Check } from 'lucide-react';
import { synthesizeLiteratureReview } from '../services/geminiService';

export default function LiteratureSynthesis({ resources }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState('');
  const [copied, setCopied] = useState(false);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSynthesize = async () => {
    if (selectedIds.length === 0 || loading) return;
    const selectedPapers = resources.filter(r => selectedIds.includes(r.id));
    setLoading(true);
    setReviewResult('');

    try {
      const result = await synthesizeLiteratureReview(selectedPapers);
      setReviewResult(result);
    } catch (err) {
      setReviewResult("Failed to generate literature review. Please verify Gemini API connectivity.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 800 }}>AI Literature Review Synthesizer</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Select multiple research papers from your library and let Gemini AI draft a systematic literature review.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Select Papers */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Select Papers ({selectedIds.length} Selected)</h3>
            <button
              onClick={handleSynthesize}
              className="btn-primary"
              disabled={selectedIds.length === 0 || loading}
              style={{ opacity: selectedIds.length === 0 ? 0.5 : 1 }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>Synthesize Review</span>
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
                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
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

        {/* Right Column: Output Draft */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Generated Review Draft</h3>
            {reviewResult && (
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
                <span>{copied ? 'Copied!' : 'Copy Review'}</span>
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--primary)' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 700 }}>Gemini AI is synthesizing methodologies & research gaps...</div>
            </div>
          ) : reviewResult ? (
            <div style={{
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
              Select 2 or more papers on the left and click "Synthesize Review" to generate a systematic review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
