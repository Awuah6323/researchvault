import React, { useState } from 'react';
import { FolderPlus, BookOpen, Plus, X } from 'lucide-react';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 800 }}>Categories & Folders</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Organize literature by domain, field of study, and project topics.</p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={18} />
          <span>New Category</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {displayCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.name)}
            className="glass-card"
            aria-label={`${cat.name} — ${cat.count} papers. ${cat.description || ''}`}
            style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '180px', textAlign: 'left', width: '100%', font: 'inherit', color: 'inherit' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
              <div aria-hidden="true" style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                <BookOpen size={24} />
              </div>
              <span className="badge">{cat.count} {cat.count === 1 ? 'Paper' : 'Papers'}</span>
            </div>

            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{cat.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{cat.description}</p>
            </div>
          </button>
        ))}
      </div>

      {showModal && (
        <Modal
          onClose={() => setShowModal(false)}
          labelledBy="new-category-title"
          zIndex={50}
          panelStyle={{ width: '100%', maxWidth: '480px', padding: '24px' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 id="new-category-title" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Create New Category</h2>
              <button type="button" onClick={() => setShowModal(false)} aria-label="Close create category dialog" style={{ color: 'var(--text-muted)' }}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label htmlFor="new-category-name" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Category Name *</label>
                <input
                  id="new-category-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g., Quantum Computing"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                />
              </div>

              <div>
                <label htmlFor="new-category-description" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Description</label>
                <textarea
                  id="new-category-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this research category..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%' }}>Create Category</button>
            </form>
        </Modal>
      )}
    </div>
  );
}
