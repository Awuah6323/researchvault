import React, { useState } from 'react';
import { BookOpen, Sparkles, Shield, Search, Mail, Lock, User, Building, LogIn, UserPlus, Check, Eye, EyeOff } from 'lucide-react';
import { storage } from '../services/storage';

export default function AuthPage({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'signup'
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');

  // Status & Google Picker State
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGooglePicker, setShowGooglePicker] = useState(false);
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');

  const parseGoogleCredential = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  const handleGoogleAccountSelect = (acc) => {
    try {
      const user = storage.loginWithGoogle(acc.email, acc.name, acc.institution);
      setSuccess(`Signed in with Google as ${user.name} (${user.email})! Redirecting...`);
      setTimeout(() => {
        onLoginSuccess(storage.getProfile());
      }, 700);
    } catch (err) {
      setError('Google Sign-In failed.');
    }
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (googleClientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response) => {
              if (response?.credential) {
                const payload = parseGoogleCredential(response.credential);
                if (payload) {
                  handleGoogleAccountSelect({
                    name: payload.name || payload.given_name || 'Google User',
                    email: payload.email,
                    institution: 'Google Verified Account'
                  });
                }
              }
            }
          });
          const container = document.getElementById('googleGsiButtonContainer');
          if (container) {
            window.google.accounts.id.renderButton(container, {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'continue_with',
              shape: 'pill'
            });
          }
        } catch (e) {
          console.warn("GSI init warning", e);
        }
      }
    }
  }, []);

  const handleGoogleSignIn = () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (window.google?.accounts?.id && googleClientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (response?.credential) {
              const payload = parseGoogleCredential(response.credential);
              if (payload) {
                handleGoogleAccountSelect({
                  name: payload.name || payload.given_name || 'Google User',
                  email: payload.email,
                  institution: 'Google Verified Account'
                });
                return;
              }
            }
            setShowGooglePicker(true);
          }
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setShowGooglePicker(true);
          }
        });
      } catch (e) {
        setShowGooglePicker(true);
      }
    } else {
      setShowGooglePicker(true);
    }
  };

  const handleCustomGoogleSubmit = (e) => {
    e.preventDefault();
    if (!customGoogleEmail.trim() || !customGoogleName.trim()) return;
    handleGoogleAccountSelect({
      name: customGoogleName.trim(),
      email: customGoogleEmail.trim(),
      institution: 'Academic Institution'
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email address and password.');
      return;
    }

    try {
      if (activeTab === 'login') {
        const user = storage.loginUser(email.trim(), password.trim());
        setSuccess(`Welcome back, ${user.name}! Redirecting...`);
        setTimeout(() => {
          onLoginSuccess(storage.getProfile());
        }, 700);
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
          fieldOfStudy.trim() || 'Computer Science & AI'
        );
        setSuccess(`Account created successfully for ${user.name}!`);
        setTimeout(() => {
          onLoginSuccess(storage.getProfile());
        }, 700);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main, #050807)',
      color: 'var(--text-main, #f0fdf4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(circle at 10% 20%, rgba(0, 255, 136, 0.12), transparent 45%), radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.15), transparent 45%)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1080px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '32px',
        alignItems: 'center'
      }}>
        {/* Left Side: Brand & Feature Showcase */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingRight: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #00ff88 0%, #10b981 50%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#03140a',
              boxShadow: '0 0 25px rgba(0, 255, 136, 0.4)'
            }}>
              <BookOpen size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.7rem', letterSpacing: '-0.5px' }}>
                Research<span className="text-gradient-emerald">Vault</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #82a493)', fontWeight: 600, letterSpacing: '0.5px' }}>
                SMART ACADEMIC LIBRARY & AI ENGINE
              </div>
            </div>
          </div>

          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '12px' }}>
              Sign In to Your <span className="text-gradient-emerald">Academic Workspace</span>
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--text-muted, #82a493)', lineHeight: 1.6 }}>
              Organize research papers, synthesize literature reviews with Gemini AI, take annotations, and generate citations.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '14px', backgroundColor: 'var(--bg-card, #0d1510)', border: '1px solid var(--border-color, #1a3325)' }}>
              <Sparkles size={20} style={{ color: '#00ff88' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Gemini AI Research Assistant</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #82a493)' }}>Conversational research advisor & literature synthesis</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '14px', backgroundColor: 'var(--bg-card, #0d1510)', border: '1px solid var(--border-color, #1a3325)' }}>
              <Search size={20} style={{ color: '#00e5ff' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>250M+ Academic Papers & DOIs</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #82a493)' }}>OpenAlex global repository search & instant citation format</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '14px', backgroundColor: 'var(--bg-card, #0d1510)', border: '1px solid var(--border-color, #1a3325)' }}>
              <Shield size={20} style={{ color: '#34d399' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Local Storage & Device Backup</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #82a493)' }}>Complete privacy, JSON backup export & restore support</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Standard Login & Sign Up Form Card */}
        <div className="glass-card" style={{ padding: '32px', backgroundColor: 'var(--bg-card, #131f3d)', border: '1px solid var(--border-color, #1e293b)', borderRadius: '24px' }}>
          {showGooglePicker ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Sign In with Google</h3>
                </div>
                <button onClick={() => setShowGooglePicker(false)} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Back</button>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                Enter your Google Account details to sign in or create your academic profile:
              </p>

              <form onSubmit={handleCustomGoogleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={customGoogleName}
                    onChange={(e) => setCustomGoogleName(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color, #1a3325)', backgroundColor: 'var(--bg-main, #050807)', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Google Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. user@gmail.com"
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color, #1a3325)', backgroundColor: 'var(--bg-main, #050807)', fontSize: '0.9rem' }}
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: '6px' }}>
                  Continue with Google Account
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', backgroundColor: 'var(--bg-main, #0b1329)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color, #1e293b)' }}>
                <button
                  type="button"
                  onClick={() => { setActiveTab('login'); setError(''); }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    backgroundColor: activeTab === 'login' ? 'var(--primary, #38bdf8)' : 'transparent',
                    color: activeTab === 'login' ? '#ffffff' : 'var(--text-muted)'
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('signup'); setError(''); }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    backgroundColor: activeTab === 'signup' ? 'var(--primary, #38bdf8)' : 'transparent',
                    color: activeTab === 'signup' ? '#ffffff' : 'var(--text-muted)'
                  }}
                >
                  Create Account
                </button>
              </div>

              {/* Official Google Sign-In Button Container */}
              <div id="googleGsiButtonContainer" style={{ width: '100%', marginBottom: '12px', display: 'flex', justifyContent: 'center' }} />

              {/* Fallback Continue with Google Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #1a3325)',
                  backgroundColor: '#ffffff',
                  color: '#111111',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  marginBottom: '16px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color, #1e293b)' }} />
                <span style={{ padding: '0 10px' }}>OR EMAIL</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color, #1e293b)' }} />
              </div>

              {/* Status Messages */}
              {error && (
                <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.85rem', marginBottom: '16px' }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#166534', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={18} /> {success}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeTab === 'signup' && (
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Full Name *</label>
                    <div style={{ position: 'relative' }}>
                      <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', border: '1px solid var(--border-color, #1e293b)', backgroundColor: 'var(--bg-main, #0b1329)', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Email Address *</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '10px', border: '1px solid var(--border-color, #1e293b)', backgroundColor: 'var(--bg-main, #0b1329)', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Password *</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      style={{ width: '100%', padding: '12px 42px 12px 42px', borderRadius: '10px', border: '1px solid var(--border-color, #1e293b)', backgroundColor: 'var(--bg-main, #0b1329)', fontSize: '0.9rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {activeTab === 'signup' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Institution</label>
                      <input
                        type="text"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="e.g. University / Institution"
                        style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #1e293b)', backgroundColor: 'var(--bg-main, #0b1329)', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Field of Study</label>
                      <input
                        type="text"
                        value={fieldOfStudy}
                        onChange={(e) => setFieldOfStudy(e.target.value)}
                        placeholder="e.g. Computer Science"
                        style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #1e293b)', backgroundColor: 'var(--bg-main, #0b1329)', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                )}

                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px', padding: '12px' }}>
                  {activeTab === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
                  <span>{activeTab === 'login' ? 'Sign In to ResearchVault' : 'Create Scholar Account'}</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
