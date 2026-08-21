// api/sync.js
// Cross-device vault sync for ResearchVault.
//
// What changed from the previous version, and why:
//
//  1. It required no authentication at all. `GET /api/sync?key=auth_someone@
//     example.com` returned that person's password hash and salt to any
//     caller, and POST would overwrite any account. Every route here now
//     demands a bearer token, and the account synced is the one the token
//     belongs to — a client cannot name someone else's vault.
//
//  2. It stored everything in api.restful-api.dev, a public demo bucket.
//     Storage now goes through _lib/store (Upstash Redis).
//
//  3. It shipped the entire vault on every change and re-pulled it on a timer
//     whether or not anything had changed. There is now a monotonic version
//     per vault and a `?meta=1` read that returns just {version, updatedAt}.
//     The common case — nothing changed — is a tiny response the client can
//     answer without touching localStorage at all.
//
// Routes:
//   GET  /api/sync?meta=1   -> { version, updatedAt }          (cheap poll)
//   GET  /api/sync          -> { version, updatedAt, vault }   (full pull)
//   POST /api/sync          { baseVersion, vault } -> commit or conflict

const store = require('./_lib/store');
const { readToken } = require('./_lib/auth');

const tokenKey = (token) => `rv:token:${token}`;
const vaultKey = (email) => `rv:vault:${email}`;
const vaultMetaKey = (email) => `rv:vaultmeta:${email}`;

// Guard against a runaway client pushing something enormous. Vaults are
// metadata and notes only; PDF blobs stay on the device.
const MAX_VAULT_BYTES = 3 * 1024 * 1024; // 3 MB

function applyCors(res) {
  const origin = process.env.PUBLIC_APP_ORIGIN || '';
  res.setHeader('Access-Control-Allow-Origin', origin || 'null');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-rv-token');
  res.setHeader('Cache-Control', 'no-store');
}

async function requireSession(req, res) {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing sync token' });
    return null;
  }

  const session = await store.getJson(tokenKey(token));
  if (!session || !session.email) {
    res.status(401).json({ error: 'Sync token is invalid or expired' });
    return null;
  }

  return session.email;
}

/**
 * Keeps only the fields that belong in a synced vault.
 *
 * pdfFileData and fullText are dropped on purpose: a base64 PDF is often
 * megabytes, it was the main reason sync felt slow, and the file is already on
 * the device that added it. Each device keeps its own local copy and only the
 * metadata travels.
 */
function sanitizeVault(input) {
  const vault = input && typeof input === 'object' ? input : {};

  const resources = Array.isArray(vault.resources)
    ? vault.resources.map((r) => {
        const { pdfFileData, fullText, ...rest } = r || {};
        return {
          ...rest,
          // Record that a PDF exists without carrying its bytes, so another
          // device can show "PDF on your other device" rather than nothing.
          hasPdf: !!(pdfFileData || r?.hasPdf)
        };
      })
    : [];

  return {
    resources,
    categories: Array.isArray(vault.categories) ? vault.categories : [],
    notesMap: vault.notesMap && typeof vault.notesMap === 'object' ? vault.notesMap : {},
    profile: vault.profile && typeof vault.profile === 'object' ? vault.profile : null,
    deletedIds: Array.isArray(vault.deletedIds) ? vault.deletedIds.slice(0, 5000) : []
  };
}

module.exports = async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const durable = store.isPersistent();

  try {
    const email = await requireSession(req, res);
    if (!email) return undefined; // requireSession already answered

    // ------------------------------------------------------------------ READ
    if (req.method === 'GET') {
      const meta = (await store.getJson(vaultMetaKey(email))) || { version: 0, updatedAt: null };

      // Cheap poll: the client compares versions and does nothing when equal.
      if (req.query?.meta === '1' || req.query?.meta === 'true') {
        return res.status(200).json({ version: meta.version || 0, updatedAt: meta.updatedAt, durable });
      }

      const vault = await store.getJson(vaultKey(email));
      return res.status(200).json({
        version: meta.version || 0,
        updatedAt: meta.updatedAt,
        vault: vault || null,
        durable
      });
    }

    // ----------------------------------------------------------------- WRITE
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

      if (!body.vault || typeof body.vault !== 'object') {
        return res.status(400).json({ error: 'Missing vault payload' });
      }

      const clean = sanitizeVault(body.vault);
      const serialized = JSON.stringify(clean);
      if (serialized.length > MAX_VAULT_BYTES) {
        return res.status(413).json({
          error: 'Vault payload too large to sync. Try removing very long notes or abstracts.'
        });
      }

      const meta = (await store.getJson(vaultMetaKey(email))) || { version: 0, updatedAt: null };
      const remoteVersion = meta.version || 0;
      const baseVersion = Number.isFinite(body.baseVersion) ? body.baseVersion : 0;

      // Optimistic concurrency. If another device wrote since this client last
      // pulled, refuse and hand back the newer vault so the client can merge
      // and retry, rather than silently discarding the other device's work.
      if (remoteVersion > baseVersion) {
        const current = await store.getJson(vaultKey(email));
        return res.status(409).json({
          error: 'conflict',
          version: remoteVersion,
          updatedAt: meta.updatedAt,
          vault: current || null,
          durable
        });
      }

      const nextVersion = remoteVersion + 1;
      const updatedAt = new Date().toISOString();

      await store.setJson(vaultKey(email), clean);
      await store.setJson(vaultMetaKey(email), { version: nextVersion, updatedAt });

      return res.status(200).json({ version: nextVersion, updatedAt, durable });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[sync] error:', err);
    return res.status(500).json({ error: 'Sync service error' });
  }
};
