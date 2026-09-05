// api/health.js - ResearchVault health check (Vercel serverless function).
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

  // Liveness check for anonymous callers
  if (!isAuthorizedProbe(req)) {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  const result = await performHealthCheck();
  return res.status(result.statusCode).json(result.body);
}
