import React, { useState } from 'react';
import { X, LogIn, UserPlus, Shield, Check, Lock, Mail, User, Building } from 'lucide-react';
import { storage } from '../services/storage';
import Modal from './Modal';

export default function AuthModal({ onClose, onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login', 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in both email and password.');
      return;
    }

    try {
      setSubmitting(true);
      if (mode === 'login') {
        const user = await storage.loginUser(email.trim(), password);
        setSuccess(`Welcome back, ${user.name}! Synchronizing vault...`);
        onLoginSuccess(storage.getProfile());
        onClose();
      } else {
        if (!name.trim()) {
          setError('Please enter your full name.');
          setSubmitting(false);
          return;
        }
        if (password.length < 8) {
          setError('Please choose a password of at least 8 characters.');
          setSubmitting(false);
          return;
        }
        const user = await storage.registerUser(
          name.trim(),
          email.trim(),
          password,
          institution.trim() || 'University / Institution',
          fieldOfStudy.trim() || 'Computer Science'
        );

        // Email confirmation is on by default, so the account exists but has no
        // session yet. Closing the modal here would look like success and then
        // silently fail to sync.
        if (user.needsEmailConfirmation) {
          setSuccess(
            `Almost there — we sent a confirmation link to ${email.trim()}. Open it, then sign in.`
          );
          setMode('login');
          setPassword('');
          setSubmitting(false);
          return;
        }

        setSuccess(`Account registered successfully for ${user.name}! Synchronizing vault...`);
        onLoginSuccess(storage.getProfile());
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Could not sign you in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const [googleLoading, setGoogleLoading] = useState(false);

  /**
   * Google sign-in, handed off to Supabase.
   *
   * Navigates to Google and does not return on success — the session arrives
   * after the redirect, where storage.initAuth() adopts it.
   *
   * What this replaced: a hardcoded account picker plus a free-text form that
   * called loginWithGoogle() with whatever email was typed in. That was a
   * complete authentication bypass — entering someone's address signed you in
   * as them and pulled their vault.
   */
  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setGoogleLoading(true);

    try {
      await storage.loginWithGoogle();
      // Not reached on success — the browser has navigated to Google.
    } catch (err) {
      setGoogleLoading(false);
      setError(
        /unreachable|not configured/i.test((err && err.message) || '')
          ? 'Google sign-in is unavailable: this build has no Supabase credentials configured.'
          : (err && err.message) || 'Google sign-in failed.'
      );
    }
  };

  return (
    <Modal
      onClose={onClose}
      labelledBy="auth-modal-title"
      zIndex={100}
      closeOnBackdrop={!!onClose}
      panelStyle={{ width: '100%', maxWidth: '460px', padding: '28px' }}
    >
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 id="auth-modal-title" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {mode === 'login' ? 'Scholar Sign In' : 'Create Scholar Account'}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {mode === 'login' ? 'Access your research vault & cloud sync' : 'Register your academic research profile'}
                </p>
              </div>
              {onClose && (
                <button type="button" onClick={onClose} aria-label="Close sign in dialog" style={{ color: 'var(--text-muted)', padding: '4px' }}>
                  <X size={20} aria-hidden="true" />
                </button>
              )}
            </div>

        {/* Google Sign In — a real <button>, not Google's injected iframe
            widget, which could not be reached by keyboard and carried no
            accessible name of ours. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || submitting}
            aria-label="Continue with Google"
            style={{
              width: '100%',
              minHeight: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: googleLoading || submitting ? 'wait' : 'pointer',
              opacity: googleLoading || submitting ? 0.6 : 1
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86a5.32 5.32 0 0 1-5-3.68H1.02v2.34A8.99 8.99 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M4 10.74a5.4 5.4 0 0 1 0-3.44V4.96H1.02a9 9 0 0 0 0 8.08L4 10.74Z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.98 8.98 0 0 0 1.02 4.96L4 7.3A5.32 5.32 0 0 1 9 3.58Z" />
            </svg>
            {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
          </button>
        </div>

        {googleLoading && (
          <div role="status" style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '10px' }}>
            Taking you to Google to sign in...
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
          <span style={{ padding: '0 10px' }}>OR EMAIL</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
        </div>

        {/* Tab Switcher */}
        <div role="group" aria-label="Sign in or create an account" style={{ display: 'flex', gap: '8px', marginBottom: '20px', backgroundColor: 'var(--bg-main)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            aria-pressed={mode === 'login'}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: mode === 'login' ? 'var(--primary)' : 'transparent',
              color: mode === 'login' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: mode === 'signup' ? 'var(--primary)' : 'transparent',
              color: mode === 'signup' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.85rem', marginBottom: '14px' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#dcfce7', color: '#166534', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} /> {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'signup' && (
            <div>
              <label htmlFor="authmodal-name" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Full Name *</label>
              <div style={{ position: 'relative' }}>
                <User size={16} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="authmodal-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g., Dr. Alex Rivera"
                  style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="authmodal-email" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Email Address *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="authmodal-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.rivera@stanford.edu"
                style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="authmodal-password" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Password *</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="authmodal-password"
                type="password"
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={mode === 'signup' ? 8 : undefined}
                aria-describedby={mode === 'signup' ? 'authmodal-password-hint' : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
              />
            </div>
            {mode === 'signup' && (
              <div id="authmodal-password-hint" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                Use at least 8 characters.
              </div>
            )}
          </div>

          {mode === 'signup' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label htmlFor="authmodal-institution" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Institution</label>
                <input
                  id="authmodal-institution"
                  type="text"
                  autoComplete="organization"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Stanford University"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label htmlFor="authmodal-field-of-study" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Field of Study</label>
                <input
                  id="authmodal-field-of-study"
                  type="text"
                  value={fieldOfStudy}
                  onChange={(e) => setFieldOfStudy(e.target.value)}
                  placeholder="Computer Science"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{
              width: '100%',
              marginTop: '6px',
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? (
              <span>Syncing Vault...</span>
            ) : mode === 'login' ? (
              <>
                <LogIn size={18} aria-hidden="true" />
                <span>Sign In to Vault</span>
              </>
            ) : (
              <>
                <UserPlus size={18} aria-hidden="true" />
                <span>Create Scholar Account</span>
              </>
            )}
          </button>
        </form>
        </>
    </Modal>
  );
}
