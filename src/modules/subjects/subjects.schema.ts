import { z } from 'zod';

export const SUBJECT_COLORS = ['primary', 'accent', 'warning', 'error', 'success'] as const;

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(40).optional(),
  description: z.string().trim().max(1000).optional(),
  color: z.enum(SUBJECT_COLORS).default('primary'),
  progress: z.number().int().min(0).max(100).optional(),
});

export const updateSubjectSchema = createSubjectSchema.partial();

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
