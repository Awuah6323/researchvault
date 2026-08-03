import React from 'react';
import { Search, BookOpen, Moon, Sun, Sparkles, User, Palette } from 'lucide-react';

export default function Navbar({ 
  searchQuery, 
  setSearchQuery, 
  currentTheme, 
  setTheme, 
  userProfile, 
  onNavigate,
  onOpenAuthModal,
  onLogout
}) {
  const themes = [
    { id: 'cyber-emerald', label: '⚡ Cyber Emerald' },
    { id: 'scholarly-light', label: 'Scholarly Light' },
    { id: 'warm-sepia', label: 'Warm Sepia' },
    { id: 'midnight-oled', label: 'Midnight OLED' }
  ];

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      backgroundColor: 'var(--header-bg)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-color)',
      padding: '12px 24px'
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px'
      }}>
        {/* Brand Logo */}
        <div 
          onClick={() => onNavigate('home')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #00ff88 0%, #10b981 50%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#03140a',
            boxShadow: '0 0 20px rgba(0, 255, 136, 0.4)'
          }}>
            <BookOpen size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.5px', color: 'var(--text-main)' }}>
              Research<span className="text-gradient-emerald">Vault</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>
              ACADEMIC LITERATURE ENGINE
            </div>
          </div>
        </div>

        {/* Global Search Bar */}
        <div style={{ flex: 1, maxWidth: '560px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onNavigate('search');
            }}
            placeholder="Search papers, DOI (10.1038/...), authors, or concepts..."
            style={{
              width: '100%',
              padding: '10px 16px 10px 42px',
              borderRadius: '24px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
            }}
          />
        </div>

        {/* Action Controls: Theme Switcher & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Theme Dropdown */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Palette size={18} style={{ color: 'var(--primary)' }} />
            <select
              value={currentTheme}
              onChange={(e) => setTheme(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {themes.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* User Account / Auth Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div 
              onClick={() => onNavigate('profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8rem'
              }}>
                {userProfile?.name ? userProfile.name.split(' ').map(n => n[0]).join('') : 'AR'}
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {userProfile?.name || 'Alex Rivera'}
              </div>
            </div>

            <button
              onClick={onOpenAuthModal}
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Sign In / Switch
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

