import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Server-side Supabase client using the **service-role key**. It bypasses RLS, so
 * every query in the services layer must scope rows by the authenticated user id
 * (taken from the validated JWT). Never expose this client or its key to the app.
 *
 * Created lazily so the skeleton still boots without credentials; the first call
 * fails loudly if the env vars are missing.
 */
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.',
    );
  }
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
