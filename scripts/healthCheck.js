// scripts/healthCheck.js
// Standalone Supabase keep-alive & health check.
//
// Designed to run in GitHub Actions every 4 hours to prevent the free-tier
// Supabase database from pausing after 7 days of inactivity.
//
// ZERO EXTERNAL DEPENDENCIES: Uses native Node.js fetch (Node 18+) so GitHub
// Actions does not need a slow npm install / npm ci step.

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

const rawUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';
const SUPABASE_URL = rawUrl.trim().replace(/\/+$/, '');

const rawKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';
const SUPABASE_KEY = rawKey.trim();

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/** Check 1 — The actual keep-alive: run a lightweight query against the DB via PostgREST. */
async function checkDatabase() {
  const start = Date.now();
  try {
    // 1. Primary check: Query the vaults table
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vaults?select=user_id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: 'count=exact'
      },
      signal: AbortSignal.timeout(15000)
    });
    const ms = Date.now() - start;

    if (res.ok) {
      const countHeader = res.headers.get('content-range');
      console.log(`✅ Database connected (${ms} ms) — PostgREST status ${res.status}${countHeader ? ` [count: ${countHeader}]` : ''}`);
      return true;
    }

    // 2. Fallback check: If table not found (404), query the PostgREST root OpenAPI schema.
    // This still executes a real PostgreSQL catalog query to wake the DB.
    if (res.status === 404) {
      console.warn(`⚠️  Table 'vaults' returned 404. Checking PostgREST schema...`);
      const schemaRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        },
        signal: AbortSignal.timeout(15000)
      });
      if (schemaRes.ok) {
        console.log(`✅ Database connected via PostgREST schema (${Date.now() - start} ms)`);
        return true;
      }
    }

    const errorText = await res.text().catch(() => '');
    console.error(`❌ Database query FAILED (${ms} ms): HTTP ${res.status} ${res.statusText} ${errorText}`);
    return false;
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`❌ Database query FAILED (${ms} ms): ${err.message}`);
    return false;
  }
}

/** Check 2 — Verify the Supabase Auth service is responding. */
async function checkAuth() {
  const start = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_KEY },
      signal: AbortSignal.timeout(10000)
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
    console.error('❌ FATAL: Missing Supabase credentials in GitHub Actions.');
    console.error('   Please ensure repository secrets are configured in GitHub:');
    console.error('   → Repo Settings → Secrets and variables → Actions');
    console.error('   → Required secrets:');
    console.error('       • VITE_SUPABASE_URL (or SUPABASE_URL)');
    console.error('       • VITE_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY / SUPABASE_KEY)');
    process.exit(1);
  }

  // Redact all but the first 8 characters of the URL subdomain
  const safeUrl = SUPABASE_URL.replace(
    /^(https:\/\/[a-z0-9]{6})[a-z0-9]+/i,
    '$1***'
  );
  console.log(`🔗 Supabase URL: ${safeUrl}`);

  // --- Run all checks ---
  console.log('\n--- Check 1: Direct Database Query (Keep-Alive) ---');
  const dbOk = await checkDatabase();

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
    console.error('    The free-tier Supabase project may already be paused.');
    console.error('    → Go to https://supabase.com/dashboard and unpause the project.');
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
