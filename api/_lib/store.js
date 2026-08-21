// api/_lib/store.js
// Key-value storage adapter for ResearchVault's sync backend.
//
// Primary: Upstash Redis over its REST API. Chosen because it needs no SDK in
// the client bundle, works from Vercel serverless with zero connection
// pooling, and is reachable with plain fetch.
//
// Set these in your Vercel project (Settings -> Environment Variables), or in
// .env for local dev:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//
// Adding the Upstash integration from the Vercel Marketplace injects both
// automatically. KV_REST_API_* names are also accepted, since Vercel's older
// KV integration used those.
//
// Fallback: if neither pair is configured, everything degrades to a per-
// instance in-memory Map. That keeps local `vercel dev` usable, but it is NOT
// durable and NOT shared between serverless instances — cross-device sync will
// not work until real credentials exist. isPersistent() reports which mode is
// active so callers can tell the client honestly instead of pretending a write
// succeeded.

const REST_URL =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL ||
  '';

const REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  '';

const hasUpstash = !!(REST_URL && REST_TOKEN);

// Shared only within one warm serverless instance.
const memory = new Map();

function isPersistent() {
  return hasUpstash;
}

/**
 * Runs a single Redis command through the Upstash REST endpoint.
 * Commands are sent as a JSON array, e.g. ["SET", "key", "value"].
 */
async function command(args) {
  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Upstash ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = await res.json();
  if (json && json.error) {
    throw new Error(`Upstash error: ${json.error}`);
  }
  return json ? json.result : null;
}

/**
 * Reads a JSON value. Returns null when the key is absent or holds
 * something that will not parse, so callers never see a raw string.
 */
async function getJson(key) {
  if (!hasUpstash) {
    const hit = memory.get(key);
    return hit === undefined ? null : hit;
  }

  const raw = await command(['GET', key]);
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;

  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Writes a JSON value, optionally with a TTL in seconds.
 */
async function setJson(key, value, ttlSeconds) {
  if (!hasUpstash) {
    memory.set(key, value);
    if (ttlSeconds) {
      // Best-effort expiry for the dev fallback.
      setTimeout(() => memory.delete(key), ttlSeconds * 1000).unref?.();
    }
    return true;
  }

  const args = ['SET', key, JSON.stringify(value)];
  if (ttlSeconds) args.push('EX', String(ttlSeconds));
  await command(args);
  return true;
}

async function del(key) {
  if (!hasUpstash) {
    memory.delete(key);
    return true;
  }
  await command(['DEL', key]);
  return true;
}

/**
 * Sets only if the key does not already exist. Used to reserve an email at
 * registration so two simultaneous signups cannot both win.
 */
async function setIfAbsent(key, value) {
  if (!hasUpstash) {
    if (memory.has(key)) return false;
    memory.set(key, value);
    return true;
  }

  const result = await command(['SET', key, JSON.stringify(value), 'NX']);
  // Upstash returns "OK" when the write happened, null when NX blocked it.
  return result === 'OK' || result === true;
}

module.exports = {
  isPersistent,
  getJson,
  setJson,
  setIfAbsent,
  del
};
