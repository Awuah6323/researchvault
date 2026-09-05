// api/_lib/http.js
// Shared HTTP hardening for every ResearchVault serverless function.
//
// Vercel does not route files under an underscore-prefixed directory, so
// everything in api/_lib is a private module rather than a public endpoint.
//
// One place decides CORS, security headers, and what an error looks like to a
// client, so the three handlers cannot drift apart from each other.

/**
 * Origins allowed to call the API from a browser.
 *
 * Production origins come from ALLOWED_ORIGINS (comma separated). The Vercel
 * system variables are included automatically so a preview deployment can call
 * its own API without anyone having to maintain a list of preview URLs.
 *
 * The dev origins are added only outside production. `npm run dev` serves on
 * 3000 (vite.config.js) and `vercel dev` on 3000 too; 5173 is Vite's own
 * default and is kept for anyone running with the stock config.
 */
function allowedOrigins() {
  const origins = new Set();

  for (const raw of String(process.env.ALLOWED_ORIGINS || '').split(',')) {
    const trimmed = raw.trim();
    if (trimmed) origins.add(trimmed.replace(/\/$/, ''));
  }

  // Set by Vercel on every deployment: the canonical production domain and the
  // URL of this specific deployment.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }

  if (process.env.VERCEL_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
  }

  return origins;
}

/**
 * Applies CORS for one request.
 *
 * Only an exact origin match is ever reflected — never `*`. These endpoints
 * carry bearer tokens, and a wildcard origin combined with credentials is both
 * rejected by browsers and a sign the policy was never really thought about.
 *
 * A request with no Origin header (curl, the Vercel cron, a native WebView
 * loading from file://) is not a browser cross-origin request, so there is
 * nothing to allow or deny here — the endpoint's own auth check governs it.
 *
 * @returns {boolean} false when the browser origin is not on the allowlist
 */
export function applyCors(req, res, { methods = 'POST, OPTIONS' } = {}) {
  const origin = req.headers?.origin;

  // Vary matters even on the deny path: a CDN must not serve one origin's
  // response to another.
  res.setHeader('Vary', 'Origin');

  if (!origin) return true;

  if (!allowedOrigins().has(origin.replace(/\/$/, ''))) return false;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}

/**
 * Security headers for API responses.
 *
 * API responses are JSON or a PDF byte stream and are never a document context,
 * so the policy can be far stricter than the app's own CSP: deny everything,
 * frame nothing, sniff nothing, and never cache.
 */
export function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  // Harmless over http in local dev: browsers ignore HSTS on a non-secure
  // origin, so this does not lock a developer out of localhost.
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
}

/**
 * The standard opening for a handler: CORS, headers, preflight, method check.
 *
 * @returns {boolean} true when the caller should continue handling the request.
 *                    False means a response has already been sent.
 */
export function beginRequest(req, res, { methods = ['POST'] } = {}) {
  const allowHeader = [...methods, 'OPTIONS'].join(', ');

  applySecurityHeaders(res);

  if (!applyCors(req, res, { methods: allowHeader })) {
    // Deliberately not "your origin is not allowed": an attacker probing the
    // allowlist learns nothing from this that they did not already know.
    fail(res, 403, 'Forbidden');
    return false;
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', allowHeader);
    res.status(204).end();
    return false;
  }

  if (!methods.includes(req.method)) {
    res.setHeader('Allow', allowHeader);
    fail(res, 405, 'Method not allowed');
    return false;
  }

  return true;
}

/**
 * The only way these handlers report a failure to a client.
 *
 * `message` is written by us and safe to show. Anything from an exception, a
 * database driver, or an upstream provider goes to `logDetail` instead, which
 * reaches the server log and never the response body. That is the whole
 * difference between "Unable to complete the request" and a 502 that quotes a
 * Postgres connection string back at the internet.
 */
export function fail(res, status, message, logDetail) {
  if (logDetail !== undefined) {
    console.error(`[api] ${status} ${message}:`, redact(stringifyDetail(logDetail)));
  }

  if (res.headersSent) {
    // A streaming response already started; the client sees a truncated body,
    // which is the most that can be signalled at this point.
    return res.end();
  }

  return res.status(status).json({ error: message });
}

function stringifyDetail(detail) {
  if (detail instanceof Error) return detail.stack || detail.message;
  if (typeof detail === 'string') return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

/**
 * Last-resort scrub for anything on its way to the server log.
 *
 * Logs are not public, but they are read by more people than the database is,
 * they get shipped to third-party log sinks, and a leaked key in a log line is
 * just as valid as one in a response body.
 */
export function redact(text) {
  return String(text == null ? '' : text)
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/\b(sb_(?:secret|publishable)_[A-Za-z0-9_-]{8,})/g, '[REDACTED_SUPABASE_KEY]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_GOOGLE_KEY]')
    .replace(/\bAQ\.[A-Za-z0-9_-]{10,}/g, '[REDACTED_GOOGLE_KEY]')
    .replace(/(api[-_]?key|apikey|access[-_]?token|password|secret)["'\s:=]+[^\s"',&}]+/gi, '$1=[REDACTED]')
    .replace(/\bbearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/:\/\/[^:@/\s]+:[^@/\s]+@/g, '://[REDACTED_CREDENTIALS]@')
    .slice(0, 2000);
}

/**
 * Reads a JSON body with a hard byte ceiling.
 *
 * Vercel normally parses the body for us, but it does that before any of our
 * code runs and applies its own 4.5 MB limit. Reading the stream ourselves is
 * the only way to reject an oversized body for an endpoint whose real limit is
 * measured in kilobytes, and it is what makes `stream.destroy()` below able to
 * stop an upload rather than merely refuse it after it has all arrived.
 */
export function readJsonBody(req, maxBytes) {
  // Already parsed by the platform (the common case on Vercel).
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
    const size = Buffer.byteLength(JSON.stringify(req.body));
    if (size > maxBytes) {
      const err = new Error('Request body too large');
      err.code = 'BODY_TOO_LARGE';
      throw err;
    }
    return Promise.resolve(req.body);
  }

  const declared = Number(req.headers?.['content-length'] || 0);
  if (declared > maxBytes) {
    const err = new Error('Request body too large');
    err.code = 'BODY_TOO_LARGE';
    return Promise.reject(err);
  }

  return new Promise((resolve, reject) => {
    let received = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > maxBytes) {
        const err = new Error('Request body too large');
        err.code = 'BODY_TOO_LARGE';
        req.destroy();
        reject(err);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        const err = new Error('Malformed JSON body');
        err.code = 'BAD_JSON';
        reject(err);
      }
    });

    req.on('error', reject);
  });
}

/**
 * Best available client identifier for rate limiting.
 *
 * Behind Vercel's proxy the socket address is the proxy, so x-forwarded-for is
 * the only real signal. Only the FIRST entry is used: the rest are appended by
 * intermediaries and a client can put anything it likes in front of its own
 * address, so trusting a later entry would let a caller pick its own bucket.
 */
export function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }
  return (
    req.headers?.['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}
