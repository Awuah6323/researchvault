// src/services/syncClient.js - Network sync engine backed by Supabase
import { supabase, isSupabaseConfigured, VAULT_TABLE } from './supabaseClient';

const PUSH_DEBOUNCE_MS = 2000;
const PUSH_MAX_WAIT_MS = 10000;

/** The stored session is gone or rejected — sign in again. */
export class AuthExpiredError extends Error {
  constructor(message) {
    super(message || 'Your session has expired. Please sign in again.');
    this.name = 'AuthExpiredError';
  }
}

/**
 * Supabase could not be reached, or this build has no credentials.
 */
export class BackendUnavailableError extends Error {
  constructor(message) {
    super(message || 'Sync service unreachable');
    this.name = 'BackendUnavailableError';
  }
}

/**
 * Supabase refused to send an auth email.
 *
 * This is a PROJECT-WIDE quota, not a per-person one: the built-in SMTP service
 * allows only a couple of messages an hour across all users, and re-signing up
 * with an address that already has an unconfirmed account triggers a further
 * 60-second resend cooldown. Both arrive as the same 429, which is why a first
 * signup can be refused for something the person did not do.
 */
export class EmailRateLimitError extends Error {
  constructor(message, retryAfterSeconds) {
    super(message || 'Confirmation email could not be sent right now.');
    this.name = 'EmailRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds || 0;
  }
}

function isEmailRateLimit(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return (
    code === 'over_email_send_rate_limit' ||
    (Number(error?.status || 0) === 429 && /email|security purposes|rate limit/i.test(message))
  );
}

function classifyError(error) {
  if (!error) return null;

  const name = error.name || '';
  const message = String(error.message || '');
  const status = Number(error.status || 0);

  if (isEmailRateLimit(error)) {
    const wait = /after (\d+) seconds?/i.exec(message);
    return new EmailRateLimitError(message, wait ? Number(wait[1]) : 0);
  }

  if (
    name === 'AuthRetryableFetchError' ||
    name === 'TypeError' ||
    /failed to fetch|networkerror|load failed|fetch failed/i.test(message) ||
    status === 0 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return new BackendUnavailableError();
  }

  if (status === 401) return new AuthExpiredError();

  return error;
}

function requireBackend() {
  if (!isSupabaseConfigured() || !supabase) throw new BackendUnavailableError();
}

let cachedSession = null;
let sessionReady = false;

export function isSyncConfigured() {
  return isSupabaseConfigured();
}

/** Current user id, or null. Synchronous. */
export function getCurrentUserId() {
  return cachedSession?.user?.id || null;
}

/** True when a real Supabase session is held. Synchronous. */
export function hasSyncSession() {
  return !!(cachedSession && cachedSession.user);
}

/** True once the initial session lookup has finished. */
export function isSessionReady() {
  return sessionReady;
}

/**
 * A fresh access token for calling this app's own /api endpoints.
 *
 * getSession() is asked rather than reading cachedSession.access_token, because
 * the cached copy can be minutes old and an access token is short-lived by
 * design. The Supabase client refreshes it here if it is close to expiring, so
 * a long reading session does not start getting 401s from the AI proxy while
 * the app itself still looks signed in.
 *
 * Returns null when there is no session — the caller decides what that means.
 */
export async function getAccessToken() {
  if (!isSupabaseConfigured() || !supabase) return null;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    if (data?.session) cachedSession = data.session;
    return data?.session?.access_token || null;
  } catch (e) {
    return null;
  }
}

/**
 * Shapes a Supabase user into the profile the rest of the app already expects.
 * The extra fields live in user_metadata, set at signup, so no profiles table
 * is needed for them.
 */
export function mapUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    email: String(user.email || '').toLowerCase().trim(),
    name: meta.name || meta.full_name || String(user.email || '').split('@')[0],
    institution: meta.institution || 'University / Institution',
    fieldOfStudy: meta.fieldOfStudy || meta.field_of_study || 'General Research',
    researchInterests: meta.researchInterests || 'Academic Literature, Data Analysis',
    createdAt: user.created_at || new Date().toISOString()
  };
}

/**
 * Loads any stored session and starts watching for changes.
 *
 * `onEvent(eventName, user)` fires for SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
 * and PASSWORD_RECOVERY. The Google redirect and the password-reset link both
 * arrive as one of these, which is why the app hydrates from this rather than
 * from the return value of a sign-in call.
 *
 * Returns an unsubscribe function.
 */
