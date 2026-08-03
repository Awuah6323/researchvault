import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { STYLES, generateCitation } from '../services/citationGenerator';

export default function CitationModal({ resource, onClose }) {
  const [selectedStyle, setSelectedStyle] = useState('APA');
  const [copied, setCopied] = useState(false);

  if (!resource) return null;

  const citationText = generateCitation(resource, selectedStyle);

  const handleCopy = () => {
    navigator.clipboard.writeText(citationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '580px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Academic Citation Generator</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          <strong>{resource.title}</strong>
        </div>

        {/* Style Selector Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                backgroundColor: selectedStyle === style.id ? 'var(--primary)' : 'var(--bg-main)',
                color: selectedStyle === style.id ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer'
              }}
            >
              {style.name}
            </button>
          ))}
        </div>

        {/* Formatted Citation Output */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.85rem',
          color: 'var(--text-main)',
          whiteSpace: 'pre-wrap',
          marginBottom: '20px'
        }}>
          {citationText}
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="btn-primary"
          style={{ width: '100%' }}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          <span>{copied ? 'Citation Copied!' : 'Copy to Clipboard'}</span>
        </button>
      </div>
    </div>
  );
}
