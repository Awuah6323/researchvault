import React from 'react';
import { X, Home, Search, Library, FolderKanban, MessageSquare, FileText, Sparkles, User, PlusCircle, BookOpen, Download } from 'lucide-react';

export default function MobileDrawer({ isOpen, onClose, activeTab, onNavigate, onOpenAddModal, onOpenInstallPwa, isStandalone }) {
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
      <div className="mobile-drawer-panel">
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
              <img src="/logo_icon.png" alt="ResearchVault Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-sidebar-active)' }}>
              Research<span className="text-gradient-emerald">Vault</span>
            </div>
          </div>

          <button
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
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
          <button
            onClick={() => {
              onOpenAddModal();
              onClose();
            }}
            className="btn-primary"
            style={{
              width: '100%',
              boxShadow: '0 4px 14px rgba(0, 255, 136, 0.25)',
              justifyContent: 'center'
            }}
          >
            <PlusCircle size={18} />
            <span>Add Paper</span>
          </button>

          {!isStandalone && (
            <button
              onClick={() => {
                onClose();
                onOpenInstallPwa();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'var(--gradient-glow)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                transition: 'all 0.2s ease',
                letterSpacing: '0.2px'
              }}
            >
              <Download size={18} style={{ strokeWidth: 2.5 }} />
              <span>Install App on Phone / Tablet</span>
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-sidebar)', marginBottom: '10px', paddingLeft: '4px' }}>
          Navigation
        </div>

        {/* Nav Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
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
                <Icon size={19} style={{ color: isActive ? '#ffffff' : 'var(--text-sidebar)' }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

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

