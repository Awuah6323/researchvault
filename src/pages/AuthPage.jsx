import React, { useEffect, useState } from 'react';
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

  // Google Client ID from .env
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  /**
   * Handle successful Google login
   */
  const handleGoogleCredential = (response) => {
    try {
      setError('');
      setGoogleLoading(true);

      if (!response || !response.credential) {
        throw new Error('Google did not return a valid credential.');
      }

      // Decode the Google JWT credential
      const payload = parseGoogleCredential(response.credential);

      if (!payload) {
        throw new Error('Unable to read Google account information.');
      }

      if (!payload.email) {
        throw new Error('Google did not provide an email address.');
      }

      // Google has verified this user's identity
      const googleUser = {
        name:
          payload.name ||
          payload.given_name ||
          'Google User',

        email: payload.email,

        institution: 'Google Verified Account',

        picture: payload.picture || '',

        googleId: payload.sub || '',
      };

      // Login or create the user in your local storage
      const user = storage.loginWithGoogle(
        googleUser.email,
        googleUser.name,
        googleUser.institution
      );

      setSuccess(
        `Signed in with Google as ${user.name}! Redirecting...`
      );

      // Redirect to the application
      setTimeout(() => {
        onLoginSuccess(storage.getProfile());
      }, 700);
    } catch (err) {
      console.error('Google Sign-In Error:', err);

      setError(
        err.message ||
          'Google Sign-In failed. Please try again.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  /**
   * Decode Google Identity Services JWT credential
   */
  const parseGoogleCredential = (token) => {
    try {
      const parts = token.split('.');

      if (parts.length !== 3) {
        throw new Error('Invalid Google credential format.');
      }

      const base64Url = parts[1];

      const base64 = base64Url
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(
            (char) =>
              '%' +
              ('00' +
                char.charCodeAt(0).toString(16)
              ).slice(-2)
          )
          .join('')
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error(
        'Failed to decode Google credential:',
        error
      );

      return null;
    }
  };

  /**
   * Initialize Google Identity Services
   */
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (!googleClientId) {
        console.error(
          'VITE_GOOGLE_CLIENT_ID is missing from .env'
        );

        setError(
          'Google Sign-In is not configured. Please check your .env file.'
        );

        return;
      }

      if (
        typeof window === 'undefined' ||
        !window.google ||
        !window.google.accounts ||
        !window.google.accounts.id
      ) {
        console.warn(
          'Google Identity Services script has not loaded yet.'
        );

        return;
      }

      try {
        // Initialize Google Identity Services
        window.google.accounts.id.initialize({
          client_id: googleClientId,

          callback: handleGoogleCredential,

          auto_select: false,

          cancel_on_tap_outside: true,
        });

        // Find Google button container
        const container = document.getElementById(
          'googleGsiButtonContainer'
        );

        if (!container) {
          console.warn(
            'Google Sign-In button container not found.'
          );

          return;
        }

        // Clear existing Google button
        container.innerHTML = '';

        // Render official Google button
        window.google.accounts.id.renderButton(
          container,
          {
            theme: 'outline',

            size: 'large',

            width: 400,

            text: 'continue_with',

            shape: 'rectangular',

            logo_alignment: 'left',
          }
        );
      } catch (error) {
        console.error(
          'Google Identity Services initialization error:',
          error
        );

        setError(
          'Unable to initialize Google Sign-In.'
        );
      }
    };

    // Try immediately
    initializeGoogleSignIn();

    // Try again after Google script loads
    const timer = setTimeout(
      initializeGoogleSignIn,
      1000
    );

    return () => {
      clearTimeout(timer);
    };
  }, [googleClientId]);

  /**
   * Normal email/password login and signup
   */
  const handleSubmit = (e) => {
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

    try {
      // LOGIN
      if (activeTab === 'login') {
        const user = storage.loginUser(
          email.trim(),
          password.trim()
        );

        setSuccess(
          `Welcome back, ${user.name}! Redirecting...`
        );

        setTimeout(() => {
          onLoginSuccess(storage.getProfile());
        }, 700);
      }

      // SIGNUP
      else {
        if (!name.trim()) {
          setError(
            'Please enter your full name.'
          );

          return;
        }

        const user = storage.registerUser(
          name.trim(),
          email.trim(),
          password.trim(),
          institution.trim() ||
            'University / Institution',
          fieldOfStudy.trim() ||
            'Computer Science'
        );

        setSuccess(
          `Account created successfully for ${user.name}!`
        );

        setTimeout(() => {
          onLoginSuccess(storage.getProfile());
        }, 700);
      }
    } catch (err) {
      console.error(
        'Authentication error:',
        err
      );

      setError(
        err.message ||
          'Authentication failed. Please check your credentials.'
      );
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

        background:
          'radial-gradient(circle at 10% 20%, rgba(0, 255, 136, 0.12), transparent 45%), radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.15), transparent 45%)',
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

                borderRadius: '14px',

                background:
                  'linear-gradient(135deg, #00ff88 0%, #10b981 50%, #059669 100%)',

                display: 'flex',

                alignItems: 'center',

                justifyContent: 'center',

                color: '#03140a',

                boxShadow:
                  '0 0 25px rgba(0, 255, 136, 0.4)',
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
                  color: '#00ff88',
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

                    color:
                      'var(--text-muted, #82a493)',
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

                backgroundColor:
                  'var(--bg-card, #0d1510)',

                border:
                  '1px solid var(--border-color, #1a3325)',
              }}
            >
              <Search
                size={20}
                style={{
                  color: '#00e5ff',
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

          {/* GOOGLE SIGN-IN */}
          <div
            style={{
              width: '100%',

              minHeight: '44px',

              display: 'flex',

              justifyContent: 'center',

              marginBottom: '16px',
            }}
          >
            <div
              id="googleGsiButtonContainer"
            />
          </div>

          {/* GOOGLE CONFIG ERROR */}
          {!googleClientId && (
            <div
              style={{
                padding: '12px',

                marginBottom: '16px',

                borderRadius: '10px',

                backgroundColor: '#fee2e2',

                color: '#991b1b',

                fontSize: '0.85rem',
              }}
            >
              Google Sign-In is not configured.
              Please add VITE_GOOGLE_CLIENT_ID to
              your .env file and restart the app.
            </div>
          )}

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

          {/* ERROR */}
          {error && (
            <div
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
              <Check size={18} />

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
                    type="text"
                    required
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
                  type="email"
                  required
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
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  required
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
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
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
                    type="text"
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
              className="btn-primary"
              style={{
                width: '100%',

                marginTop: '8px',

                padding: '12px',

                display: 'flex',

                alignItems: 'center',

                justifyContent: 'center',

                gap: '8px',
              }}
            >
              {activeTab === 'login' ? (
                <LogIn size={18} />
              ) : (
                <UserPlus size={18} />
              )}

              <span>
                {activeTab === 'login'
                  ? 'Sign In to ResearchVault'
                  : 'Create Scholar Account'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
