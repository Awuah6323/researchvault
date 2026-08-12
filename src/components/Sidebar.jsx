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
          onClick={onOpenAddModal}
          className="btn-primary"
          style={{
            width: '100%',
            marginBottom: '8px',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
          }}
        >
          <PlusCircle size={18} />
          <span>Add Paper</span>
        </button>

        <div className="mobile-hide" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-sidebar)', padding: '0 12px 6px' }}>
          Navigation
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`sidebar-btn ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Footer Info & PWA Install Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {!isStandalone && (
          <button
            onClick={onOpenInstallPwa}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px',
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 255, 136, 0.1)',
              border: '1px solid rgba(0, 255, 136, 0.25)',
              color: '#00ff88',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Download size={16} />
            <span>Install Desktop / Mobile App</span>
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

