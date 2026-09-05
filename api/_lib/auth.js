// api/_lib/auth.js
// Verifies the caller's Supabase session on the server.
//
// The client already holds a valid access token for every signed-in user, so
// requiring one costs the app nothing and turns /api/gemini from an open LLM
// relay funded by the project owner into an endpoint only its own users can
// reach. It also gives the rate limiter a stable identity to key on: an IP is
// shared by a campus and changed by a phone, a user id is neither.

import { createClient } from '@supabase/supabase-js';

// Read at call time rather than at module load. On Vercel the environment is
// populated before any module runs, so both work in production — but capturing
// at load time makes behaviour depend on import order, which is a needless
// trap for tests and for any host that populates the environment late.
function config() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  };
}

/** False when this deployment has no Supabase credentials configured. */
export function isAuthConfigured() {
  const { url, anonKey } = config();
  return !!(url && anonKey);
}

/**
 * Resolves the bearer token in the Authorization header to a user.
 *
 * Verification is delegated to Supabase rather than done here with a local JWT
 * library, deliberately: getUser() checks the signature AND the current server
 * state, so a token belonging to a deleted user or a signed-out session is
 * rejected. Local signature verification would happily accept both until the
 * token's own expiry.
 *
 * The ANON key is used, never the service-role key. The anon key is enough to
 * ask "who does this token belong to", and the service-role key bypasses RLS —
 * it has no business in a request path that handles user input.
 *
 * @returns {Promise<{id: string, email: string} | null>}
 */
export async function getUserFromRequest(req) {
  const { url, anonKey } = config();
  if (!url || !anonKey) return null;

  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  if (!match) return null;

  const token = match[1].trim();

  // A JWT is three dot-separated segments. Checking the shape first avoids a
  // network round trip for the garbage a scanner sends.
  if (!token || token.length > 4096 || token.split('.').length !== 3) return null;

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;

    return { id: data.user.id, email: data.user.email || '' };
  } catch (err) {
    // Network failure reaching Supabase. Treated as "not authenticated" rather
    // than "allowed": an auth check that fails open is not an auth check.
    console.error('[auth] Token verification failed:', err.message);
    return null;
  }
}

/**
 * Constant-time comparison, for secrets sent by a caller.
 *
 * A plain === leaks the length of the matching prefix through timing. That is
 * a slow oracle, but a cron secret is long-lived and the fix is three lines.
 */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;

  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}
