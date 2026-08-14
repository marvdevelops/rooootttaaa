import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — set them in .env.local.',
  );
}

// Browser-side client for pages that need a real auth session — unlike
// lib/supabase.ts (server-side, read-only, no session), this one persists
// the session and picks up recovery/confirmation tokens Supabase appends
// to the URL, which the password-reset flow depends on.
export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
});
