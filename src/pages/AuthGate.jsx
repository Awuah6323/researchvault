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
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
            }}>
              <BookOpen size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.5px' }}>
                Research<span style={{ color: 'var(--primary)' }}>Vault</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Scholarly Literature & Reference Management
              </div>
            </div>
          </div>

          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.25, color: 'var(--text-main)' }}>
            Scholarly research library and literature analysis
          </h1>

          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Access academic papers across OpenAlex, arXiv, Crossref, and PubMed with structured literature reviews, integrated PDF reading, and citation exports.
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
