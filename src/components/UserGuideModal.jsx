import React from 'react';
import OnboardingCarousel from './OnboardingCarousel';
import { X, Compass } from 'lucide-react';

export default function UserGuideModal({ isOpen, onClose, onNavigate, onOpenAddModal }) {
  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          position: 'relative'
        }}
      >
        <OnboardingCarousel 
          onNavigate={(tab) => {
            if (onNavigate) onNavigate(tab);
            onClose();
          }}
          onOpenAddModal={() => {
            if (onOpenAddModal) onOpenAddModal();
            onClose();
          }}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
