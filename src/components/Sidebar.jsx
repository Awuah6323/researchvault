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
      width: '240px',
      backgroundColor: 'var(--bg-sidebar)',
      minHeight: 'calc(100vh - 65px)',
      padding: '20px 14px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      borderRight: '1px solid var(--border-color)',
      transition: 'background-color 0.3s ease'
    }}>
      <div className="sidebar-nav-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          type="button"
          onClick={onOpenAddModal}
          className="btn-primary"
          style={{
            width: '100%',
            marginBottom: '8px'
          }}
        >
          <PlusCircle size={18} aria-hidden="true" />
          <span>Add Paper</span>
        </button>

        <h2 id="sidebar-nav-heading" className="mobile-hide" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-sidebar)', padding: '0 12px 6px' }}>
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
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & PWA Install Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {!isStandalone && (
          <button
            type="button"
            onClick={onOpenInstallPwa}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'var(--primary)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'none',
              transition: 'all 0.2s ease',
              letterSpacing: '0.2px'
            }}
          >
            <Download size={17} aria-hidden="true" style={{ strokeWidth: 2.5 }} />
            <span>Install App on Device</span>
          </button>
        )}

        <div style={{
          padding: '12px',
          borderRadius: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          fontSize: '0.75rem',
          color: 'var(--text-sidebar)',
          lineHeight: 1.4
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-sidebar-active)' }}>ResearchVault v2.0</div>
          <div>Offline PWA Active</div>
          <div>Gemini 2.0 Flash AI Enabled</div>
        </div>
      </div>
    </aside>
  );
}

