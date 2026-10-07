// scripts/healthCheck.js
// Standalone Supabase keep-alive & health check.
//
// Designed to run in GitHub Actions every 4 hours to prevent the free-tier
// Supabase database from pausing after 7 days of inactivity.
//
// IMPORTANT: This script does NOT import from api/ — those modules depend on
// the Vercel serverless runtime and crash when run as plain Node.js.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Load .env if present (for local testing; GitHub Actions uses secrets)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/** Check 1 — The actual keep-alive: run a lightweight query against the DB. */
async function checkDatabase(supabase) {
  const start = Date.now();
  const { count, error } = await supabase
    .from('vaults')
    .select('user_id', { count: 'exact', head: true });

  const ms = Date.now() - start;

  if (error) {
    console.error(`❌ Database query FAILED (${ms} ms): ${error.message}`);
    return false;
  }

  console.log(`✅ Database connected (${ms} ms) — ${count ?? 0} vault row(s)`);
  return true;
}

/** Check 2 — Verify the Supabase Auth service is responding. */
async function checkAuth() {
  const start = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_KEY }
    });
    const ms = Date.now() - start;

    if (res.ok) {
      console.log(`✅ Auth service healthy (${ms} ms)`);
      return true;
    }
    console.warn(`⚠️  Auth service returned ${res.status} (${ms} ms)`);
    return false;
  } catch (err) {
    console.warn(`⚠️  Auth service unreachable: ${err.message}`);
    return false;
  }
}

/** Check 3 — Optional: ping the deployed Vercel health endpoint. */
async function checkDeployedEndpoint() {
  const raw = process.env.DEPLOYED_URL || process.env.VERCEL_URL;
  if (!raw) {
    console.log('ℹ️  DEPLOYED_URL not set — skipping endpoint check');
    return true;
  }

  const url = raw.startsWith('http') ? raw : `https://${raw}`;
  const start = Date.now();
  try {
    const res = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(15000)
    });
    const ms = Date.now() - start;
    const body = await res.json().catch(() => ({}));
    console.log(`✅ Deployed endpoint responded (${ms} ms): ${JSON.stringify(body)}`);
    return true;
  } catch (err) {
    const ms = Date.now() - start;
    console.warn(`⚠️  Deployed endpoint unreachable (${ms} ms): ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const divider = '='.repeat(60);
  console.log(divider);
  console.log(' ResearchVault — Supabase Keep-Alive Health Check');
  console.log(` Timestamp : ${new Date().toISOString()}`);
  console.log(` Schedule  : Every 4 hours via GitHub Actions`);
  console.log(divider);
  console.log();

  // --- Validate credentials ---
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ FATAL: Missing SUPABASE_URL or SUPABASE_ANON_KEY.');
    console.error('   → GitHub repo: Settings → Secrets → Actions');
    console.error('   → Local: add them to .env');
    process.exit(1);
  }

  // Redact all but the first 8 characters of the URL subdomain
  const safeUrl = SUPABASE_URL.replace(
    /^(https:\/\/[a-z0-9]{6})[a-z0-9]+/i,
    '$1***'
  );
  console.log(`🔗 Supabase URL: ${safeUrl}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // --- Run all checks ---
  console.log('\n--- Check 1: Direct Database Query (Keep-Alive) ---');
  const dbOk = await checkDatabase(supabase);

  console.log('\n--- Check 2: Auth Service Health ---');
  const authOk = await checkAuth();

  console.log('\n--- Check 3: Deployed Endpoint (Optional) ---');
  await checkDeployedEndpoint();

  // --- Summary ---
  console.log();
  console.log(divider);
  if (dbOk) {
    console.log(' ✅ Keep-alive completed — database will not pause');
  } else {
    console.error(' ❌ Database check FAILED — investigate immediately');
    console.error(
      '    The free-tier Supabase project may already be paused.'
    );
    console.error(
      '    → Go to https://supabase.com/dashboard and unpause the project.'
    );
  }
  if (!authOk) {
    console.warn(' ⚠️  Auth service degraded — Google sign-in may be affected');
  }
  console.log(divider);

  if (!dbOk) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Health check runner crashed:', err);
  process.exit(1);
});
