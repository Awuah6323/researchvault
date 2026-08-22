import React from 'react';
import { Star, BookOpen, Quote, Sparkles, Download, Trash2, FileCode } from 'lucide-react';
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
    <article className="glass-card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
      <div>
        {/* Header badges.
            All three used to be filled .badge chips of identical weight, so a
            paper's type, its access status and its attachment state shouted
            equally loudly and collectively out-shouted the title. The document
            type stays filled because it classifies the record; the other two
            are supplementary facts and are outlined. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span className="badge">
              {resource.resourceType || 'Research Paper'}
            </span>
            {resource.openAccess && (
              <span className="badge badge-quiet">
                Open access
              </span>
            )}
            {resource.pdfFileName && (
              <span className="badge badge-quiet">
                <FileCode size={11} aria-hidden="true" /> PDF
              </span>
            )}
          </div>

          {/* Starring is the one place --accent-gold means anything, so it is
              the only colour on this control. */}
          <button
            type="button"
            onClick={() => onToggleFavorite(resource.id)}
            className="icon-button"
            style={{ color: resource.isFavorite ? 'var(--accent-gold)' : 'var(--text-muted)', flexShrink: 0 }}
            title={resource.isFavorite ? 'Unstar paper' : 'Star paper'}
            aria-label={resource.isFavorite ? `Remove "${resource.title}" from favourites` : `Add "${resource.title}" to favourites`}
            aria-pressed={!!resource.isFavorite}
          >
            <Star size={16} aria-hidden="true" fill={resource.isFavorite ? 'var(--accent-gold)' : 'none'} />
          </button>
        </div>

        {/* Title — a real button so it is focusable and works with Enter/Space.
            It used to be an <h3> with an onClick, unreachable by keyboard.
            .wrap-title keeps long titles breaking between words rather than
            mid-term, which the blanket mobile `word-break` rule allowed. */}
        <h3 style={{ marginBottom: 'var(--space-2)' }}>
          <button
            type="button"
            className="text-button wrap-title"
            onClick={() => onOpenReader(resource)}
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.0625rem',
              fontWeight: 700,
              lineHeight: 1.3,
              letterSpacing: '-0.006em',
              color: 'var(--text-main)'
            }}
          >
            {resource.title}
          </button>
        </h3>

        {/* Authors, year and venue.
            The journal name was painted --primary, which is the action colour —
            it read as a link that did nothing. All three are metadata now, with
            authors carrying slightly more weight than the venue. */}
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--leading-snug)', marginBottom: 'var(--space-3)' }}>
          <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{resource.authors}</span>
          {resource.publicationYear ? ` · ${resource.publicationYear}` : ''}
          {resource.journal ? (
            <span style={{ display: 'block', fontStyle: 'italic', marginTop: '2px' }}>{resource.journal}</span>
          ) : null}
        </div>

        {/* Abstract snippet */}
        {resource.abstractText && (
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            lineHeight: 'var(--leading-normal)',
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
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '5px' }}>
              <span>Reading progress</span>
              <span style={{ fontWeight: 600, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{resource.readingProgressPercent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={resource.readingProgressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Reading progress for "${resource.title}"`}
              style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}
            >
              <div style={{ width: `${resource.readingProgressPercent}%`, height: '100%', backgroundColor: 'var(--primary)' }} />
            </div>
          </div>
        )}

        <div className="card-footer-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {resource.category}
          </span>

          {/* Action row.
              Previously five buttons in three unrelated tint treatments, with
              delete rendered as a filled red block — making the destructive
              action the most saturated thing on the card. All four secondary
              actions are now the same quiet icon button; delete reveals its
              danger colour on hover and focus only. Read stays the one filled
              button, because opening the paper is what this card is for. */}
          <div className="card-action-group" style={{ display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'nowrap' }}>
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
                className="icon-button icon-button-danger"
                title="Delete paper from library"
                aria-label={`Delete "${resource.title}" from library`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            )}

            {/* AI Summary */}
            <button
              type="button"
              onClick={() => onOpenAiSummarizer(resource)}
              className="icon-button"
              title="AI summary"
              aria-label={`Generate AI summary of "${resource.title}"`}
            >
              <Sparkles size={15} aria-hidden="true" />
            </button>

            {/* Download PDF Button */}
            {(resource.pdfFileData || resource.downloadUrl || resource.sourceUrl) && (
              <a
                href={resource.pdfFileData || resource.downloadUrl || resource.sourceUrl}
                download={resource.pdfFileData ? (resource.pdfFileName || `${resource.title}.pdf`) : undefined}
                target={resource.pdfFileData ? undefined : "_blank"}
                rel={resource.pdfFileData ? undefined : "noopener noreferrer"}
                className="icon-button"
                title="Download PDF"
                aria-label={
                  resource.pdfFileData
                    ? `Download PDF of "${resource.title}"`
                    : `Open PDF of "${resource.title}" in a new tab`
                }
                style={{ textDecoration: 'none' }}
              >
                <Download size={15} aria-hidden="true" />
              </a>
            )}

            {/* Citation Format */}
            <button
              type="button"
              onClick={() => onShowCitation(resource)}
              className="icon-button"
              title="Generate citation"
              aria-label={`Generate citation for "${resource.title}"`}
            >
              <Quote size={15} aria-hidden="true" />
            </button>

            {/* Read Button */}
            <button
              type="button"
              onClick={() => onOpenReader(resource)}
              className="btn-primary card-read-btn"
              aria-label={`Read "${resource.title}"`}
              style={{ padding: '7px 14px', minHeight: '34px', marginLeft: 'var(--space-2)' }}
            >
              <BookOpen size={14} aria-hidden="true" />
              <span>Read</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
