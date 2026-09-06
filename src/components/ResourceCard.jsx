import React from 'react';
import { Star, BookOpen, Quote, Sparkles, Download, CheckCircle, ExternalLink, Trash2, FileCode } from 'lucide-react';
import { useConfirm } from './FeedbackProvider';

export default function ResourceCard({
  resource,
  onOpenReader,
  onToggleFavorite,
  onShowCitation,
  onOpenAiSummarizer,
  onDeleteResource
}) {
  const confirm = useConfirm();

  return (
    <article className="glass-card paper-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '6px' }}>
      <div>
        {/* Header Badges */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <span className="badge" style={{ fontSize: '0.66rem', padding: '1px 5px' }}>
              {resource.resourceType || 'Research Paper'}
            </span>
            {resource.openAccess && (
              <span className="badge" style={{ fontSize: '0.66rem', padding: '1px 5px' }}>
                Open Access
              </span>
            )}
            {resource.pdfFileName && (
              <span className="badge" style={{ fontSize: '0.66rem', padding: '1px 5px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <FileCode size={11} aria-hidden="true" /> PDF
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onToggleFavorite(resource.id)}
            style={{ color: resource.isFavorite ? 'var(--accent-gold)' : 'var(--text-muted)', padding: '2px' }}
            title={resource.isFavorite ? 'Unstar paper' : 'Star paper'}
            aria-label={resource.isFavorite ? `Remove "${resource.title}" from favourites` : `Add "${resource.title}" to favourites`}
            aria-pressed={!!resource.isFavorite}
          >
            <Star size={15} aria-hidden="true" fill={resource.isFavorite ? 'var(--accent-gold)' : 'none'} />
          </button>
        </div>

        {/* Title — a real button so it is focusable and works with Enter/Space.
            It used to be an <h3> with an onClick, unreachable by keyboard. */}
        <h3 style={{ marginBottom: '2px' }}>
          <button
            type="button"
            className="text-button"
            onClick={() => onOpenReader(resource)}
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '0.88rem',
              fontWeight: 700,
              lineHeight: 1.22,
              color: 'var(--text-main)',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            {resource.title}
          </button>
        </h3>

        {/* Authors & Year */}
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '2px', lineHeight: 1.2 }}>
          <strong>{resource.authors}</strong> • {resource.publicationYear}
        </div>

        {resource.journal && (
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '2px', lineHeight: 1.2 }}>
            {resource.journal}
          </div>
        )}

        {/* Abstract snippet */}
        {resource.abstractText && (
          <p style={{
            fontSize: '0.73rem',
            color: 'var(--text-muted)',
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            margin: 0
          }}>
            {resource.abstractText}
          </p>
        )}
      </div>

      {/* Footer & Actions */}
      <div>
        {/* Progress Bar if reading in progress */}
        {resource.readingProgressPercent > 0 && (
          <div style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
              <span>Reading Progress</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{resource.readingProgressPercent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={resource.readingProgressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Reading progress for "${resource.title}"`}
              style={{ height: '3px', borderRadius: '2px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}
            >
              <div style={{ width: `${resource.readingProgressPercent}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        <div className="card-footer-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '4px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            {resource.category}
          </span>

          <div className="card-action-group" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            {/* Delete Button — icon only */}
            {onDeleteResource && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete this paper?',
                    message: `"${resource.title}" will be removed from your library, along with any notes attached to it. This cannot be undone.`,
                    confirmLabel: 'Delete paper',
                    cancelLabel: 'Keep it',
                    tone: 'danger'
                  });
                  if (ok) onDeleteResource(resource.id);
                }}
                title="Delete paper from library"
                aria-label={`Delete "${resource.title}" from library`}
                style={{
                  padding: '4px 5px',
                  borderRadius: '5px',
                  color: 'var(--danger)',
                  backgroundColor: 'var(--danger-bg)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--danger-border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--danger-bg)';
                }}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            )}

            {/* AI Summary */}
            <button
              type="button"
              onClick={() => onOpenAiSummarizer(resource)}
              title="Gemini AI Summary"
              aria-label={`Generate Gemini AI summary of "${resource.title}"`}
              style={{ padding: '4px 5px', borderRadius: '5px', color: 'var(--primary)', backgroundColor: 'var(--primary-light)' }}
            >
              <Sparkles size={13} aria-hidden="true" />
            </button>

            {/* Download PDF Button */}
            {(resource.pdfFileData || resource.downloadUrl || resource.sourceUrl) && (
              <a
                href={resource.pdfFileData || resource.downloadUrl || resource.sourceUrl}
                download={resource.pdfFileData ? (resource.pdfFileName || `${resource.title}.pdf`) : undefined}
                target={resource.pdfFileData ? undefined : "_blank"}
                rel={resource.pdfFileData ? undefined : "noopener noreferrer"}
                title="Download PDF File"
                aria-label={
                  resource.pdfFileData
                    ? `Download PDF of "${resource.title}"`
                    : `Open PDF of "${resource.title}" in a new tab`
                }
                style={{ padding: '4px 5px', borderRadius: '5px', color: 'var(--success)', backgroundColor: 'var(--success-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
              >
                <Download size={13} aria-hidden="true" />
              </a>
            )}

            {/* Citation Format */}
            <button
              type="button"
              onClick={() => onShowCitation(resource)}
              title="Generate Citation"
              aria-label={`Generate citation for "${resource.title}"`}
              style={{ padding: '4px 5px', borderRadius: '5px', color: 'var(--text-muted)' }}
            >
              <Quote size={13} aria-hidden="true" />
            </button>

            {/* Read Button */}
            <button
              type="button"
              onClick={() => onOpenReader(resource)}
              className="btn-primary card-read-btn"
              aria-label={`Read "${resource.title}"`}
              style={{ padding: '4px 10px', fontSize: '0.74rem', flexShrink: 0 }}
            >
              <BookOpen size={12} aria-hidden="true" />
              <span>Read</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
