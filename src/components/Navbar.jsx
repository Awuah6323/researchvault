import React, { useState, useEffect } from 'react';
import { Search, Palette, Menu, Cloud, CheckCircle2, RefreshCw, Compass } from 'lucide-react';
import { storage } from '../services/storage';

const SYNC_LABELS = {
  synced: 'Synced',
  syncing: 'Syncing...',
  offline: 'Offline',
  error: 'Sync failed',
  'local-only': 'This device only'
};

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

  /* Emoji were previously baked into these labels and then stripped again with
     two .replace() calls at render time. The labels are just labels now. Theme
     ids are unchanged, so a stored preference still resolves. */
  const themes = [
    { id: 'warm-sepia', label: 'Warm Sepia' },
    { id: 'scholarly-light', label: 'Scholarly Light' },
    { id: 'cyber-emerald', label: 'Cyber Emerald' },
    { id: 'midnight-oled', label: 'Midnight OLED' }
  ];

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      backgroundColor: 'var(--header-bg)',
      borderBottom: '1px solid var(--border-color)',
      padding: '10px 16px',
      width: '100%',
      maxWidth: '100%',
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
              className="mobile-nav-toggle-btn neu-button"
              aria-label="Open navigation menu"
              aria-expanded={false}
              style={{
                color: 'var(--text-main)',
                padding: '8px',
                /* No `display` here on purpose. The stylesheet hides this
                   button above 768px; an inline display would beat that rule
                   and leave a mobile hamburger on desktop, where it also
                   became the page's first tab stop. */
                alignItems: 'center',
                justifyContent: 'center'
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
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)',
              flexShrink: 0,
              backgroundColor: 'var(--bg-card)'
            }}>
              <img src="/logo_icon.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--text-main)', lineHeight: 1.15 }}>
                Research<span className="text-gradient-emerald">Vault</span>
              </div>
              <div className="mobile-hide overline" style={{ fontSize: '0.625rem', marginTop: '1px' }}>
                Academic Literature Engine
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
          style={{ flex: 1, maxWidth: '520px', position: 'relative' }}
        >
          <button
            type="submit"
            aria-label="Search academic sources"
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
            <Search size={17} aria-hidden="true" />
          </button>
          <label htmlFor="global-search" className="sr-only">
            Search papers, DOI or authors
          </label>
          <input
            id="global-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search papers, authors or DOI…"
            style={{
              width: '100%',
              padding: '9px 14px 9px 38px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-md)',
              outline: 'none'
            }}
          />
        </form>

        {/* Horizontal Sliding Action Controls Bar: User Account, User Guide, Theme Mode & Cloud Sync */}
        <div className="nav-actions-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'nowrap' }}>
          {/* User Guide Carousel Trigger */}
          {onOpenUserGuide && (
            <button
              type="button"
              onClick={onOpenUserGuide}
              className="neu-button"
              title="Open app guide and navigation tutorial"
              aria-label="Open app guide and navigation tutorial"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 11px',
                fontSize: 'var(--text-sm)',
                fontWeight: 600
              }}
            >
              <Compass size={15} aria-hidden="true" />
              <span className="mobile-hide">Guide</span>
            </button>
          )}

          {/* Cloud Sync Status Badge — a real button, and a polite live region
              so sync state changes are announced instead of colour-only.

              Colour is semantic here: --success when the vault is safe,
              --danger when it is not, --accent-gold for the one state that is
              neither. It no longer reaches for a raw hex. */}
          <button
            type="button"
            onClick={() => storage.pullCloudVault()}
            className="neu-button"
            title={`${SYNC_LABELS[syncState] || syncState} — ${SYNC_DETAIL[syncState] || ''} Click to sync now.`}
            aria-label={`Cloud sync status: ${SYNC_LABELS[syncState] || syncState}. ${SYNC_DETAIL[syncState] || ''} Last synced ${lastSyncTime}. Activate to sync now.`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 10px',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color:
                syncState === 'syncing'
                  ? 'var(--primary)'
                  : syncState === 'offline' || syncState === 'error'
                  ? 'var(--danger)'
                  : syncState === 'local-only'
                  ? 'var(--accent-gold)'
                  : 'var(--success)'
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
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Palette size={15} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <label htmlFor="theme-select" className="sr-only">Colour theme</label>
            <select
              id="theme-select"
              value={currentTheme}
              onChange={(e) => setTheme(e.target.value)}
              title="Switch theme"
              style={{
                padding: '6px 8px',
                minHeight: '34px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-card)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                maxWidth: '132px'
              }}
            >
              {themes.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* User Account / Profile Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="neu-button"
              title="Open account profile and settings"
              aria-label={`Open account profile and settings for ${userProfile?.name || userProfile?.email || 'your account'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '5px 10px 5px 5px'
              }}
            >
              <div aria-hidden="true" style={{
                width: '26px',
                height: '26px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.7rem',
                flexShrink: 0
              }}>
                {userProfile?.name ? userProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : (userProfile?.email ? userProfile.email[0].toUpperCase() : 'RV')}
              </div>
              <span className="mobile-hide" style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-main)' }}>
                {userProfile?.name || userProfile?.email ? (userProfile?.name || userProfile?.email.split('@')[0]) : 'Account'}
              </span>
            </button>

            {/* Secondary to everything else in this bar: switching accounts is
                a rare action, and as a filled primary button it was the
                loudest thing in the header. */}
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="btn-secondary"
              style={{ padding: '7px 11px', fontSize: 'var(--text-sm)', minHeight: '34px' }}
            >
              {userProfile?.isAuthenticated ? 'Switch' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

