import React from 'react';
import { Star, BookOpen, Quote, Sparkles, Download, CheckCircle, ExternalLink, Trash2, FileCode } from 'lucide-react';

export default function ResourceCard({ 
  resource, 
  onOpenReader, 
  onToggleFavorite, 
  onShowCitation, 
  onOpenAiSummarizer,
  onDeleteResource
}) {
  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
      <div>
        {/* Header Badges */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge">
              {resource.resourceType || 'Research Paper'}
            </span>
            {resource.openAccess && (
              <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                Open Access
              </span>
            )}
            {resource.pdfFileName && (
              <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FileCode size={12} /> PDF Attached
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button 
              onClick={() => onToggleFavorite(resource.id)}
              style={{ color: resource.isFavorite ? 'var(--accent-gold)' : 'var(--text-muted)', padding: '4px' }}
              title={resource.isFavorite ? "Unstar paper" : "Star paper"}
            >
              <Star size={18} fill={resource.isFavorite ? 'var(--accent-gold)' : 'none'} />
            </button>
            {onDeleteResource && (
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${resource.title}" from your library?`)) {
                    onDeleteResource(resource.id);
                  }
                }}
                style={{ color: 'var(--text-muted)', padding: '4px' }}
                title="Delete paper"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 
          onClick={() => onOpenReader(resource)}
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.1rem',
            fontWeight: 700,
            lineHeight: 1.3,
            color: 'var(--text-main)',
            cursor: 'pointer',
            marginBottom: '6px'
          }}
        >
          {resource.title}
        </h3>

        {/* Authors & Year */}
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          <strong>{resource.authors}</strong> • {resource.publicationYear}
        </div>

        {resource.journal && (
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '10px' }}>
            {resource.journal}
          </div>
        )}

        {/* Abstract snippet */}
        {resource.abstractText && (
          <p style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {resource.abstractText}
          </p>
        )}
      </div>

      {/* Footer & Actions */}
      <div>
        {/* Progress Bar if reading in progress */}
        {resource.readingProgressPercent > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>Reading Progress</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{resource.readingProgressPercent}%</span>
            </div>
            <div style={{ height: '5px', borderRadius: '3px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
              <div style={{ width: `${resource.readingProgressPercent}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            {resource.category}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* AI Summary */}
            <button 
              onClick={() => onOpenAiSummarizer(resource)}
              title="Gemini AI Summary"
              style={{ padding: '6px', borderRadius: '8px', color: 'var(--primary)', backgroundColor: 'var(--primary-light)' }}
            >
              <Sparkles size={16} />
            </button>

            {/* Citation Format */}
            <button 
              onClick={() => onShowCitation(resource)}
              title="Generate Citation"
              style={{ padding: '6px', borderRadius: '8px', color: 'var(--text-muted)' }}
            >
              <Quote size={16} />
            </button>

            {/* Read Button */}
            <button 
              onClick={() => onOpenReader(resource)}
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <BookOpen size={14} />
              <span>Read</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
