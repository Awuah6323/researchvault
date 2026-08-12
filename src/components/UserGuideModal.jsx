import React, { useState } from 'react';
import OnboardingCarousel from './OnboardingCarousel';
import { X, CheckSquare, Square, EyeOff } from 'lucide-react';

export default function UserGuideModal({ isOpen, onClose, onNavigate, onOpenAddModal }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleCloseModal = (neverShow = dontShowAgain) => {
    try {
      localStorage.setItem('researchvault_hide_dashboard_guide', 'true');
      if (neverShow) {
        localStorage.setItem('researchvault_never_show_onboarding', 'true');
        localStorage.setItem('researchvault_has_seen_onboarding', 'true');
      } else {
        localStorage.setItem('researchvault_has_seen_onboarding', 'true');
      }
    } catch (e) {}
    onClose();
  };

  const handleDontShowClick = () => {
    handleCloseModal(true);
  };

  return (
    <div 
      className="modal-overlay"
      onClick={() => handleCloseModal()}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.68)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '24px',
          backgroundColor: 'var(--bg-card)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <OnboardingCarousel 
          onNavigate={(tab) => {
            if (onNavigate) onNavigate(tab);
            handleCloseModal();
          }}
          onOpenAddModal={() => {
            if (onOpenAddModal) onOpenAddModal();
            handleCloseModal();
          }}
          onClose={() => handleCloseModal()}
        />

        {/* Modal Footer with "Don't Show Again" Checkbox & Button */}
        <div style={{
          padding: '12px 24px',
          backgroundColor: 'var(--bg-main)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottomLeftRadius: '24px',
          borderBottomRightRadius: '24px'
        }}>
          {/* Checkbox Option */}
          <label 
            onClick={() => setDontShowAgain(!dontShowAgain)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.84rem',
              fontWeight: 600,
              color: 'var(--text-main)',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div style={{ color: dontShowAgain ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              {dontShowAgain ? <CheckSquare size={18} /> : <Square size={18} />}
            </div>
            <span>Don't show this popup on startup again</span>
          </label>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleDontShowClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <EyeOff size={14} />
              <span>Don't Show Again</span>
            </button>

            <button
              onClick={() => handleCloseModal()}
              className="btn-primary"
              style={{
                padding: '6px 16px',
                fontSize: '0.82rem',
                borderRadius: '12px'
              }}
            >
              Close Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
