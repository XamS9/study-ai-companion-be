import { z } from 'zod';

export const updateProfileSchema = z.object({
  full_name: z.string().trim().max(120).nullable().optional(),
  avatar_url: z.string().trim().max(500).nullable().optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  language: z.enum(['en', 'es']).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
