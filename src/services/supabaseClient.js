// src/services/supabaseClient.js
// The one place a Supabase client is created.
//
// Both values below are PUBLIC by design — the anon key is meant to ship in the
// browser bundle. It is not a password: on its own it grants nothing, because
// every table is behind Row Level Security that filters on auth.uid() from the
// caller's verified JWT (see supabase/schema.sql). The key identifies the
// project; the JWT identifies the person.
//
// If the two variables are absent the app does NOT crash and does NOT show an
// error. It runs in local-only mode: localStorage still works, the library still
// works, and the sync badge says "This device only". That keeps `npm run dev`
// usable with no credentials at all, and it means a misconfigured deploy
// degrades instead of breaking.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

/** True when this build has Supabase credentials and sync can work at all. */
export function isSupabaseConfigured() {
  return configured;
}

export const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Keep the session in localStorage and refresh it in the background, so
        // a returning user is still signed in and a long reading session does
        // not expire mid-edit.
        persistSession: true,
        autoRefreshToken: true,
        // Needed for the Google redirect: the session arrives in the URL
        // fragment when Google sends the browser back here.
        detectSessionInUrl: true,
        flowType: 'pkce'
      },
      realtime: {
        // One vault row per user; there is nothing to burst about.
        params: { eventsPerSecond: 2 }
      },
      global: {
        headers: { 'x-application-name': 'researchvault' }
      }
    })
  : null;

/**
 * The table holding each user's library snapshot. Named once here so a rename
 * is a one-line change rather than a search across the codebase.
 */
export const VAULT_TABLE = 'vaults';
