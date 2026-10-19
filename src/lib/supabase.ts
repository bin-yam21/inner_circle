import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client. Configured from Vite env vars (set in Railway → Variables,
 * or a local .env file):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *
 * When those are absent the app runs in "local mode": no sign-in is required
 * and all data stays in this browser (IndexedDB), exactly as before. As soon
 * as the keys are present, real email/password + Google auth is enforced.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    })
  : null;
