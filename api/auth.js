// api/auth.js
// Registration, login and session verification for ResearchVault.
//
// The browser sends a password once over HTTPS; the server hashes it with
// scrypt and returns an opaque token. Every /api/sync call must then present
// that token, which is what stops the previous behaviour where knowing (or
// guessing) an email address was enough to read someone's whole library.
//
// Routes (all on this one function, selected by `action` in the body):
//   POST /api/auth  { action: 'register', email, password, name, ... }
//   POST /api/auth  { action: 'login',    email, password }
//   POST /api/auth  { action: 'logout' }                 + bearer token
//   GET  /api/auth                                       + bearer token -> profile

const store = require('./_lib/store');
const {
  TOKEN_TTL_SECONDS,
  generateSalt,
  generateToken,
  hashPassword,
  verifyPassword,
  readToken,
  normalizeEmail,
  isPlausibleEmail,
  passwordProblem
} = require('./_lib/auth');

const userKey = (email) => `rv:user:${email}`;
const tokenKey = (token) => `rv:token:${token}`;

function applyCors(res) {
  // Same-origin in production; the app and the API share a Vercel deployment.
  // A specific origin rather than "*" because these responses carry credentials.
  const origin = process.env.PUBLIC_APP_ORIGIN || '';
  res.setHeader('Access-Control-Allow-Origin', origin || 'null');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-rv-token');
  res.setHeader('Cache-Control', 'no-store');
}

/** Strips the secret fields before a user record is ever sent to a client. */
function publicProfile(user) {
  return {
    email: user.email,
    name: user.name,
    institution: user.institution,
    fieldOfStudy: user.fieldOfStudy,
    researchInterests: user.researchInterests,
    createdAt: user.createdAt
  };
}

async function resolveSession(req) {
  const token = readToken(req);
  if (!token) return null;

  const session = await store.getJson(tokenKey(token));
  if (!session || !session.email) return null;

  return { token, email: session.email };
}

module.exports = async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Warn loudly rather than silently accepting writes that vanish.
  const durable = store.isPersistent();

  try {
    // ---------------------------------------------------------------- GET: me
    if (req.method === 'GET') {
      const session = await resolveSession(req);
      if (!session) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = await store.getJson(userKey(session.email));
      if (!user) {
        return res.status(401).json({ error: 'Account no longer exists' });
      }
      return res.status(200).json({ user: publicProfile(user), durable });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = String(body.action || '').toLowerCase();

    // ------------------------------------------------------------- REGISTER
    if (action === 'register') {
      const email = normalizeEmail(body.email);
      const password = body.password;

      if (!isPlausibleEmail(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      const pwProblem = passwordProblem(password);
      if (pwProblem) {
        return res.status(400).json({ error: pwProblem });
      }
      if (!String(body.name || '').trim()) {
        return res.status(400).json({ error: 'Please enter your full name.' });
      }

      const salt = generateSalt();
      const passwordHash = await hashPassword(password, salt);

      const user = {
        email,
        name: String(body.name).trim().slice(0, 120),
        salt,
        passwordHash,
        institution: String(body.institution || 'University / Institution').slice(0, 160),
        fieldOfStudy: String(body.fieldOfStudy || 'General Research').slice(0, 160),
        researchInterests: String(body.researchInterests || 'Academic Literature, Data Analysis').slice(0, 400),
        createdAt: new Date().toISOString()
      };

      // NX write: if the email is taken this fails instead of overwriting,
      // which also closes the account-takeover-by-re-registration path.
      const claimed = await store.setIfAbsent(userKey(email), user);
      if (!claimed) {
        return res.status(409).json({ error: 'An account with this email address already exists.' });
      }

      const token = generateToken();
      await store.setJson(tokenKey(token), { email }, TOKEN_TTL_SECONDS);

      return res.status(201).json({ token, user: publicProfile(user), durable });
    }

    // ---------------------------------------------------------------- LOGIN
    if (action === 'login') {
      const email = normalizeEmail(body.email);
      const password = body.password;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const user = await store.getJson(userKey(email));

      // Same generic message and a comparable amount of work whether or not
      // the account exists, so this endpoint cannot be used to enumerate
      // which email addresses are registered.
      if (!user) {
        await hashPassword(password, 'absent-account-timing-equalizer');
        return res.status(401).json({ error: 'Invalid email address or password.' });
      }

      const ok = await verifyPassword(password, user.salt, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid email address or password.' });
      }

      const token = generateToken();
      await store.setJson(tokenKey(token), { email }, TOKEN_TTL_SECONDS);

      return res.status(200).json({ token, user: publicProfile(user), durable });
    }

    // --------------------------------------------------------------- LOGOUT
    if (action === 'logout') {
      const session = await resolveSession(req);
      if (session) {
        await store.del(tokenKey(session.token));
      }
      // Idempotent: logging out an already-invalid token is still success.
      return res.status(200).json({ ok: true });
    }

    // --------------------------------------------------------------- GOOGLE
    // The browser used to base64-decode the Google ID token and trust whatever
    // email it contained — no signature check, no audience check. That meant a
    // hand-crafted token could claim any address. Google's tokeninfo endpoint
    // validates the signature, expiry and audience for us.
    if (action === 'google') {
      const credential = String(body.credential || '');
      if (!credential) {
        return res.status(400).json({ error: 'Missing Google credential.' });
      }

      const expectedAudience = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';

      let claims;
      try {
        const verifyRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
        );
        if (!verifyRes.ok) {
          return res.status(401).json({ error: 'Google sign-in could not be verified.' });
        }
        claims = await verifyRes.json();
      } catch (e) {
        return res.status(502).json({ error: 'Could not reach Google to verify sign-in.' });
      }

      if (expectedAudience && claims.aud !== expectedAudience) {
        return res.status(401).json({ error: 'Google sign-in was issued for a different application.' });
      }
      if (claims.iss && !/(^|\.)accounts\.google\.com$/.test(String(claims.iss).replace(/^https:\/\//, ''))) {
        return res.status(401).json({ error: 'Google sign-in has an unexpected issuer.' });
      }
      if (claims.email_verified === 'false' || claims.email_verified === false) {
        return res.status(401).json({ error: 'This Google account has no verified email address.' });
      }

      const email = normalizeEmail(claims.email);
      if (!isPlausibleEmail(email)) {
        return res.status(401).json({ error: 'Google sign-in returned no usable email address.' });
      }

      let user = await store.getJson(userKey(email));
      if (!user) {
        // First Google sign-in creates the account. No salt/passwordHash: this
        // account authenticates through Google only, and a later password
        // registration for the same email is rejected by the NX write above.
        user = {
          email,
          name: String(claims.name || claims.given_name || email.split('@')[0]).slice(0, 120),
          provider: 'google',
          institution: 'Google Verified Account',
          fieldOfStudy: 'Academic Research',
          researchInterests: 'Academic Literature, Data Analysis',
          createdAt: new Date().toISOString()
        };
        await store.setJson(userKey(email), user);
      }

      const token = generateToken();
      await store.setJson(tokenKey(token), { email }, TOKEN_TTL_SECONDS);

      return res.status(200).json({ token, user: publicProfile(user), durable });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('[auth] error:', err);
    return res.status(500).json({ error: 'Authentication service error' });
  }
};

module.exports.resolveSession = resolveSession;
module.exports.userKey = userKey;
module.exports.tokenKey = tokenKey;
