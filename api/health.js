// api/health.js
// ResearchVault Backend Health Check Endpoint (Vercel Serverless Function)
// Verifies backend connectivity and lightweight Supabase database communication.
// Scheduled to run 3 times daily: 02:00, 10:00, 18:00 UTC.

import { createClient } from '@supabase/supabase-js';

function formatUtcTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

function sanitizeErrorMessage(err) {
  if (!err) return 'Unknown error';
  let msg = typeof err === 'string' ? err : err.message || JSON.stringify(err);
  // Redact potential secrets, keys, or sensitive patterns
  msg = msg.replace(/ey[a-zA-Z0-9_-]{20,}/g, '[REDACTED_TOKEN]');
  msg = msg.replace(/apikey=[^&]+/gi, 'apikey=[REDACTED]');
  msg = msg.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
  return msg.slice(0, 300);
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
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const errorMsg = 'Supabase credentials are not configured on the server';
    console.error(`Health Check\n--------------------------------\nTimestamp: ${timestampStr}\nStatus: FAILED\nDatabase: Unavailable\nError: ${errorMsg}\n`);
    return {
      statusCode: 500,
      body: {
        status: 'error',
        database: 'unavailable',
        timestamp: isoTimestamp,
        error: errorMsg
      }
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Lightweight query: HEAD count on vaults table (returns 0 rows, verifying DB connectivity & RLS)
    const { error } = await supabase
      .from('vaults')
      .select('user_id', { count: 'exact', head: true });

    const duration_ms = Date.now() - startTime;

    if (error) {
      const sanitizedError = sanitizeErrorMessage(error.message || error);
      console.error(`Health Check\n--------------------------------\nTimestamp: ${timestampStr}\nStatus: FAILED\nDatabase: Unavailable\nError: ${sanitizedError}\n`);
      return {
        statusCode: 503,
        body: {
          status: 'error',
          database: 'unavailable',
          timestamp: isoTimestamp,
          duration_ms,
          error: sanitizedError
        }
      };
    }

    console.log(`Health Check\n--------------------------------\nTimestamp: ${timestampStr}\nStatus: SUCCESS\nDatabase: Connected\nDuration: ${duration_ms} ms\n`);

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        database: 'connected',
        timestamp: isoTimestamp,
        duration_ms
      }
    };
  } catch (err) {
    const duration_ms = Date.now() - startTime;
    const sanitizedError = sanitizeErrorMessage(err);
    console.error(`Health Check\n--------------------------------\nTimestamp: ${timestampStr}\nStatus: FAILED\nDatabase: Unavailable\nError: ${sanitizedError}\n`);
    return {
      statusCode: 503,
      body: {
        status: 'error',
        database: 'unavailable',
        timestamp: isoTimestamp,
        duration_ms,
        error: sanitizedError
      }
    };
  }
}

export default async function handler(req, res) {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await performHealthCheck();
  return res.status(result.statusCode).json(result.body);
}