export async function initSyncSession(onEvent) {
  if (!isSupabaseConfigured() || !supabase) {
    sessionReady = true;
    return () => {};
  }

  try {
    const { data } = await supabase.auth.getSession();
    cachedSession = data?.session || null;
  } catch (e) {
    cachedSession = null;
  }
  sessionReady = true;

  const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
    cachedSession = session || null;
    if (typeof onEvent === 'function') {
      try {
        onEvent(event, mapUser(session?.user));
      } catch (e) {
        /* a listener must not break auth */
      }
    }
  });

  // Report the session that already existed, so a returning user is restored.
  if (cachedSession && typeof onEvent === 'function') {
    try {
      onEvent('INITIAL_SESSION', mapUser(cachedSession.user));
    } catch (e) {
      /* ignore */
    }
  }

  return () => {
    try {
      sub?.subscription?.unsubscribe();
    } catch (e) {
      /* ignore */
    }
  };
}

// --------------------------------------------------------------------- AUTH

export async function apiRegister({ name, email, password, institution, fieldOfStudy }) {
  requireBackend();

  const { data, error } = await supabase.auth.signUp({
    email: String(email || '').toLowerCase().trim(),
    password,
    options: {
      // Stored on the auth user, so there is no second table to keep in step.
      data: {
        name: String(name || '').trim(),
        institution: institution || 'University / Institution',
        fieldOfStudy: fieldOfStudy || 'General Research'
      },
      emailRedirectTo: `${window.location.origin}/`
    }
  });

  if (error) {
    const classified = classifyError(error);

    // A refused confirmation email does not mean the account is unusable. The
    // same 429 covers "the project's hourly email quota is spent" and "this
    // address already signed up moments ago", and in both cases the account may
    // already exist. Trying the credentials settles it, so a first-time signup
    // is not turned away over a mail-server limit it had no part in.
    if (classified instanceof EmailRateLimitError) {
      const probe = await supabase.auth.signInWithPassword({
        email: String(email || '').toLowerCase().trim(),
        password
      });

      if (probe.data?.session) {
        cachedSession = probe.data.session;
        return { user: mapUser(probe.data.user), needsEmailConfirmation: false };
      }

      // Credentials accepted but unconfirmed: the account exists and its link
      // was already sent, so say that rather than blaming the person for
      // "too many attempts".
      if (/email not confirmed/i.test(String(probe.error?.message || ''))) {
        classified.accountAlreadyExists = true;
      }
    }

    throw classified;
  }

  // With email confirmation on (Supabase's default) signUp succeeds but returns
  // no session — the account is not usable until the link is clicked. Saying so
  // is much better than appearing to work and then failing to sync.
  if (!data.session) {
    return {
      user: mapUser(data.user),
      needsEmailConfirmation: true
    };
  }

  cachedSession = data.session;
  return { user: mapUser(data.user), needsEmailConfirmation: false };
}

export async function apiLogin({ email, password }) {
  requireBackend();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || '').toLowerCase().trim(),
    password
  });

  if (error) {
    const classified = classifyError(error);
    // A 400 here means the credentials were rejected. Surface it as an ordinary
    // failure rather than an expired session, which would trigger a sign-out.
    if (classified instanceof AuthExpiredError) {
      throw new Error('Invalid email address or password.');
    }
    throw classified;
  }

  cachedSession = data.session;
  return { user: mapUser(data.user) };
}

/**
 * Starts Google sign-in.
 *
 * Unlike the rest of these, this does not resolve with a user: it navigates the
 * browser to Google. The session arrives after the redirect back, via the
 * SIGNED_IN event from initSyncSession(). Verification is Supabase's job now —
 * the browser never inspects the token itself, which is how an earlier version
 * of this app let anyone sign in as anyone by typing their address.
 */
export async function startGoogleSignIn() {
  requireBackend();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: { prompt: 'select_account' }
    }
  });

  if (error) throw classifyError(error);
}

/** Sends a reset link. Resolves the same way whether or not the email exists. */
export async function apiRequestPasswordReset(email) {
  requireBackend();

  const { error } = await supabase.auth.resetPasswordForEmail(
    String(email || '').toLowerCase().trim(),
    { redirectTo: `${window.location.origin}/` }
  );

  if (error) throw classifyError(error);
}

/** Sets a new password. Requires the recovery session from the emailed link. */
export async function apiUpdatePassword(newPassword) {
  requireBackend();

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw classifyError(error);
}

/** Updates the profile fields kept on the auth user. */
export async function apiUpdateProfile({ name, institution, fieldOfStudy, researchInterests }) {
  requireBackend();

  const { error } = await supabase.auth.updateUser({
    data: { name, institution, fieldOfStudy, researchInterests }
  });
  if (error) throw classifyError(error);
}

