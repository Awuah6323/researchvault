// api/_lib/rateLimit.js
// Fixed-window rate limiting, shared across serverless instances when Upstash
// Redis is configured and per-instance otherwise.
//
// WHY THIS SHAPE: Vercel runs each function in isolated, short-lived instances
// that scale horizontally, so an in-memory counter is per-instance and an
// attacker spreading requests across warm instances slips past it. Redis is
// therefore the real limiter, and the in-memory path is a deliberately
// documented fallback rather than the design.
//
// The Upstash REST API is used over a Redis client library on purpose: it is
// one fetch() with a bearer token, so there is no connection pool to manage
// across cold starts and no dependency to add.
//
// To enable distributed limiting, set in the Vercel project:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
// With neither set the app still runs and still limits, just per-instance.

import { clientIp } from './http.js';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const REDIS_ENABLED = !!(REDIS_URL && REDIS_TOKEN);

/** True when limits are shared across instances rather than per-instance. */
export function isDistributed() {
  return REDIS_ENABLED;
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

// ------------------------------------------------------------------- REDIS

/**
 * INCR the window key, and set its TTL on the first hit of the window.
 *
 * Pipelined so it is one round trip. INCR returning 1 means this request opened
 * the window, and only then does EXPIRE run — re-setting the TTL on every
 * request would slide the window forward forever and never let it reset.
 */
async function redisConsume(key, windowSec, signal) {
  const response = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, String(windowSec), 'NX'],
      ['TTL', key]
    ]),
    signal
  });

  if (!response.ok) throw new Error(`Upstash responded ${response.status}`);

  const results = await response.json();
  const count = Number(results?.[0]?.result);
  const ttl = Number(results?.[2]?.result);

  if (!Number.isFinite(count)) throw new Error('Unexpected Upstash response');

  return {
    count,
    resetAt: Date.now() + (Number.isFinite(ttl) && ttl > 0 ? ttl : windowSec) * 1000
  };
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

  if (REDIS_ENABLED) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      result = await redisConsume(key, windowSec, controller.signal);
    } catch (err) {
      // Fail OPEN, but only as far as the in-memory limiter. Redis being
      // briefly unreachable should not take the app down, and it should not
      // remove the limit either — this degrades to per-instance limiting, which
      // is what the app would have had with no Redis at all.
      console.error('[rateLimit] Redis unavailable, falling back to in-memory:', err.message);
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
