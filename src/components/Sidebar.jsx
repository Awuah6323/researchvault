import React from 'react';
import { Home, Search, Library, FolderKanban, Sparkles, User, PlusCircle, FileText, MessageSquare } from 'lucide-react';

export default function Sidebar({ activeTab, onNavigate, onOpenAddModal }) {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={onOpenAddModal}
          className="btn-primary"
          style={{
            width: '100%',
            marginBottom: '16px',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
          }}
        >
          <PlusCircle size={18} />
          <span>Add Resource</span>
        </button>

        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-sidebar)', padding: '0 12px 6px' }}>
          Navigation
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--text-sidebar-active)' : 'var(--text-sidebar)',
                backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div style={{
        padding: '12px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        fontSize: '0.75rem',
        color: 'var(--text-sidebar)',
        lineHeight: 1.4
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text-sidebar-active)' }}>ResearchVault v2.0</div>
        <div>Offline Persistence Active</div>
        <div>Gemini 2.0 Flash AI Enabled</div>
      </div>
    </aside>
  );
}
