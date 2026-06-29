import { z } from 'zod';

export const MATERIAL_TYPES = ['pdf', 'image', 'note'] as const;

export const createMaterialSchema = z
  .object({
    subjectId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    type: z.enum(MATERIAL_TYPES),
    pages: z.number().int().positive().nullable().optional(),
    content: z.string().min(1).max(100_000).optional(),
    fileUrl: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== 'pdf' && !data.content) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'content is required for note and image materials',
        path: ['content'],
      });
    }
  });

export const updateMaterialSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    type: z.enum(MATERIAL_TYPES),
    pages: z.number().int().positive().nullable(),
    content: z.string().max(100_000),
    summary: z.string().max(100_000),
    fileUrl: z.string().url(),
  })
  .partial();

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
