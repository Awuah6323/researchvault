import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Moon, Sun, Sparkles, User, Palette, Menu, Cloud, CheckCircle2, RefreshCw, Download, Compass, HelpCircle } from 'lucide-react';
import { storage } from '../services/storage';

// Human-readable sync states. The badge previously said "Synced" for every
// state except "syncing", so an offline or failed sync looked identical to a
// successful one.
const SYNC_LABELS = {
  synced: 'Synced',
  syncing: 'Syncing...',
  offline: 'Offline',
  error: 'Sync failed',
  'local-only': 'This device only'
};

// Long-form text for the tooltip and screen-reader label, so the state is
// explained rather than just colour-coded.
const SYNC_DETAIL = {
  synced: 'Your library is backed up and available on your other devices.',
  syncing: 'Saving your latest changes.',
  offline: 'Changes are saved on this device and will sync when you reconnect.',
  error: 'Sync stopped working. Your changes are still saved on this device.',
  'local-only': 'Saved on this device only — not backed up or shared with your other devices.'
};

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
              type="button"
              onClick={onOpenMobileMenu}
              className="mobile-nav-toggle-btn"
              aria-label="Open navigation menu"
              aria-expanded={false}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                color: 'var(--primary)',
                padding: '6px 8px',
                cursor: 'pointer',
                /* No `display` here on purpose. The stylesheet hides this
                   button above 768px; an inline display would beat that rule
                   and leave a mobile hamburger on desktop, where it also
                   became the page's first tab stop. */
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            aria-label="ResearchVault — go to dashboard"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
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
              <img src="/logo_icon.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.5px', color: 'var(--text-main)', lineHeight: 1.1 }}>
                Research<span className="text-gradient-emerald">Vault</span>
              </div>
              <div className="mobile-hide" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.8px', marginTop: '2px' }}>
                ACADEMIC LITERATURE ENGINE
              </div>
            </div>
          </button>
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
          role="search"
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
            <Search size={18} aria-hidden="true" />
          </button>
          <label htmlFor="global-search" className="sr-only">
            Search papers, DOI or authors
          </label>
          <input
            id="global-search"
            type="search"
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
              type="button"
              onClick={onOpenUserGuide}
              title="Open App Guide & Navigation Tutorial"
              aria-label="Open app guide and navigation tutorial"
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
              <Compass size={16} aria-hidden="true" />
              <span className="mobile-hide">Guide</span>
            </button>
          )}



          {/* Cloud Sync Status Badge — a real button, and a polite live region
              so sync state changes are announced instead of colour-only. */}
          <button
            type="button"
            onClick={() => storage.pullCloudVault()}
            title={`${SYNC_LABELS[syncState] || syncState} — ${SYNC_DETAIL[syncState] || ''} Click to sync now.`}
            aria-label={`Cloud sync status: ${SYNC_LABELS[syncState] || syncState}. ${SYNC_DETAIL[syncState] || ''} Last synced ${lastSyncTime}. Activate to sync now.`}
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
              color:
                syncState === 'syncing'
                  ? 'var(--primary)'
                  : syncState === 'offline' || syncState === 'error'
                  ? '#ef4444'
                  : syncState === 'local-only'
                  ? 'var(--accent-gold)'
                  : '#10b981',
              cursor: 'pointer'
            }}
          >
            {syncState === 'syncing' ? (
              <RefreshCw size={14} aria-hidden="true" className="animate-spin" />
            ) : syncState === 'offline' || syncState === 'error' || syncState === 'local-only' ? (
              <Cloud size={14} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={14} aria-hidden="true" />
            )}
            <span className="mobile-hide">{SYNC_LABELS[syncState] || 'Synced'}</span>
          </button>

          {/* Theme Dropdown */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Palette size={16} aria-hidden="true" style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <label htmlFor="theme-select" className="sr-only">Colour theme</label>
            <select
              id="theme-select"
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
              type="button"
              onClick={() => onNavigate('profile')}
              title="Open Account Profile & Settings"
              aria-label={`Open account profile and settings for ${userProfile?.name || userProfile?.email || 'your account'}`}
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
              <div aria-hidden="true" style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.75rem',
                flexShrink: 0
              }}>
                {userProfile?.name ? userProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : (userProfile?.email ? userProfile.email[0].toUpperCase() : 'RV')}
              </div>
              <span className="mobile-hide" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {userProfile?.name || userProfile?.email ? (userProfile?.name || userProfile?.email.split('@')[0]) : 'Account'}
              </span>
            </button>

            <button
              type="button"
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

