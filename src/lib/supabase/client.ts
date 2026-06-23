import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ENABLED } from '../../config/env';

/**
 * The Supabase client, or null when Supabase is not configured. The app runs
 * fully without it (local first, MOCK_MODE), so every caller must handle null
 * (section 5, 13). The anon key is safe to expose because row level security
 * restricts every row to its owner.
 *
 * PKCE flow and detectSessionInUrl handle the magic link redirect automatically.
 */
export const supabase: SupabaseClient | null = SUPABASE_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

export const isSupabaseEnabled = SUPABASE_ENABLED;
