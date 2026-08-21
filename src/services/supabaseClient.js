// src/services/supabaseClient.js
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
