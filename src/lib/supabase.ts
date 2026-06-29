import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Two server-side Supabase clients with a deliberate separation of concerns:
 *
 * - `createUserClient(token)` — the **default** for feature services. It carries the
 *   caller's access token, so every query runs under their identity and Postgres
 *   **RLS (`auth.uid()`) enforces row ownership**. Created fresh per request.
 * - `getSupabaseAdmin()` — the service-role client that **bypasses RLS**. Reserve it
 *   for work that genuinely must cross the per-user boundary: JWT verification,
 *   cron jobs in `src/jobs/`, and future cross-user / admin / webhook tasks. Never
 *   expose this client or its key to the app.
 *
 * Rule of thumb: reach for `req.db` (the user client). Escalate to the admin client
 * only with a specific, reviewable reason.
 */
let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Supabase admin is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.',
    );
  }
  admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return admin;
}

/**
 * Per-request, RLS-enforced client bound to the caller's Supabase access token.
 * `requireAuth` attaches the result as `req.db`. Do not cache it — the token is
 * request-scoped.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase is not configured: set SUPABASE_URL and SUPABASE_ANON_KEY in the environment.',
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
