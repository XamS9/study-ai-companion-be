import { z } from 'zod';

export const generateQuestionsSchema = z
  .object({
    subjectId: z.string().uuid(),
    materialId: z.string().uuid().optional(),
    count: z.number().int().min(1).max(20).default(5),
    sourceText: z.string().max(100_000).optional(),
    persist: z.boolean().default(true),
  })
  .refine((v) => v.materialId || v.sourceText, {
    message: 'Provide either materialId or sourceText',
  });

export const summarizeSchema = z
  .object({
    materialId: z.string().uuid().optional(),
    text: z.string().max(100_000).optional(),
    persist: z.boolean().default(false),
  })
  .refine((v) => v.materialId || v.text, {
    message: 'Provide either materialId or text',
  });

export const generateFlashcardsSchema = z
  .object({
    subjectId: z.string().uuid(),
    materialId: z.string().uuid().optional(),
    count: z.number().int().min(1).max(30).default(8),
    sourceText: z.string().max(100_000).optional(),
    persist: z.boolean().default(true),
  })
  .refine((v) => v.materialId || v.sourceText, {
    message: 'Provide either materialId or sourceText',
  });

export const processMaterialSchema = z.object({
  materialId: z.string().uuid(),
  questionCount: z.number().int().min(1).max(20).default(8),
  flashcardCount: z.number().int().min(1).max(30).default(8),
});

export type GenerateQuestionsInput = z.infer<typeof generateQuestionsSchema>;
export type SummarizeInput = z.infer<typeof summarizeSchema>;
export type GenerateFlashcardsInput = z.infer<typeof generateFlashcardsSchema>;
export type ProcessMaterialInput = z.infer<typeof processMaterialSchema>;
