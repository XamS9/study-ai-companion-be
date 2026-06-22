import { z } from 'zod';

export const QUESTION_TYPES = ['multiple_choice', 'true_false'] as const;

export const examQuestionInputSchema = z.object({
  prompt: z.string().trim().min(1),
  type: z.enum(QUESTION_TYPES),
  options: z.array(z.string()).default([]),
  correctAnswer: z.string().trim().min(1),
});

export const createExamSchema = z.object({
  subjectId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  date: z.string().datetime().optional(),
  questionCount: z.number().int().min(1).max(50).default(10),
  // Optional explicit questions (e.g. freshly AI-generated). When omitted, the
  // exam is filled from the subject's stored question bank.
  questions: z.array(examQuestionInputSchema).optional(),
});

export const submitExamSchema = z.object({
  timeElapsedSeconds: z.number().int().min(0).optional(),
  answers: z
    .array(
      z.object({
        examQuestionId: z.string().uuid(),
        answer: z.string(),
      }),
    )
    .min(1),
});

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type SubmitExamInput = z.infer<typeof submitExamSchema>;
export type ExamQuestionInput = z.infer<typeof examQuestionInputSchema>;
