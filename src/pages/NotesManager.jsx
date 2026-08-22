import React, { useState, useEffect } from 'react';
import { BookOpen, Search, FileText, Trash2, ExternalLink } from 'lucide-react';
import { storage } from '../services/storage';

export default function NotesManager({ onOpenReader, resources }) {
  const [allNotes, setAllNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setAllNotes(storage.getAllNotesAcrossLibrary());
  }, [resources]);

  const filteredNotes = allNotes.filter(n => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.noteText.toLowerCase().includes(q) ||
      (n.paperTitle && n.paperTitle.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Research Notes & Highlights</h1>
          <p className="page-subtitle">Central repository of all notes, observations, and AI summaries across your papers.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <label htmlFor="notes-filter" className="sr-only">Search notes content or paper title</label>
          <input
            id="notes-filter"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes content or paper title..."
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
          />
        </div>
        <span className="badge" role="status" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-text)' }}>
          {filteredNotes.length} Total Notes
        </span>
      </div>

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <FileText size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>No research notes found</div>
          <div style={{ fontSize: '0.85rem' }}>Notes added during document reading or saved from AI summaries will appear here.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredNotes.map(n => {
            const paper = resources.find(r => r.id === n.resourceId);
            return (
              <div key={n.id} className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                      Page {n.pageNumber} • {n.createdAt}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: '12px', color: 'var(--text-main)' }}>
                    {n.noteText}
                  </p>
                </div>

                <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                    {n.paperTitle}
                  </div>

                  {paper && (
                    <button
                      onClick={() => onOpenReader(paper)}
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <BookOpen size={12} /> Read Paper
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
