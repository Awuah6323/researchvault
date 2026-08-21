import React, { useState } from 'react';
import { X, Copy, Check, Download, FileText } from 'lucide-react';
import { STYLES, generateCitation } from '../services/citationGenerator';
import { exportSingleCitationPdf } from '../services/citationPdfExporter';
import Modal from './Modal';
import { useAnnounce } from './FeedbackProvider';

export default function CitationModal({ resource, onClose }) {
  const [selectedStyle, setSelectedStyle] = useState('APA');
  const [copied, setCopied] = useState(false);
  const announce = useAnnounce();

  if (!resource) return null;

  const citationText = generateCitation(resource, selectedStyle);

  const handleCopy = () => {
    navigator.clipboard.writeText(citationText);
    setCopied(true);
    announce(`${selectedStyle} citation copied to clipboard.`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = () => {
    exportSingleCitationPdf(resource, selectedStyle);
    announce(`${selectedStyle} citation exported as PDF.`);
  };

  return (
    <Modal
      onClose={onClose}
      labelledBy="citation-modal-title"
      panelStyle={{ width: '100%', maxWidth: '580px', padding: '24px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 id="citation-modal-title" style={{ fontSize: '1.2rem', fontWeight: 700 }}>Academic Citation Generator</h2>
        <button type="button" onClick={onClose} aria-label="Close citation generator" style={{ color: 'var(--text-muted)' }}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <strong>{resource.title}</strong>
      </div>

      {/* Style Selector Tabs */}
      <div role="group" aria-label="Citation style" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => setSelectedStyle(style.id)}
            aria-pressed={selectedStyle === style.id}
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
      <div
        aria-live="polite"
        aria-label={`${selectedStyle} formatted citation`}
        style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.85rem',
          color: 'var(--text-main)',
          whiteSpace: 'pre-wrap',
          marginBottom: '20px'
        }}
      >
        {citationText}
      </div>

      {/* Action Buttons: Download PDF & Copy */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button
          type="button"
          onClick={handleExportPdf}
          className="btn-primary"
          style={{ width: '100%' }}
          title="Download citation formatted directly as a PDF document"
        >
          <Download size={18} aria-hidden="true" />
          <span>Export as PDF</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="btn-secondary"
          style={{ width: '100%' }}
        >
          {copied
            ? <Check size={18} aria-hidden="true" />
            : <Copy size={18} aria-hidden="true" />}
          <span>{copied ? 'Citation Copied!' : 'Copy Text'}</span>
        </button>
      </div>
    </Modal>
  );
}
