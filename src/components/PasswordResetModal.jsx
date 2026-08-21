import React, { useState, useRef } from 'react';
import { KeyRound, Eye, EyeOff, Check } from 'lucide-react';
import { storage } from '../services/storage';
import Modal from './Modal';

/**
 * Shown when the app is opened from a password-reset email.
 *
 * Supabase signs the visitor in with a recovery session whose only useful power
 * is setting a new password, so this is deliberately not dismissable by
 * backdrop click or Escape: leaving it without choosing a password strands the
 * user in a half-signed-in state with no obvious way back.
 *
 * Built on Modal, so it inherits the focus trap, focus restoration and dialog
 * semantics rather than reimplementing them.
 */
export default function PasswordResetModal({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Please choose a password of at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Those two passwords don’t match.');
      return;
    }

    try {
      setSubmitting(true);
      await storage.completePasswordReset(password);
      setDone(true);
      // Let the confirmation be read before the dialog goes away.
      setTimeout(() => onDone(), 1600);
    } catch (err) {
      setError(
        (err && err.message) ||
          'Could not update your password. The reset link may have expired — request a new one.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onDone}
      labelledBy="password-reset-title"
      describedBy="password-reset-intro"
      closeOnBackdrop={false}
      closeOnEscape={false}
      initialFocusRef={passwordRef}
      zIndex={900}
      panelStyle={{ width: '100%', maxWidth: '420px', padding: '26px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <KeyRound size={20} aria-hidden="true" style={{ color: 'var(--primary)' }} />
        <h2 id="password-reset-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
          Choose a new password
        </h2>
      </div>

      <p
        id="password-reset-intro"
        style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}
      >
        You followed a reset link, so you can set a new password now. It needs to be
        at least 8 characters.
      </p>

      {done ? (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px',
            borderRadius: '10px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#10b981',
            fontSize: '0.85rem',
            fontWeight: 600
          }}
        >
          <Check size={16} aria-hidden="true" />
          Password updated. You’re signed in.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <div
              role="alert"
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#ef4444',
                fontSize: '0.82rem',
                marginBottom: '14px'
              }}
            >
              {error}
            </div>
          )}

          <label
            htmlFor="reset-new-password"
            style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}
          >
            New password
          </label>
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <input
              ref={passwordRef}
              id="reset-new-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              style={{
                width: '100%',
                padding: '10px 42px 10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.88rem'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              {showPassword ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </button>
          </div>

          <label
            htmlFor="reset-confirm-password"
            style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}
          >
            Confirm new password
          </label>
          <input
            id="reset-confirm-password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.88rem',
              marginBottom: '18px'
            }}
          />

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '11px',
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </Modal>
  );
}
