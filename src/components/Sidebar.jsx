import React from 'react';
import { Home, Search, Library, FolderKanban, Sparkles, User, PlusCircle, FileText, MessageSquare, Download } from 'lucide-react';

export default function Sidebar({ activeTab, onNavigate, onOpenAddModal, onOpenInstallPwa, isStandalone }) {
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
    <aside style={{
      width: '236px',
      flexShrink: 0,
      backgroundColor: 'var(--bg-sidebar)',
      minHeight: 'calc(100vh - 57px)',
      padding: 'var(--space-5) var(--space-3)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      borderRight: '1px solid var(--border-color)'
    }}>
      <div className="sidebar-nav-list" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button
          type="button"
          onClick={onOpenAddModal}
          className="btn-primary"
          style={{ width: '100%', marginBottom: 'var(--space-5)' }}
        >
          <PlusCircle size={17} aria-hidden="true" />
          <span>Add Paper</span>
        </button>

        <h2 id="sidebar-nav-heading" className="mobile-hide overline" style={{ padding: '0 12px 8px' }}>
          Navigation
        </h2>

        <nav aria-labelledby="sidebar-nav-heading" style={{ display: 'contents' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`sidebar-btn ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer: PWA install prompt.
          The install button used to carry --gradient-glow, which made an
          optional, secondary action the single most saturated element in the
          whole sidebar — louder than the active nav item. It is an outline
          button now. The three-line "v2.0 / Offline PWA Active / Gemini 2.0
          Flash AI Enabled" status block below it was decorative: none of it was
          actionable, and its hardcoded model version had already drifted out of
          step with the API the app actually calls. */}
      {!isStandalone && (
        <button
          type="button"
          onClick={onOpenInstallPwa}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.22)',
            color: 'var(--text-sidebar-active)',
            fontSize: 'var(--text-md)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Download size={16} aria-hidden="true" />
          <span>Install app</span>
        </button>
      )}
    </aside>
  );
}

