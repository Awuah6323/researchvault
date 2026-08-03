import React, { useState } from 'react';
import { X, LogIn, UserPlus, Shield, Check, Lock, Mail, User, Building } from 'lucide-react';
import { storage } from '../services/storage';

export default function AuthModal({ onClose, onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login', 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in both email and password.');
      return;
    }

    try {
      if (mode === 'login') {
        const user = storage.loginUser(email.trim(), password.trim());
        setSuccess(`Welcome back, ${user.name}!`);
        setTimeout(() => {
          onLoginSuccess(storage.getProfile());
          onClose();
        }, 1000);
      } else {
        if (!name.trim()) {
          setError('Please enter your full name.');
          return;
        }
        const user = storage.registerUser(
          name.trim(),
          email.trim(),
          password.trim(),
          institution.trim() || 'Stanford University',
          fieldOfStudy.trim() || 'Computer Science'
        );
        setSuccess(`Account registered successfully for ${user.name}!`);
        setTimeout(() => {
          onLoginSuccess(storage.getProfile());
          onClose();
        }, 1000);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '460px', padding: '28px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              {mode === 'login' ? 'Scholar Sign In' : 'Create Scholar Account'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {mode === 'login' ? 'Access your research vault & cloud sync' : 'Register your academic research profile'}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', backgroundColor: 'var(--bg-main)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => { setMode('login'); setError(''); }}
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
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Full Name *</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g., Dr. Alex Rivera"
                  style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Email Address *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.rivera@stanford.edu"
                style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Password *</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Institution</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Stanford University"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Field of Study</label>
                <input
                  type="text"
                  value={fieldOfStudy}
                  onChange={(e) => setFieldOfStudy(e.target.value)}
                  placeholder="Computer Science"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '6px' }}>
            {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            <span>{mode === 'login' ? 'Sign In to Vault' : 'Create Scholar Account'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
