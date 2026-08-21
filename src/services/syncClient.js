// src/services/syncClient.js
// Network half of the sync engine. localStorage stays the source of truth for
// every read in the app; this module only moves changes between devices.
//
// Three ideas keep it off the critical path:
//
//  1. Writes are debounced. Starring a paper or typing a note used to fire a
//     full-vault upload per action. Changes now coalesce into one request a
//     couple of seconds after you stop.
//
//  2. Polls are two-stage. A poll first asks for {version} only. When nothing
//     changed — the normal case — the answer is a few dozen bytes and the
//     client does no parsing, no merging and no localStorage writes at all.
//
//  3. PDF bytes never leave the device. The server strips pdfFileData/fullText
//     too, so a large attachment can't make sync slow no matter what a client
//     sends.

const TOKEN_KEY = 'researchvault_sync_token';

const PUSH_DEBOUNCE_MS = 2000;
// Longest a change can sit unsent while you keep making more changes.
const PUSH_MAX_WAIT_MS = 10000;

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch (e) {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    /* private mode / storage disabled */
  }
}

function authHeaders(extra) {
  const token = getToken();
  const headers = { ...(extra || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Distinguishes "your token is bad" from "the network is down". */
export class AuthExpiredError extends Error {
  constructor(message) {
    super(message || 'Sync session expired');
    this.name = 'AuthExpiredError';
  }
}

/**
 * The sync backend could not be reached at all — offline, or running `vite dev`
 * without the serverless functions (plain Vite does not execute /api routes;
 * that needs `vercel dev`).
 *
 * Kept separate from a credential rejection so the app can fall back to
 * local-only mode instead of telling someone their password is wrong.
 */
export class BackendUnavailableError extends Error {
  constructor(message) {
    super(message || 'Sync service unreachable');
    this.name = 'BackendUnavailableError';
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      ...options,
      headers: authHeaders({
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      })
    });
  } catch (e) {
    // fetch only rejects for network-level failures.
    throw new BackendUnavailableError();
  }

  // 404/501 means the function isn't deployed; 5xx means it's broken. Neither
  // is a statement about the user's credentials.
  if (res.status === 404 || res.status === 501 || res.status === 502 || res.status === 503) {
    throw new BackendUnavailableError();
  }

  if (res.status === 401) {
    throw new AuthExpiredError();
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch (e) {
    payload = null;
  }

  return { ok: res.ok, status: res.status, payload };
}

// --------------------------------------------------------------------- AUTH

export async function apiRegister({ name, email, password, institution, fieldOfStudy }) {
  const { ok, payload } = await request('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'register', name, email, password, institution, fieldOfStudy })
  });
  if (!ok) throw new Error((payload && payload.error) || 'Could not create your account.');
  setToken(payload.token);
  return payload;
}

export async function apiLogin({ email, password }) {
  const { ok, payload } = await request('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'login', email, password })
  }).catch((err) => {
    // A 401 here means wrong credentials, not an expired session, so surface it
    // as a normal failure rather than triggering a session-expiry path.
    if (err instanceof AuthExpiredError) {
      return { ok: false, payload: { error: 'Invalid email address or password.' } };
    }
    throw err;
  });

  if (!ok) throw new Error((payload && payload.error) || 'Could not sign you in.');
  setToken(payload.token);
  return payload;
}

export async function apiGoogleLogin(credential) {
  const { ok, payload } = await request('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'google', credential })
  }).catch((err) => {
    if (err instanceof AuthExpiredError) {
      return { ok: false, payload: { error: 'Google sign-in could not be verified.' } };
    }
    throw err;
  });

  if (!ok) throw new Error((payload && payload.error) || 'Google sign-in failed.');
  setToken(payload.token);
  return payload;
}

export async function apiLogout() {
  try {
    await request('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'logout' })
    });
  } catch (e) {
    /* logging out locally matters more than the server acknowledging it */
  }
  setToken(null);
}

// --------------------------------------------------------------------- SYNC

/** Cheap poll. Returns { version, updatedAt } and nothing else. */
export async function fetchRemoteVersion() {
  const { ok, payload } = await request('/api/sync?meta=1');
  if (!ok || !payload) return null;
  return { version: payload.version || 0, updatedAt: payload.updatedAt || null, durable: payload.durable };
}

export async function fetchRemoteVault() {
  const { ok, payload } = await request('/api/sync');
  if (!ok || !payload) return null;
  return payload; // { version, updatedAt, vault, durable }
}

/**
 * Commits a vault. Resolves to:
 *   { status: 'ok', version }
 *   { status: 'conflict', version, vault }   caller merges and retries
 *   { status: 'failed', error }
 */
export async function pushRemoteVault({ vault, baseVersion }) {
  const { ok, status, payload } = await request('/api/sync', {
    method: 'POST',
    body: JSON.stringify({ vault, baseVersion })
  });

  if (ok && payload) {
    return { status: 'ok', version: payload.version, updatedAt: payload.updatedAt, durable: payload.durable };
  }
  if (status === 409 && payload) {
    return { status: 'conflict', version: payload.version, vault: payload.vault || null };
  }
  return { status: 'failed', error: (payload && payload.error) || `Sync failed (${status})` };
}

// ------------------------------------------------------- DEBOUNCED SCHEDULER

/**
 * Coalesces bursts of changes into a single request.
 *
 * `flush` is the async function that actually performs a push. It is never run
 * concurrently with itself; a change arriving mid-flight sets a follow-up flag
 * so exactly one more push happens after the current one lands.
 */
export function createPushScheduler(flush) {
  let timer = null;
  let firstQueuedAt = 0;
  let inFlight = false;
  let queuedAgain = false;

  async function run() {
    timer = null;
    firstQueuedAt = 0;

    if (inFlight) {
      queuedAgain = true;
      return;
    }

    inFlight = true;
    try {
      await flush();
    } finally {
      inFlight = false;
      if (queuedAgain) {
        queuedAgain = false;
        schedule();
      }
    }
  }

  function schedule() {
    const now = Date.now();
    if (!firstQueuedAt) firstQueuedAt = now;

    // Don't let a steady stream of edits postpone the push forever.
    if (now - firstQueuedAt >= PUSH_MAX_WAIT_MS) {
      if (timer) clearTimeout(timer);
      run();
      return;
    }

    if (timer) clearTimeout(timer);
    timer = setTimeout(run, PUSH_DEBOUNCE_MS);
  }

  function flushNow() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    return run();
  }

  return { schedule, flushNow, isPending: () => !!timer || inFlight };
}
