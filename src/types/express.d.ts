import type { User } from '@supabase/supabase-js';

// Augment Express' Request with the authenticated user populated by `requireAuth`.
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

export {};
