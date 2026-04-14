// Supabase browser client (env-driven). Auth session uses localStorage for persistence across tabs.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Must match `auth.storageKey` below — used to clear persisted session without calling `/logout`. */
export const PERLEAP_AUTH_STORAGE_KEY = 'perleap-auth';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // Need this for OAuth callbacks and email confirmations
      storageKey: PERLEAP_AUTH_STORAGE_KEY, // Custom storage key to prevent multi-tab conflicts
      flowType: 'pkce', // Use PKCE flow for better security
    },
    global: {
      headers: {
        'X-Client-Info': 'perleap-web',
      },
    },
  }
);
