import type { RequestHandler } from 'express';
import { createUserClient, getSupabaseAdmin } from '../lib/supabase.js';
import { AppError } from './error.js';

/**
 * Validates the `Authorization: Bearer <jwt>` header against Supabase Auth and
 * attaches the user to the request. The token is the Supabase access token the
 * mobile client already sends (see the app's `apiFetch`).
 *
 * On success it also binds a per-request, RLS-enforced Supabase client to the same
 * token as `req.db`. Feature services use `req.db` so Postgres RLS enforces row
 * ownership; only privileged paths fall back to the service-role admin client.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError(401, 'Missing bearer token');

    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data.user) throw new AppError(401, 'Invalid or expired token');

    req.user = data.user;
    req.userId = data.user.id;
    req.db = createUserClient(token);
    next();
  } catch (err) {
    next(err);
  }
};
