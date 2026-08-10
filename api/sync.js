// api/sync.js
// ResearchVault Cloud Synchronization Engine — Vercel Serverless Route
// Enables cross-device authentication and real-time paper library synchronization (Laptop <-> Phone).

const INDEX_OBJECT_ID = "ff8081819f7e10ae019fec51d4f21e41";
const REST_API_BASE = "https://api.restful-api.dev/objects";

// Memory cache per serverless instance
const localMemoryStore = new Map();

async function getMasterIndex() {
  try {
    const res = await fetch(`${REST_API_BASE}/${INDEX_OBJECT_ID}`);
    if (res.ok) {
      const json = await res.json();
      return json.data || {};
    }
  } catch (e) {}
  return {};
}

async function updateMasterIndex(newIndexData) {
  try {
    await fetch(`${REST_API_BASE}/${INDEX_OBJECT_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'researchvault_global_index_v1', data: newIndexData })
    });
  } catch (e) {}
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { key: queryKey } = req.query || {};

  // GET: Retrieve user auth or vault data by key (e.g., auth_email or vault_email)
  if (req.method === 'GET') {
    if (!queryKey) {
      return res.status(400).json({ error: 'Missing key parameter' });
    }

    const safeKey = String(queryKey).toLowerCase().trim();

    if (localMemoryStore.has(safeKey)) {
      return res.status(200).json(localMemoryStore.get(safeKey));
    }

    try {
      const masterIndex = await getMasterIndex();
      const targetId = masterIndex[safeKey];

      if (targetId) {
        const itemRes = await fetch(`${REST_API_BASE}/${targetId}`);
        if (itemRes.ok) {
          const itemJson = await itemRes.json();
          if (itemJson && itemJson.data) {
            localMemoryStore.set(safeKey, itemJson.data);
            return res.status(200).json(itemJson.data);
          }
        }
      }
    } catch (err) {
      console.warn("Sync fetch error:", err);
    }

    return res.status(404).json({ error: 'Key not found in Cloud Vault' });
  }

  // POST/PUT: Save user auth or vault data
  if (req.method === 'POST' || req.method === 'PUT') {
    const { key: bodyKey, data } = req.body || {};
    const key = String(bodyKey || queryKey || '').toLowerCase().trim();

    if (!key || !data) {
      return res.status(400).json({ error: 'Missing key or data in request' });
    }

    localMemoryStore.set(key, data);

    try {
      const masterIndex = await getMasterIndex();
      let targetId = masterIndex[key];

      if (targetId) {
        // Update existing cloud object
        await fetch(`${REST_API_BASE}/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: key, data })
        });
      } else {
        // Create new cloud object
        const createRes = await fetch(REST_API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: key, data })
        });

        if (createRes.ok) {
          const createJson = await createRes.json();
          if (createJson && createJson.id) {
            masterIndex[key] = createJson.id;
            await updateMasterIndex(masterIndex);
          }
        }
      }

      return res.status(200).json({ success: true, timestamp: new Date().toISOString() });
    } catch (err) {
      console.warn("Sync save error:", err);
      return res.status(200).json({ success: true, cachedInMemory: true });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
