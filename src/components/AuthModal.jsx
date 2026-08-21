import React, { useState, useEffect } from 'react';
import { X, LogIn, UserPlus, Shield, Check, Lock, Mail, User, Building } from 'lucide-react';
import { storage } from '../services/storage';
import { waitForGoogleIdentity } from '../utils/googleIdentity';
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

  const googleClientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    '73859989622-gfnm64hfcom43l064d0gf19f8losasrh.apps.googleusercontent.com';

  /**
   * Real Google sign-in.
   *
   * This replaces a hardcoded account picker plus a free-text form that called
   * loginWithGoogle() with whatever name and email were typed in. That was a
   * complete authentication bypass: entering someone's address signed you in as
   * them and pulled their vault. Only a Google-issued ID token is accepted now,
   * and the server verifies it before issuing a sync token.
   */
  const handleGoogleCredential = async (response) => {
    if (!response || !response.credential) {
      setError('Google did not return a credential. Please try again.');
      setGoogleLoading(false);
      return;
    }

    try {
      const user = await storage.loginWithGoogle(response.credential);
      setSuccess(`Signed in with Google as ${user.name}! Synchronizing vault...`);
      onLoginSuccess(storage.getProfile());
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    waitForGoogleIdentity()
      .then((google) => {
        if (!isMounted) return;
        try {
          google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredential,
            auto_select: false,
            cancel_on_tap_outside: true
          });

          const container = document.getElementById('authModalGsiButton');
          if (container) {
            container.innerHTML = '';
            google.accounts.id.renderButton(container, {
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left'
            });
          }
        } catch (err) {
          console.error('Google Sign-In initialization failed:', err);
        }
      })
      .catch((err) => {
        console.warn('Google Identity Services unavailable:', err.message);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId]);


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

        {/* Google Sign In — rendered by Google Identity Services so the app
            only ever receives a real, signed ID token. */}
        <div
          id="authModalGsiButton"
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', minHeight: '40px' }}
        />

        {googleLoading && (
          <div role="status" style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '10px' }}>
            Verifying your Google account...
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
