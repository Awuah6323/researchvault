import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import Modal from '../components/Modal';

export default function Categories({ categories = [], resources = [], onAddCategory, onSelectCategory }) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddCategory({ name: name.trim(), description: description.trim() || 'Custom Research Folder', icon: 'BookOpen' });
    setName('');
    setDescription('');
    setShowModal(false);
  };

  const categoryMap = new Map();

  (categories || []).forEach(cat => {
    if (cat && cat.name) {
      categoryMap.set(cat.name.trim().toLowerCase(), {
        id: cat.id || cat.name,
        name: cat.name,
        description: cat.description || 'Custom Research Folder',
        icon: cat.icon || 'BookOpen',
        count: 0
      });
    }
  });

  (resources || []).forEach(r => {
    if (r && r.category && r.category.trim()) {
      const key = r.category.trim().toLowerCase();
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          id: key,
          name: r.category.trim(),
          description: 'Research Topic Folder',
          icon: 'BookOpen',
          count: 0
        });
      }
    }
  });

  const displayCategories = Array.from(categoryMap.values()).map(cat => {
    const key = cat.name.trim().toLowerCase();
    const count = (resources || []).filter(r => (r.category || '').trim().toLowerCase() === key).length;
    return { ...cat, count };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Categories &amp; Folders</h1>
          <p className="page-subtitle">Organise literature by domain, field of study and project topic.</p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={16} aria-hidden="true" />
          <span>New category</span>
        </button>
      </div>

      {displayCategories.length === 0 ? (
        <div className="glass-card" style={{ padding: 'var(--space-10) var(--space-5)', textAlign: 'center' }}>
          <div className="section-title" style={{ marginBottom: '6px' }}>No categories yet</div>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>
            Categories are created automatically as you save papers, or add one yourself.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
          {displayCategories.map((cat) => (
            /* Every category rendered the same BookOpen glyph in the same
               tinted square, so the icon distinguished nothing — eight cards,
               eight identical chips. Dropping it lets the category name be the
               thing you actually read, and the fixed 180px height (which forced
               a gap under short descriptions) goes with it. */
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.name)}
              className="glass-card card-interactive"
              aria-label={`${cat.name} — ${cat.count} papers. ${cat.description || ''}`}
              style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'left', width: '100%', font: 'inherit', color: 'inherit' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)', width: '100%' }}>
                <h3 className="section-title wrap-title" style={{ fontFamily: 'var(--font-serif)' }}>{cat.name}</h3>
                <span className="badge badge-quiet" style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {cat.count}
                </span>
              </div>

              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--leading-snug)' }}>{cat.description}</p>
            </button>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          onClose={() => setShowModal(false)}
          labelledBy="new-category-title"
          zIndex={50}
          panelStyle={{ width: '100%', maxWidth: '460px', padding: 'var(--space-6)' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h2 id="new-category-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Create new category</h2>
              <button type="button" onClick={() => setShowModal(false)} className="icon-button" aria-label="Close create category dialog">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label htmlFor="new-category-name" className="overline" style={{ marginBottom: '6px', display: 'block' }}>Category name *</label>
                <input
                  id="new-category-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Quantum Computing"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="new-category-description" className="overline" style={{ marginBottom: '6px', display: 'block' }}>Description</label>
                <textarea
                  id="new-category-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this research category…"
                  style={{ width: '100%' }}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%' }}>Create category</button>
            </form>
        </Modal>
      )}
    </div>
  );
}
