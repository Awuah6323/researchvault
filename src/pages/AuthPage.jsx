import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Shield,
  Search,
  Mail,
  Lock,
  User,
  LogIn,
  UserPlus,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { storage } from '../services/storage';

/**
 * Turns an auth failure into a message that points at the actual cause.
 * The previous catch-all ("check your credentials") sent people to retype a
 * password that was never the problem when the real failure was the network
 * or the cloud vault being unreachable.
 */
function resolveAuthErrorMessage(err) {
  const raw = (err && err.message) || '';

  if (/already registered|already exists|User already/i.test(raw)) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (/Invalid email address or password|Invalid login credentials/i.test(raw)) {
    return 'That email and password combination doesn’t match an account. Check for typos, or create an account if you haven’t yet.';
  }
  if (/Email not confirmed/i.test(raw)) {
    return 'This account still needs confirming. Open the link in the email we sent you, then sign in.';
  }
  if (/Password should be at least|password.*6 characters/i.test(raw)) {
    return 'Please choose a longer password — at least 8 characters.';
  }
  if (/rate limit|too many requests/i.test(raw)) {
    return 'Too many attempts in a short time. Wait a minute and try again.';
  }
  if (err?.name === 'BackendUnavailableError' || /fetch|network|Failed to fetch|NetworkError|timeout|unreachable|not configured/i.test(raw)) {
    return 'Cloud sync is not configured on this local server. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.';
  }

  return raw || 'Something went wrong while signing you in. Please try again.';
}

