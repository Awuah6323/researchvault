// api/health.js
// ResearchVault health check (Vercel serverless function).
// Verifies backend connectivity and lightweight Supabase database communication.
// Scheduled to run 3 times daily: 02:00, 10:00, 18:00 UTC.
//
// Two levels of answer, because a health endpoint has two audiences:
//
//   anonymous  — liveness only. "The function is running." No database work, so
//                the endpoint cannot be used to generate load or to watch the
//                database's state from outside.
//   authorized — the real check, including the database round trip. Requires
//                CRON_SECRET, which is what the Vercel cron and the GitHub
//                Action send.
//
// The previous version ran the database query for every anonymous caller and
// returned the driver's error text, which reported the database's health to
// anyone who asked and leaked its error messages while doing it.

import { createClient } from '@supabase/supabase-js';
import { beginRequest, redact, clientIp } from './_lib/http.js';
import { enforce, LIMITS } from './_lib/rateLimit.js';
import { safeEqual } from './_lib/auth.js';

function formatUtcTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

/**
 * Runs the database round trip.
 *
 * The ANON key is preferred over the service-role key, reversing the previous
 * order. A health check only needs to prove the database answers, which the
 * anon key does through RLS; using the service-role key meant the most
 * privileged credential in the system was loaded on a public code path for no
 * gain. Service-role is still accepted as a last resort so an environment that
 * only has that key configured keeps working.
 *
 * `customConfig` is used by scripts/healthCheck.js to simulate a failure.
 */
export async function performHealthCheck(customConfig = null) {
  const startTime = Date.now();
  const now = new Date();
  const timestampStr = formatUtcTimestamp(now);
  const isoTimestamp = now.toISOString();

  const supabaseUrl =
    customConfig?.supabaseUrl ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const supabaseKey =
    customConfig?.supabaseKey ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      `Health Check\n--------------------------------\nTimestamp: ${timestampStr}\nStatus: FAILED\nDatabase: Unavailable\nError: Supabase credentials are not configured on the server\n`
    );
    return {
      statusCode: 500,
      body: {
        status: 'error',
        database: 'unavailable',
        timestamp: isoTimestamp,
        error: 'Service configuration incomplete'
      }
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // HEAD count on vaults: zero rows returned, so this proves the database
    // answers without reading anyone's data.
    const { error } = await supabase
      .from('vaults')
      .select('user_id', { count: 'exact', head: true });

    const duration_ms = Date.now() - startTime;

    if (error) {
      console.error(
        `Health Check\n--------------------------------\nTimestamp: ${timestampStr}\nStatus: FAILED\nDatabase: Unavailable\nError: ${redact(error.message || error)}\n`
      );
      return {
        statusCode: 503,
        body: {
          status: 'error',
          database: 'unavailable',
          timestamp: isoTimestamp,
          duration_ms,
          // Deliberately not the driver's message. Even redacted, it describes
          // schema, policies, and connection state to whoever reads it.
          error: 'Database check failed'
        }
      };
    }

    console.log(
      `Health Check\n--------------------------------\nTimestamp: ${timestampStr}\nStatus: SUCCESS\nDatabase: Connected\nDuration: ${duration_ms} ms\n`
    );

    return {
      statusCode: 200,
      body: { status: 'ok', database: 'connected', timestamp: isoTimestamp, duration_ms }
    };
  } catch (err) {
    const duration_ms = Date.now() - startTime;
    console.error(
      `Health Check\n--------------------------------\nTimestamp: ${timestampStr}\nStatus: FAILED\nDatabase: Unavailable\nError: ${redact(err?.message || err)}\n`
    );
    return {
      statusCode: 503,
      body: {
        status: 'error',
        database: 'unavailable',
        timestamp: isoTimestamp,
        duration_ms,
        error: 'Database check failed'
      }
    };
  }
}

/**
 * True for the Vercel cron and for anyone holding CRON_SECRET.
 *
 * Vercel signs its own cron invocations with `x-vercel-cron`, which the platform
 * strips from external requests, so it cannot be forged by a caller. CRON_SECRET
 * covers the GitHub Action and manual checks.
 */
function isAuthorizedProbe(req) {
  if (req.headers?.['x-vercel-cron']) return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = String(req.headers?.authorization || '');
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? safeEqual(match[1].trim(), secret) : false;
}

export default async function handler(req, res) {
  if (!beginRequest(req, res, { methods: ['GET', 'POST'] })) return;

  if (!(await enforce(req, res, 'health', {
    ...LIMITS.HEALTH_PER_MINUTE,
    identity: `ip:${clientIp(req)}`
  }))) return;

  // Liveness only for an anonymous caller: this says the deployment is serving
  // requests and nothing whatsoever about the database.
  if (!isAuthorizedProbe(req)) {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  const result = await performHealthCheck();
  return res.status(result.statusCode).json(result.body);
}
