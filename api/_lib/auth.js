// api/_lib/auth.js
// Server-side credential hashing and session tokens.
//
// Replaces the previous scheme, where the browser computed a single SHA-256
// pass and published the resulting hash to a public bucket. Two things were
// wrong with that: one SHA-256 round is trivially brute-forced on a GPU, and
// a hash anyone can download can be attacked offline with no rate limit.
//
// Here the plaintext password is sent over HTTPS, hashed on the server with
// scrypt, and never stored or returned. scrypt is memory-hard and ships in
// node:crypto, so this needs no new dependency.

const crypto = require('crypto');

// scrypt cost. N=16384 with r=8 needs roughly 16 MB per hash, which is a
// sensible ceiling for a serverless function and still far beyond what a
// GPU cracker handles cheaply.
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LENGTH = 64;

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateSalt() {
  return randomHex(16);
}

/**
 * Opaque session token. Random, not a JWT: there is nothing to decode and
 * nothing to forge, and revoking it is a single key delete.
 */
function generateToken() {
  return randomHex(32);
}

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(derivedKey.toString('hex'));
      }
    );
  });
}

/**
 * Constant-time comparison, so response timing cannot be used to learn how
 * much of a hash matched.
 */
async function verifyPassword(password, salt, expectedHash) {
  if (!password || !salt || !expectedHash) return false;

  let actual;
  try {
    actual = await hashPassword(password, salt);
  } catch (e) {
    return false;
  }

  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

/**
 * Pulls the bearer token off a request. Accepts the Authorization header, and
 * falls back to an x-rv-token header for clients that cannot set Authorization.
 */
function readToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  const alt = req.headers?.['x-rv-token'];
  return typeof alt === 'string' && alt.trim() ? alt.trim() : null;
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

/**
 * Minimal email shape check. Deliberately permissive — the goal is to reject
 * obvious junk and keys containing characters that would break the keyspace,
 * not to police valid addresses.
 */
function isPlausibleEmail(email) {
  const value = normalizeEmail(email);
  if (value.length < 5 || value.length > 254) return false;
  if (/\s/.test(value)) return false;
  return /^[^@]+@[^@.]+\.[^@]+$/.test(value);
}

const MIN_PASSWORD_LENGTH = 8;

function passwordProblem(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Password is required.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 512) {
    return 'Password is too long.';
  }
  return null;
}

module.exports = {
  TOKEN_TTL_SECONDS,
  MIN_PASSWORD_LENGTH,
  generateSalt,
  generateToken,
  hashPassword,
  verifyPassword,
  readToken,
  normalizeEmail,
  isPlausibleEmail,
  passwordProblem
};