export async function apiLogout() {
  try {
    if (supabase) await supabase.auth.signOut();
  } catch (e) {
    /* leaving locally matters more than the server acknowledging it */
  }
  cachedSession = null;
}

// --------------------------------------------------------------------- SYNC

function requireSession() {
  requireBackend();
  const uid = getCurrentUserId();
  if (!uid) throw new AuthExpiredError();
  return uid;
}

/** Cheap poll. Returns { version, updatedAt } and nothing else. */
export async function fetchRemoteVersion() {
  const uid = requireSession();

  const { data, error } = await supabase
    .from(VAULT_TABLE)
    .select('version, updated_at')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) throw classifyError(error);
  if (!data) return { version: 0, updatedAt: null };

  return { version: data.version || 0, updatedAt: data.updated_at || null, durable: true };
}

export async function fetchRemoteVault() {
  const uid = requireSession();

  const { data, error } = await supabase
    .from(VAULT_TABLE)
    .select('vault, version, updated_at')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) throw classifyError(error);
  if (!data) return { version: 0, updatedAt: null, vault: null, durable: true };

  return {
    version: data.version || 0,
    updatedAt: data.updated_at || null,
    vault: data.vault || null,
    durable: true
  };
}

/**
 * Commits a vault, refusing to overwrite a newer one.
 *
 * The UPDATE is filtered on the version we read, so Postgres itself rejects a
 * stale write: matching zero rows means another device committed in between.
 * That is the whole conflict detection — one statement, no transaction, no
 * locking, and impossible to race.
 *
 * Resolves to:
 *   { status: 'ok', version }
 *   { status: 'conflict', version, vault }   caller merges and retries
 *   { status: 'failed', error }
 */
export async function pushRemoteVault({ vault, baseVersion }) {
  const uid = requireSession();
  const base = Number(baseVersion) || 0;
  const updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from(VAULT_TABLE)
    .update({ vault, version: base + 1, updated_at: updatedAt })
    .eq('user_id', uid)
    .eq('version', base)
    .select('version, updated_at');

  if (error) {
    const classified = classifyError(error);
    if (classified instanceof BackendUnavailableError || classified instanceof AuthExpiredError) {
      throw classified;
    }
    return { status: 'failed', error: classified.message || 'Sync failed' };
  }

  if (data && data.length) {
    return { status: 'ok', version: data[0].version, updatedAt: data[0].updated_at, durable: true };
  }

  // Zero rows updated. Either someone else wrote first, or this account has no
  // vault row yet (an account created before the schema was installed).
  const remote = await fetchRemoteVault();

  if (!remote || remote.version === 0) {
    const { data: inserted, error: insertError } = await supabase
      .from(VAULT_TABLE)
      .upsert(
        { user_id: uid, vault, version: 1, updated_at: updatedAt },
        { onConflict: 'user_id' }
      )
      .select('version, updated_at');

    if (insertError) {
      const classified = classifyError(insertError);
      if (classified instanceof BackendUnavailableError) throw classified;
      return { status: 'failed', error: classified.message || 'Sync failed' };
    }
    if (inserted && inserted.length) {
      return { status: 'ok', version: inserted[0].version, updatedAt: inserted[0].updated_at, durable: true };
    }
  }

  return { status: 'conflict', version: remote.version, vault: remote.vault };
}

// ----------------------------------------------------------------- REALTIME

let vaultChannel = null;

/**
 * Notifies this device when another one commits.
 *
 * `onRemoteChange(version)` receives the new version number. The vault itself
 * is not taken from the event: storage.js compares the version against what it
 * last synced, which also means our own write echoing back costs nothing.
 *
 * Realtime honours the RLS policies, so this only ever delivers our own row.
 */
export function subscribeToVaultChanges(onRemoteChange) {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  const uid = getCurrentUserId();
  if (!uid) return () => {};

  unsubscribeFromVaultChanges();

  vaultChannel = supabase
    .channel(`vault-changes-${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: VAULT_TABLE,
        filter: `user_id=eq.${uid}`
      },
      (payload) => {
        const version = Number(payload?.new?.version) || 0;
        try {
          onRemoteChange(version);
        } catch (e) {
          /* a listener must not kill the subscription */
        }
      }
    )
    .subscribe();

  return unsubscribeFromVaultChanges;
}

export function unsubscribeFromVaultChanges() {
  if (!vaultChannel) return;
  try {
    supabase.removeChannel(vaultChannel);
  } catch (e) {
    /* ignore */
  }
  vaultChannel = null;
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
