import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Moon, Sun, Sparkles, User, Palette, Menu, Cloud, CheckCircle2, RefreshCw, Download, Compass, HelpCircle } from 'lucide-react';
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
  onOpenMobileMenu,
  onOpenInstallPwa,
  onOpenUserGuide,
  isStandalone
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
      padding: '12px 16px',
      width: '100%',
      maxWidth: '100vw',
      boxSizing: 'border-box',
      overflowX: 'hidden'
    }}>
      <div className="nav-container" style={{
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        width: '100%',
        boxSizing: 'border-box'
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
              borderRadius: '11px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--card-shadow)',
              flexShrink: 0,
              backgroundColor: 'var(--bg-card)'
            }}>
              <img src="/logo_icon.png" alt="ResearchVault Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

        {/* Horizontal Sliding Action Controls Bar: User Account, Install App, User Guide, Theme Mode & Cloud Sync */}
        <div className="nav-actions-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
          {/* User Guide Carousel Trigger */}
          {onOpenUserGuide && (
            <button
              onClick={onOpenUserGuide}
              title="Open App Guide & Navigation Tutorial"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--primary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)'
              }}
            >
              <Compass size={16} />
              <span className="mobile-hide">Guide</span>
            </button>
          )}

          {/* PWA Install Button */}
          {!isStandalone && (
            <button
              onClick={onOpenInstallPwa}
              title="Install ResearchVault as Phone, Tablet, or Desktop App"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '18px',
                background: 'var(--gradient-glow)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              <Download size={14} style={{ strokeWidth: 2.5 }} />
              <span>Install</span>
            </button>
          )}

          {/* Cloud Sync Status Badge */}
          <div 
            onClick={() => storage.pullCloudVault()}
            title={`Cross-Device Cloud Vault (${syncState}). Click to sync.`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 8px',
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
            <span className="mobile-hide">{syncState === 'syncing' ? 'Syncing...' : 'Synced'}</span>
          </div>

          {/* Theme Dropdown */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Palette size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <select
              value={currentTheme}
              onChange={(e) => setTheme(e.target.value)}
              title="Switch Theme Mode"
              style={{
                padding: '5px 6px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                maxWidth: '105px'
              }}
            >
              {themes.map(t => (
                <option key={t.id} value={t.id}>{t.label.replace('⚡ ', '').replace('☕ ', '')}</option>
              ))}
            </select>
          </div>

          {/* User Account / Profile Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button 
              onClick={() => onNavigate('profile')}
              title="Open Account Profile & Settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '20px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)'
              }}
            >
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.75rem'
              }}>
                {userProfile?.name ? userProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : (userProfile?.email ? userProfile.email[0].toUpperCase() : 'RV')}
              </div>
              <span className="mobile-hide" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {userProfile?.name || userProfile?.email ? (userProfile?.name || userProfile?.email.split('@')[0]) : 'Account'}
              </span>
            </button>

            <button
              onClick={onOpenAuthModal}
              className="btn-primary"
              style={{ padding: '6px 10px', fontSize: '0.76rem', borderRadius: '12px' }}
            >
              {userProfile?.isAuthenticated ? 'Switch' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