export default function AuthPage({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);

  // Normal Login / Signup Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');

  // Status
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  /**
   * Google sign-in, handed off to Supabase.
   *
   * This navigates the browser to Google and does not return on success: the
   * session arrives after the redirect back, where storage.initAuth() picks it
   * up. There is deliberately no credential to inspect here. An earlier build
   * base64-decoded the token in the browser and trusted the email inside it
   * with no signature or audience check, so a hand-crafted token could claim
   * to be anyone.
   */
  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setSuccess('');
      setGoogleLoading(true);
      await storage.loginWithGoogle();
      // Not reached on success — the browser has navigated to Google.
    } catch (err) {
      setGoogleLoading(false);
      setError(
        /unreachable|not configured/i.test((err && err.message) || '')
          ? 'Google sign-in is unavailable: this build has no Supabase credentials configured.'
          : resolveAuthErrorMessage(err)
      );
    }
  };

  /**
   * Emails a reset link.
   *
   * Reports the same outcome whether or not the address has an account, so the
   * form cannot be used to discover who is registered.
   */
  const handleForgotPassword = async () => {
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Enter your email address first, then choose “Forgot password?”.');
      return;
    }

    try {
      setSubmitting(true);
      await storage.requestPasswordReset(email.trim());
      setSuccess(
        `If an account exists for ${email.trim()}, a password reset link is on its way. Check your inbox, then follow the link back here.`
      );
    } catch (err) {
      setError(resolveAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Normal email/password login and signup
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setSuccess('');

    // Validate email and password
    if (!email.trim() || !password.trim()) {
      setError(
        'Please enter both email address and password.'
      );

      return;
    }

    // Password rules only apply when creating an account — never reject an
    // existing user's password at the login form.
    if (activeTab === 'signup') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (password.length < 8) {
        setError('Please choose a password of at least 8 characters.');
        return;
      }
    }

    try {
      setSubmitting(true);

      // LOGIN
      if (activeTab === 'login') {
        const user = await storage.loginUser(
          email.trim(),
          password
        );

        setSuccess(
          `Welcome back, ${user.name}! Synchronizing vault...`
        );

        onLoginSuccess(storage.getProfile());
      }

      // SIGNUP
      else {
        const user = await storage.registerUser(
          name.trim(),
          email.trim(),
          password,
          institution.trim() ||
          'University / Institution',
          fieldOfStudy.trim() ||
          'Computer Science'
        );

        // Supabase confirms email addresses by default, which means the account
        // exists but has no session yet. Entering the app here would produce
        // something that looks signed in and silently fails to sync, so stop
        // and say what has to happen next.
        if (user.needsEmailConfirmation) {
          setSuccess(
            `Almost there — we sent a confirmation link to ${email.trim()}. Open it, then sign in.`
          );
          setActiveTab('login');
          setPassword('');
          return;
        }

        setSuccess(
          `Account created successfully for ${user.name}! Synchronizing vault...`
        );

        onLoginSuccess(storage.getProfile());
      }
    } catch (err) {
      console.error(
        'Authentication error:',
        err
      );

      // Don't tell people to check credentials when the real failure was the
      // network or the cloud vault — they'd retype a password that was fine.
      setError(resolveAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',

        backgroundColor:
          'var(--bg-main, #050807)',

        color:
          'var(--text-main, #f0fdf4)',

        display: 'flex',

        alignItems: 'center',

        justifyContent: 'center',

        padding: '24px',

        background: 'var(--bg-main)',
      }}
    >
      <div
        style={{
          width: '100%',

          maxWidth: '1080px',

          display: 'grid',

          gridTemplateColumns:
            'repeat(auto-fit, minmax(340px, 1fr))',

          gap: '32px',

          alignItems: 'center',
        }}
      >
        {/* LEFT SIDE */}
        <div
          style={{
            display: 'flex',

            flexDirection: 'column',

            gap: '24px',

            paddingRight: '20px',
          }}
        >
          {/* BRAND */}
          <div
            style={{
              display: 'flex',

              alignItems: 'center',

              gap: '12px',
            }}
          >
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              }}
            >
              <BookOpen size={28} />
            </div>

            <div>
              <div
                style={{
                  fontWeight: 800,

                  fontSize: '1.7rem',

                  letterSpacing: '-0.5px',
                }}
              >
                Research
                <span className="text-gradient-emerald">
                  Vault
                </span>
              </div>

              <div
                style={{
                  fontSize: '0.75rem',

                  color:
                    'var(--text-muted, #82a493)',

                  fontWeight: 600,

                  letterSpacing: '0.5px',
                }}
              >
                SMART ACADEMIC LIBRARY & AI ENGINE
              </div>
            </div>
          </div>

          {/* DESCRIPTION */}
          <div>
            <h1
              style={{
                fontFamily:
                  'var(--font-serif)',

                fontSize: '2.5rem',

                fontWeight: 800,

                lineHeight: 1.2,

                marginBottom: '12px',
              }}
            >
              Sign In to Your{' '}
              <span className="text-gradient-emerald">
                Academic Workspace
              </span>
            </h1>

            <p
              style={{
                fontSize: '1rem',

                color:
                  'var(--text-muted, #82a493)',

                lineHeight: 1.6,
              }}
            >
              Organize research papers, synthesize
              literature reviews with Gemini AI,
              take annotations, and generate
              citations.
            </p>
          </div>

          {/* FEATURES */}
          <div
            style={{
              display: 'flex',

              flexDirection: 'column',

              gap: '14px',
            }}
          >
            {/* FEATURE 1 */}
            <div
              style={{
                display: 'flex',

                alignItems: 'center',

                gap: '12px',

                padding: '14px 18px',

                borderRadius: '14px',

                backgroundColor:
                  'var(--bg-card, #0d1510)',

                border:
                  '1px solid var(--border-color, #1a3325)',
              }}
            >
              <Sparkles
                size={20}
                style={{
                  color: 'var(--primary)',
                }}
              />

              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.95rem',
                  }}
                >
                  Gemini AI Research Assistant
                </div>

                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Conversational research advisor &
                  literature synthesis
                </div>
              </div>
            </div>

            {/* FEATURE 2 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <Search
                size={20}
                style={{
                  color: 'var(--primary)',
                }}
              />

              <div>
                <div
                  style={{
                    fontWeight: 700,

                    fontSize: '0.95rem',
                  }}
                >
                  250M+ Academic Papers & DOIs
                </div>

                <div
                  style={{
                    fontSize: '0.8rem',

                    color:
                      'var(--text-muted, #82a493)',
                  }}
                >
                  OpenAlex global repository search &
                  instant citation format
                </div>
              </div>
            </div>

            {/* FEATURE 3 */}
            <div
              style={{
                display: 'flex',

                alignItems: 'center',

                gap: '12px',

                padding: '14px 18px',

                borderRadius: '14px',

                backgroundColor:
                  'var(--bg-card, #0d1510)',

                border:
                  '1px solid var(--border-color, #1a3325)',
              }}
            >
              <Shield
                size={20}
                style={{
                  color: '#34d399',
                }}
              />

              <div>
                <div
                  style={{
                    fontWeight: 700,

                    fontSize: '0.95rem',
                  }}
                >
                  Local Storage & Device Backup
                </div>

                <div
                  style={{
                    fontSize: '0.8rem',

                    color:
                      'var(--text-muted, #82a493)',
                  }}
                >
                  Complete privacy, JSON backup
                  export & restore support
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div
          className="glass-card"
          style={{
            padding: '32px',

            backgroundColor:
              'var(--bg-card, #131f3d)',

            border:
              '1px solid var(--border-color, #1e293b)',

            borderRadius: '24px',
          }}
        >
          {/* TABS */}
          <div
            style={{
              display: 'flex',

              gap: '8px',

              marginBottom: '24px',

              backgroundColor:
                'var(--bg-main, #0b1329)',

              padding: '4px',

              borderRadius: '12px',

              border:
                '1px solid var(--border-color, #1e293b)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError('');
                setSuccess('');
              }}
              style={{
                flex: 1,

                padding: '10px',

                borderRadius: '8px',

                fontSize: '0.9rem',

                fontWeight: 700,

                backgroundColor:
                  activeTab === 'login'
                    ? 'var(--primary, #38bdf8)'
                    : 'transparent',

                color:
                  activeTab === 'login'
                    ? '#ffffff'
                    : 'var(--text-muted)',
              }}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setError('');
                setSuccess('');
              }}
              style={{
                flex: 1,

                padding: '10px',

                borderRadius: '8px',

                fontSize: '0.9rem',

                fontWeight: 700,

                backgroundColor:
                  activeTab === 'signup'
                    ? 'var(--primary, #38bdf8)'
                    : 'transparent',

                color:
                  activeTab === 'signup'
                    ? '#ffffff'
                    : 'var(--text-muted)',
              }}
            >
              Create Account
            </button>
          </div>

          {/* GOOGLE SIGN-IN
              A real <button>, not Google's injected iframe widget. The iframe
              could not be reached by keyboard from this page and carried no
              accessible name of our own. */}
          <div
            style={{
              width: '100%',

              minHeight: '44px',

              display: 'flex',

              justifyContent: 'center',

              marginBottom: '16px',
            }}
          >
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || submitting}
              aria-label="Continue with Google"
              style={{
                width: '100%',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '11px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #1e293b)',
                backgroundColor: 'var(--bg-card, #0b1120)',
                color: 'var(--text-main, #f0fdf4)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: googleLoading || submitting ? 'wait' : 'pointer',
                opacity: googleLoading || submitting ? 0.6 : 1,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86a5.32 5.32 0 0 1-5-3.68H1.02v2.34A8.99 8.99 0 0 0 9 18Z"
                />
                <path
                  fill="#FBBC05"
                  d="M4 10.74a5.4 5.4 0 0 1 0-3.44V4.96H1.02a9 9 0 0 0 0 8.08L4 10.74Z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.98 8.98 0 0 0 1.02 4.96L4 7.3A5.32 5.32 0 0 1 9 3.58Z"
                />
              </svg>
              {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
            </button>
          </div>

          {/* DIVIDER */}
          <div
            style={{
              display: 'flex',

              alignItems: 'center',

              margin: '16px 0',

              color:
                'var(--text-muted)',

              fontSize: '0.75rem',
            }}
          >
            <div
              style={{
                flex: 1,

                height: '1px',

                backgroundColor:
                  'var(--border-color, #1e293b)',
              }}
            />

            <span
              style={{
                padding: '0 10px',
              }}
            >
              OR EMAIL
            </span>

            <div
              style={{
                flex: 1,

                height: '1px',

                backgroundColor:
                  'var(--border-color, #1e293b)',
              }}
            />
          </div>

          {/* ERROR — role="alert" makes this an assertive live region, so the
              failure is spoken instead of only turning the box red. */}
          {error && (
            <div
              id="auth-error"
              role="alert"
              style={{
                padding: '12px 14px',

                borderRadius: '10px',

                backgroundColor: '#fee2e2',

                color: '#991b1b',

                fontSize: '0.85rem',

                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {/* SUCCESS */}
          {success && (
            <div
              role="status"
              style={{
                padding: '12px 14px',

                borderRadius: '10px',

                backgroundColor: '#dcfce7',

                color: '#166534',

                fontSize: '0.85rem',

                marginBottom: '16px',

                display: 'flex',

                alignItems: 'center',

                gap: '6px',
              }}
            >
              <Check size={18} aria-hidden="true" />

              {success}
            </div>
          )}

          {/* EMAIL LOGIN / SIGNUP FORM */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',

              flexDirection: 'column',

              gap: '16px',
            }}
          >
            {/* FULL NAME */}
            {activeTab === 'signup' && (
              <div>
                <label
                  htmlFor="auth-name"
                  style={{
                    fontSize: '0.8rem',

                    fontWeight: 700,

                    color:
                      'var(--text-muted)',

                    marginBottom: '4px',

                    display: 'block',
                  }}
                >
                  Full Name *
                </label>

                <div
                  style={{
                    position: 'relative',
                  }}
                >
                  <User
                    size={18}
                    aria-hidden="true"
                    style={{
                      position: 'absolute',

                      left: '12px',

                      top: '50%',

                      transform:
                        'translateY(-50%)',

                      color:
                        'var(--text-muted)',
                    }}
                  />

                  <input
                    id="auth-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    placeholder="John Doe"
                    style={{
                      width: '100%',

                      padding:
                        '12px 12px 12px 40px',

                      borderRadius: '10px',

                      border:
                        '1px solid var(--border-color, #1e293b)',

                      backgroundColor:
                        'var(--bg-main, #0b1329)',

                      fontSize: '0.9rem',
                    }}
                  />
                </div>
              </div>
            )}

            {/* EMAIL */}
            <div>
              <label
                htmlFor="auth-email"
                style={{
                  fontSize: '0.8rem',

                  fontWeight: 700,

                  color:
                    'var(--text-muted)',

                  marginBottom: '4px',

                  display: 'block',
                }}
              >
                Email Address *
              </label>

              <div
                style={{
                  position: 'relative',
                }}
              >
                <Mail
                  size={18}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',

                    left: '14px',

                    top: '50%',

                    transform:
                      'translateY(-50%)',

                    color:
                      'var(--text-muted)',
                  }}
                />

                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby={error ? 'auth-error' : undefined}
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="name@example.com"
                  style={{
                    width: '100%',

                    padding:
                      '12px 12px 12px 42px',

                    borderRadius: '10px',

                    border:
                      '1px solid var(--border-color, #1e293b)',

                    backgroundColor:
                      'var(--bg-main, #0b1329)',

                    fontSize: '0.9rem',
                  }}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label
                htmlFor="auth-password"
                style={{
                  fontSize: '0.8rem',

                  fontWeight: 700,

                  color:
                    'var(--text-muted)',

                  marginBottom: '4px',

                  display: 'block',
                }}
              >
                Password *
              </label>

              <div
                style={{
                  position: 'relative',
                }}
              >
                <Lock
                  size={18}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',

                    left: '14px',

                    top: '50%',

                    transform:
                      'translateY(-50%)',

                    color:
                      'var(--text-muted)',
                  }}
                />

                <input
                  id="auth-password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  required
                  /* Lets password managers offer the right credential, and
                     stops Chrome warning about a missing autocomplete hint. */
                  autoComplete={
                    activeTab === 'signup'
                      ? 'new-password'
                      : 'current-password'
                  }
                  minLength={activeTab === 'signup' ? 8 : undefined}
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby={
                    activeTab === 'signup' ? 'auth-password-hint' : (error ? 'auth-error' : undefined)
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Enter your password"
                  style={{
                    width: '100%',

                    padding:
                      '12px 42px 12px 42px',

                    borderRadius: '10px',

                    border:
                      '1px solid var(--border-color, #1e293b)',

                    backgroundColor:
                      'var(--bg-main, #0b1329)',

                    fontSize: '0.9rem',
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  style={{
                    position: 'absolute',

                    right: '14px',

                    top: '50%',

                    transform:
                      'translateY(-50%)',

                    color:
                      'var(--text-muted)',
                  }}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>

              {/* Stating the rule up front beats rejecting the form after
                  the user has already committed to a password. */}
              {activeTab === 'signup' && (
                <div
                  id="auth-password-hint"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginTop: '5px',
                  }}
                >
                  Use at least 8 characters.
                </div>
              )}
            </div>

            {/* INSTITUTION AND FIELD */}
            {activeTab === 'signup' && (
              <div
                style={{
                  display: 'grid',

                  gridTemplateColumns:
                    '1fr 1fr',

                  gap: '12px',
                }}
              >
                <div>
                  <label
                    htmlFor="auth-institution"
                    style={{
                      fontSize: '0.8rem',

                      fontWeight: 700,

                      color:
                        'var(--text-muted)',

                      marginBottom: '4px',

                      display: 'block',
                    }}
                  >
                    Institution
                  </label>

                  <input
                    id="auth-institution"
                    type="text"
                    autoComplete="organization"
                    value={institution}
                    onChange={(e) =>
                      setInstitution(
                        e.target.value
                      )
                    }
                    placeholder="University / Institution"
                    style={{
                      width: '100%',

                      padding: '10px',

                      borderRadius: '10px',

                      border:
                        '1px solid var(--border-color, #1e293b)',

                      backgroundColor:
                        'var(--bg-main, #0b1329)',

                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-field-of-study"
                    style={{
                      fontSize: '0.8rem',

                      fontWeight: 700,

                      color:
                        'var(--text-muted)',

                      marginBottom: '4px',

                      display: 'block',
                    }}
                  >
                    Field of Study
                  </label>

                  <input
                    id="auth-field-of-study"
                    type="text"
                    value={fieldOfStudy}
                    onChange={(e) =>
                      setFieldOfStudy(
                        e.target.value
                      )
                    }
                    placeholder="Computer Science"
                    style={{
                      width: '100%',

                      padding: '10px',

                      borderRadius: '10px',

                      border:
                        '1px solid var(--border-color, #1e293b)',

                      backgroundColor:
                        'var(--bg-main, #0b1329)',

                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={submitting || googleLoading}
              className="btn-primary"
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: (submitting || googleLoading) ? 0.7 : 1,
                cursor: (submitting || googleLoading) ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? (
                <span>Syncing Vault...</span>
              ) : activeTab === 'login' ? (
                <>
                  <LogIn size={18} aria-hidden="true" />
                  <span>Sign In to ResearchVault</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} aria-hidden="true" />
                  <span>Create Scholar Account</span>
                </>
              )}
            </button>

            {/* FORGOT PASSWORD — login only.
                Before this there was no recovery path at all: forgetting your
                password meant permanently losing access to your library. */}
            {activeTab === 'login' && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={submitting || googleLoading}
                className="text-button"
                style={{
                  display: 'block',
                  margin: '14px auto 0',
                  background: 'none',
                  border: 'none',
                  padding: '4px 8px',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  cursor: submitting || googleLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Forgot password?
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
