import { getSupabaseAdmin } from '../../lib/supabase.js';
import { AppError } from '../../middleware/error.js';
import type { UpdateProfileInput } from './profile.schema.js';

/**
 * Profile shape returned to the client. Deliberately snake_case (unlike the other
 * camelCase DTOs) to mirror `public.profiles` and the shape the app also reads
 * directly from Supabase during session bootstrap — so one `Profile` type serves
 * both the direct-read and the API-write paths without a lossy remap.
 *
 * NOTE: this module intentionally uses the service-role admin client, not the
 * per-request `req.db`. `public.profiles` is managed alongside `auth.users` and its
 * RLS policies aren't defined in this repo's migrations (the app only reads it
 * directly), so writes go through the trusted backend rather than relying on a
 * user-scoped UPDATE policy. Every query here is still scoped by `id = userId`.
 */
export type ProfileDTO = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  theme: string;
  language: string;
};

const COLUMNS = 'id, full_name, avatar_url, theme, language';

export async function getProfile(userId: string): Promise<ProfileDTO> {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select(COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Profile not found');
  return data as ProfileDTO;
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<ProfileDTO> {
  const patch: Record<string, unknown> = {};
  if (input.full_name !== undefined) patch.full_name = input.full_name;
  if (input.avatar_url !== undefined) patch.avatar_url = input.avatar_url;
  if (input.theme !== undefined) patch.theme = input.theme;
  if (input.language !== undefined) patch.language = input.language;
  if (Object.keys(patch).length === 0) return getProfile(userId);

  patch.updated_at = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Profile not found');
  return data as ProfileDTO;
}
