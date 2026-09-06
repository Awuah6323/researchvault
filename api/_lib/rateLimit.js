// api/_lib/rateLimit.js
// Fixed-window rate limiting, shared across serverless instances via Supabase
// Postgres and per-instance otherwise.
//
// WHY THIS SHAPE: Vercel runs each function in isolated, short-lived instances
// that scale horizontally, so an in-memory counter is per-instance and an
// attacker spreading requests across warm instances slips past it. The shared
// counter is therefore the real limiter, and the in-memory path is a
// deliberately documented fallback rather than the design.
//
// Supabase is the store because the app already depends on it — no second
// vendor, no extra credential to rotate, and the counter lives beside the data
// it is protecting. PostgREST is called with one fetch() rather than through
// @supabase/supabase-js: the whole interaction is a single RPC, so there is no
// client to construct on every cold start.
//
// To enable distributed limiting, set in the Vercel project:
//   SUPABASE_URL                (or the existing VITE_SUPABASE_URL is reused)
//   SUPABASE_SERVICE_ROLE_KEY
// and apply supabase/schema.sql, which creates public.rate_limits and the
// rv_rate_limit_hit function. With the key absent the app still runs and still
// limits, just per-instance.
//
// The service-role key is required rather than preferred: rv_rate_limit_hit is
// security definer with EXECUTE revoked from anon and authenticated, because a
// counter the browser can increment is a counter one user can use to lock
// another out. The key is read here only, stays server-side, and is never sent
// to the client — nothing VITE_-prefixed is consulted for it.

import { clientIp } from './http.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SHARED_ENABLED = !!(SUPABASE_URL && SERVICE_KEY);

const RPC_TIMEOUT_MS = 2000;

/** True when limits are shared across instances rather than per-instance. */
export function isDistributed() {
  return SHARED_ENABLED;
}

// -------------------------------------------------------- IN-MEMORY FALLBACK

const buckets = new Map();

function memoryConsume(key, limit, windowSec) {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const resetAt = Math.ceil(now / windowMs) * windowMs;

  const existing = buckets.get(key);
  const count = existing && existing.resetAt === resetAt ? existing.count + 1 : 1;
  buckets.set(key, { count, resetAt });

  // The map only grows if nothing prunes it, and a serverless instance can live
  // for many windows. Pruning on write keeps it bounded without a timer.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  return { count, resetAt };
}

// ----------------------------------------------------------------- SUPABASE

function rpc(name, args, signal) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      // One row is expected, so ask PostgREST for the object rather than an
      // array wrapping it.
      Accept: 'application/vnd.pgrst.object+json'
    },
    body: JSON.stringify(args),
    signal
  });
}

/**
 * Increments the window counter and reports where the caller stands.
 *
 * All the atomicity lives in the SQL function's `on conflict do update`, so
 * this is one round trip and two instances hitting the same key at the same
 * instant cannot both read the same count.
 */
async function sharedConsume(key, windowSec, signal) {
  const response = await rpc('rv_rate_limit_hit', { p_key: key, p_window_seconds: windowSec }, signal);

  if (!response.ok) throw new Error(`Supabase responded ${response.status}`);

  const row = await response.json();
  const count = Number(row?.hits);
  const resetAt = Date.parse(row?.reset_at);

  if (!Number.isFinite(count)) throw new Error('Unexpected rv_rate_limit_hit response');

  return {
    count,
    resetAt: Number.isFinite(resetAt) ? resetAt : Date.now() + windowSec * 1000
  };
}

/**
 * Reclaims expired rows now and then.
 *
 * A per-minute limit mints a new key every minute for every caller, so the
 * table needs sweeping. Doing it on a small fraction of requests keeps the
 * limiter self-maintaining without requiring pg_cron, and it is deliberately
 * not awaited: garbage collection must never add latency to, or fail, the
 * request that happened to trigger it.
 */
function maybeCollectGarbage() {
  if (Math.random() >= 0.005) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  rpc('rv_rate_limit_gc', {}, controller.signal)
    .catch(() => {})
    .finally(() => clearTimeout(timeout));
}

// -------------------------------------------------------------------- PUBLIC

/**
 * Consumes one unit from a bucket.
 *
 * @param {string} bucket   what is being limited, e.g. 'gemini'
 * @param {string} identity who is being limited — a user id where we have one,
 *                          falling back to the client IP
 * @returns {Promise<{allowed:boolean, remaining:number, retryAfter:number, limit:number}>}
 */
export async function consume(bucket, identity, { limit, windowSec }) {
  const windowIndex = Math.floor(Date.now() / (windowSec * 1000));
  const key = `rv:rl:${bucket}:${identity}:${windowIndex}`;

  let result;

  if (SHARED_ENABLED) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
    try {
      result = await sharedConsume(key, windowSec, controller.signal);
      maybeCollectGarbage();
    } catch (err) {
      // Fail OPEN, but only as far as the in-memory limiter. The database being
      // briefly unreachable should not take the app down, and it should not
      // remove the limit either — this degrades to per-instance limiting, which
      // is what the app would have had with no shared store at all.
      console.error('[rateLimit] shared counter unavailable, falling back to in-memory:', err.message);
      result = memoryConsume(key, limit, windowSec);
    } finally {
      clearTimeout(timeout);
    }
  } else {
    result = memoryConsume(key, limit, windowSec);
  }

  const remaining = Math.max(0, limit - result.count);

  return {
    allowed: result.count <= limit,
    remaining,
    limit,
    retryAfter: Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  };
}

/**
 * Enforces a limit and writes the standard headers.
 *
 * Headers go on every response, not only the rejection, so a well-behaved
 * client can pace itself before it is ever refused.
 *
 * @returns {Promise<boolean>} true to continue; false means a 429 was sent.
 */
export async function enforce(req, res, bucket, options) {
  const identity = options.identity || clientIp(req);
  const result = await consume(bucket, identity, options);

  res.setHeader('RateLimit-Limit', String(result.limit));
  res.setHeader('RateLimit-Remaining', String(result.remaining));
  res.setHeader('RateLimit-Reset', String(result.retryAfter));

  if (result.allowed) return true;

  res.setHeader('Retry-After', String(result.retryAfter));
  res.status(429).json({
    error: options.message || 'Too many requests. Please wait a moment and try again.',
    retryAfter: result.retryAfter
  });
  return false;
}

/**
 * The limits, in one place so they can be reasoned about together.
 *
 * These are sized against what the UI actually does. AI_* is the tight one
 * because each call costs real money upstream; a person reading papers and
 * asking questions does not approach 20 in a minute, but a script does
 * immediately.
 */
export const LIMITS = {
  // A Gemini call is the most expensive thing this app can be made to do.
  AI_PER_MINUTE: { limit: 20, windowSec: 60 },
  AI_PER_DAY: { limit: 500, windowSec: 86400 },

  // PDF fetching is bandwidth-bound rather than cost-bound, and the reader
  // legitimately retries across its resolver tiers.
  PDF_PER_MINUTE: { limit: 30, windowSec: 60 },

  // Health is a liveness probe; anything above this is scanning.
  HEALTH_PER_MINUTE: { limit: 10, windowSec: 60 }
};
