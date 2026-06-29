import type { SupabaseClient, User } from '@supabase/supabase-js';

// Augment Express' Request with the authenticated user and the per-request,
// RLS-enforced Supabase client, both populated by `requireAuth`.
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
      /** RLS-enforced Supabase client bound to the caller's JWT. Default for services. */
      db?: SupabaseClient;
    }
  }
}

export {};
