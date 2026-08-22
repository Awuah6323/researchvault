import React from 'react';
import { BookOpen, Sparkles, Shield, Search, ArrowRight } from 'lucide-react';
import AuthModal from '../components/AuthModal';

export default function AuthGate({ onLoginSuccess }) {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main, #0b0f19)',
      color: 'var(--text-main, #f8fafc)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      backgroundColor: 'var(--bg-main, #0b0f19)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1100px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '40px',
        alignItems: 'center'
      }}>
        {/* Left Column: Brand Intro */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}>
              <BookOpen size={26} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-0.5px' }}>
                Research<span style={{ color: 'var(--primary)' }}>Vault</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Academic Literature & Gemini AI Engine
              </div>
            </div>
          </div>

          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.2 }}>
            Your Intelligent Academic Research Library
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.6 }}>
            Sign in or create an account to access 250M+ scholarly papers, Gemini 2.0 AI literature reviews, distracion-free PDF reader, and citation engines.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
              <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(37, 99, 235, 0.15)', color: 'var(--primary, #2563eb)' }}>
                <Sparkles size={16} />
              </div>
              <span>Gemini 2.0 Flash AI Literature Review & Conversational Chat</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
              <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(37, 99, 235, 0.15)', color: 'var(--primary, #2563eb)' }}>
                <Search size={16} />
              </div>
              <span>OpenAlex API with 250M+ Open Access Papers & DOIs</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
              <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(37, 99, 235, 0.15)', color: 'var(--primary, #2563eb)' }}>
                <Shield size={16} />
              </div>
              <span>Secure Local Data Backup & Multi-Format Citation Exporter</span>
            </div>
          </div>
        </div>

        {/* Right Column: Embedded Sign In / Sign Up Form */}
        <div style={{ position: 'relative' }}>
          <AuthModal onClose={null} onLoginSuccess={onLoginSuccess} />
        </div>
      </div>
    </div>
  );
}
