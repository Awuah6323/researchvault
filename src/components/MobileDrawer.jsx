import React, { useEffect, useRef } from 'react';
import { X, Home, Search, Library, FolderKanban, MessageSquare, FileText, Sparkles, User, PlusCircle, BookOpen, Download, Compass } from 'lucide-react';

export default function MobileDrawer({ isOpen, onClose, activeTab, onNavigate, onOpenAddModal, onOpenInstallPwa, onOpenUserGuide, isStandalone }) {
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  // The drawer covers the whole screen and its backdrop swallows pointer
  // events, so without Escape a keyboard user had no way out of it at all —
  // and the bottom nav underneath became unclickable.
  useEffect(() => {
    if (!isOpen) return undefined;

    restoreFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector('button, a[href]');
      try {
        (first || panelRef.current)?.focus({ preventScroll: true });
      } catch (e) { /* unmounted between frames */ }
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex^="-"])'
        ) || []
      ).filter((el) => el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const previous = restoreFocusRef.current;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        try {
          previous.focus({ preventScroll: true });
        } catch (e) { /* opener already gone */ }
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'search', label: 'Academic Search', icon: Search },
    { id: 'library', label: 'My Library', icon: Library },
    { id: 'categories', label: 'Categories & Folders', icon: FolderKanban },
    { id: 'aichat', label: 'AI Chat Assistant', icon: MessageSquare },
    { id: 'notes', label: 'Research Notes', icon: FileText },
    { id: 'synthesis', label: 'AI Literature Review', icon: Sparkles },
    { id: 'profile', label: 'Profile & Settings', icon: User }
  ];

  return (
    <div className="mobile-drawer-wrapper">
      {/* Dark backdrop overlay */}
      <div className="mobile-drawer-backdrop" onClick={onClose} />

      {/* Sliding Sidebar Panel */}
      <div
        className="mobile-drawer-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
        tabIndex={-1}
      >
        {/* Drawer Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--card-shadow)'
            }}>
              <img src="/logo_icon.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-sidebar-active)' }}>
              Research<span style={{ color: 'var(--primary)' }}>Vault</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-sidebar-active)',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => {
              onOpenAddModal();
              onClose();
            }}
            className="btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center'
            }}
          >
            <PlusCircle size={16} aria-hidden="true" />
            <span>Add Paper</span>
          </button>

          {onOpenUserGuide && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenUserGuide();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '9px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-sidebar-active)',
                fontWeight: 500,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <Compass size={16} aria-hidden="true" style={{ color: 'var(--primary)' }} />
              <span>User Guide &amp; Features</span>
            </button>
          )}

          {!isStandalone && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInstallPwa();
              }}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                fontSize: '0.85rem'
              }}
            >
              <Download size={16} aria-hidden="true" />
              <span>Install Application</span>
            </button>
          )}
        </div>

        <h2 id="mobile-drawer-nav-heading" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-sidebar)', marginBottom: '10px', paddingLeft: '4px' }}>
          Navigation
        </h2>

        {/* Nav Items List */}
        <nav aria-labelledby="mobile-drawer-nav-heading" style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-sidebar)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.9rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={19} aria-hidden="true" style={{ color: isActive ? '#ffffff' : 'var(--text-sidebar)' }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer Info */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          borderRadius: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-color)',
          fontSize: '0.75rem',
          color: 'var(--text-sidebar)',
          lineHeight: 1.4
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-sidebar-active)' }}>ResearchVault v2.0</div>
          <div>Mobile Sliding Navigation & PWA</div>
        </div>
      </div>
    </div>
  );
}

