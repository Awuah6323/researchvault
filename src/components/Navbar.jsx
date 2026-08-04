import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Moon, Sun, Sparkles, User, Palette, Menu, Cloud, CheckCircle2, RefreshCw } from 'lucide-react';
import { storage } from '../services/storage';

export default function Navbar({ 
  searchQuery, 
  setSearchQuery, 
  currentTheme, 
  setTheme, 
  userProfile, 
  onNavigate,
  onOpenAuthModal,
  onLogout,
  onOpenMobileMenu
}) {
  const [syncState, setSyncState] = useState(storage.getSyncState());
  const [lastSyncTime, setLastSyncTime] = useState(storage.getLastSyncTime());

  useEffect(() => {
    const unsubscribe = storage.subscribeSyncState((state, timeStr) => {
      setSyncState(state);
      setLastSyncTime(timeStr);
    });
    return unsubscribe;
  }, []);

  const themes = [
    { id: 'warm-sepia', label: '☕ Warm Sepia' },
    { id: 'cyber-emerald', label: '⚡ Cyber Emerald' },
    { id: 'scholarly-light', label: 'Scholarly Light' },
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
      <div className="nav-container" style={{
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'nowrap'
      }}>
        {/* Brand Logo & Mobile Menu Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {onOpenMobileMenu && (
            <button
              onClick={onOpenMobileMenu}
              className="mobile-nav-toggle-btn"
              aria-label="Open mobile menu"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                color: 'var(--primary)',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <Menu size={22} />
            </button>
          )}
          <div 
            onClick={() => onNavigate('home')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #00ff88 0%, #10b981 50%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#03140a',
              boxShadow: '0 0 20px rgba(0, 255, 136, 0.4)',
              flexShrink: 0
            }}>
              <BookOpen size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.5px', color: 'var(--text-main)', lineHeight: 1.1 }}>
                Research<span className="text-gradient-emerald">Vault</span>
              </div>
              <div className="mobile-hide" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.8px', marginTop: '2px' }}>
                ACADEMIC LITERATURE ENGINE
              </div>
            </div>
          </div>
        </div>

        {/* Global Search Bar */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (searchQuery.trim()) {
              onNavigate('search');
            }
          }} 
          className="nav-search-bar" 
          style={{ flex: 1, maxWidth: '560px', position: 'relative' }}
        >
          <button
            type="submit"
            aria-label="Execute Academic Search"
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
          >
            <Search size={18} />
          </button>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search papers, DOI, authors (e.g. Hinton, Vaswani)..."
            style={{
              width: '100%',
              padding: '10px 16px 10px 42px',
              borderRadius: '24px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.88rem',
              outline: 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
            }}
          />
        </form>

        {/* Action Controls: Cloud Sync, Theme Switcher & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Cloud Sync Status Badge */}
          <div 
            onClick={() => storage.pullCloudVault()}
            title={`Cross-Device Cloud Vault (${syncState}). Click to sync.`}
            className="mobile-hide"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: syncState === 'syncing' ? 'var(--primary)' : '#10b981',
              cursor: 'pointer'
            }}
          >
            {syncState === 'syncing' ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            <span>{syncState === 'syncing' ? 'Syncing...' : 'Cloud Synced'}</span>
          </div>

          {/* Theme Dropdown */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Palette size={16} style={{ color: 'var(--primary)' }} />
            <select
              value={currentTheme}
              onChange={(e) => setTheme(e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                maxWidth: '120px'
              }}
            >
              {themes.map(t => (
                <option key={t.id} value={t.id}>{t.label.replace('⚡ ', '')}</option>
              ))}
            </select>
          </div>

          {/* User Account / Auth Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div 
              onClick={() => onNavigate('profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '20px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.75rem'
              }}>
                {userProfile?.name ? userProfile.name.split(' ').map(n => n[0]).join('') : 'AR'}
              </div>
              <div className="mobile-hide" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {userProfile?.name || 'Alex Rivera'}
              </div>
            </div>

            <button
              onClick={onOpenAuthModal}
              className="btn-primary"
              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            >
              {userProfile?.isAuthenticated ? 'Switch' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

