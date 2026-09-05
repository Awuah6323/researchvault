import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor, Share, PlusSquare, CheckCircle, Sparkles, ShieldCheck, Zap, Info } from 'lucide-react';
import Modal from './Modal';
import { useAnnounce } from './FeedbackProvider';

export default function InstallPwaModal({ onClose, deferredPrompt, isStandalone, onInstallSuccess }) {
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);
  const [showManualHint, setShowManualHint] = useState(false);
  const announce = useAnnounce();

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setInstalled(true);
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setShowManualHint(true);
      announce(
        "This browser has no install button. Use the browser menu and choose Add to Home Screen or Install App.",
        { assertive: true }
      );
      return;
    }

    setIsInstalling(true);
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalled(true);
        announce('ResearchVault installed successfully.');
        if (onInstallSuccess) onInstallSuccess();
      }
    } catch (err) {
      console.error('PWA Installation Error:', err);
      setShowManualHint(true);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      labelledBy="install-pwa-title"
      zIndex={1000}
      overlayStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)' }}
      panelClassName=""
      panelStyle={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '24px',
        border: '1px solid var(--border-color)',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        position: 'relative',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
        {/* Header Banner */}
        <div style={{
          backgroundColor: 'var(--bg-main)',
          padding: '24px 24px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--card-shadow)'
            }}>
              <img src="/logo_icon.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <h2 id="install-pwa-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Install ResearchVault App
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Phone • Tablet • Desktop Browser App
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install dialog"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {installed ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <CheckCircle size={36} />
              </div>
              <h4 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: 'var(--text-main)' }}>
                ResearchVault is Installed!
              </h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                You are currently running the installed native web application.
              </p>
            </div>
          ) : isIOS ? (
            /* iOS Specific Instructions */
            <div>
              <div style={{
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Smartphone size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                  Install on <strong>iPhone or iPad</strong> directly from Safari in 3 steps:
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>1</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', flex: 1 }}>
                    Tap the <strong>Share</strong> icon in your Safari browser bar
                  </div>
                  <Share size={18} style={{ color: 'var(--primary)' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>2</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', flex: 1 }}>
                    Scroll down and tap <strong>Add to Home Screen</strong>
                  </div>
                  <PlusSquare size={18} style={{ color: 'var(--primary)' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>3</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', flex: 1 }}>
                    Tap <strong>Add</strong> in the top right corner
                  </div>
                  <CheckCircle size={18} style={{ color: 'var(--primary)' }} />
                </div>
              </div>
            </div>
          ) : (
            /* Chrome / Android / Edge / Desktop */
            <div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '14px',
                backgroundColor: 'var(--bg-main)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: '18px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <CheckCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span><strong>Dedicated window:</strong> Distraction-free research workspace</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <CheckCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span><strong>Offline support:</strong> Read saved papers without an active connection</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <CheckCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span><strong>Fast launch:</strong> Opens instantly from your dock or taskbar</span>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
                Installing converts ResearchVault into a standalone desktop or mobile application on your device.
              </p>

              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.95rem'
                }}
              >
                <Download size={18} aria-hidden="true" />
                <span>{isInstalling ? 'Installing...' : 'Install Application'}</span>
              </button>

              {/* Fallback guidance when the browser exposes no install prompt */}
              {showManualHint && (
                <div
                  role="alert"
                  style={{
                    marginTop: '14px',
                    padding: '14px',
                    borderRadius: '14px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderLeft: '4px solid var(--primary)',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start'
                  }}
                >
                  <Info size={18} aria-hidden="true" style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                    Your browser doesn&apos;t offer a one-tap install for this app. Open the
                    browser menu (<strong>⋮</strong> or <strong>Share</strong>) and choose{' '}
                    <strong>Add to Home Screen</strong> or <strong>Install App</strong>.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          backgroundColor: 'var(--bg-main)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '0.85rem' }}
          >
            Done
          </button>
        </div>
    </Modal>
  );
}
