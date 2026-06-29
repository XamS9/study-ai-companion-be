import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getOpenAI, OPENAI_MODEL } from '../../lib/openai.js';
import { AppError } from '../../middleware/error.js';
import { examQuestionInputSchema, type ExamQuestionInput } from '../exams/exams.schema.js';
import { getMaterial } from '../materials/materials.service.js';
import type {
  GenerateFlashcardsInput,
  GenerateQuestionsInput,
  ProcessMaterialInput,
  SummarizeInput,
} from './ai.schema.js';

export type Flashcard = { front: string; back: string };

async function assertSubjectOwned(
  db: SupabaseClient,
  userId: string,
  subjectId: string,
): Promise<void> {
  const { data, error } = await db
    .from('subjects')
    .select('id')
    .eq('user_id', userId)
    .eq('id', subjectId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Subject not found');
}

/** Resolves source text from an explicit string or a stored material's content. */
async function resolveText(
  db: SupabaseClient,
  userId: string,
  materialId: string | undefined,
  text: string | undefined,
): Promise<string> {
  if (text && text.trim()) return text;
  if (materialId) {
    const material = await getMaterial(db, userId, materialId);
    if (material.content && material.content.trim()) return material.content;
  }
  throw new AppError(422, 'No source text available to process');
}

const questionsResponseSchema = z.object({ questions: z.array(examQuestionInputSchema) });

/** Source text longer than this is truncated before being sent to the model. */
const MAX_SOURCE_CHARS = 100_000;

/** Runs the question-generation model over `source` and returns up to `count` validated questions. */
async function callQuestionModel(
  openai: NonNullable<ReturnType<typeof getOpenAI>>,
  source: string,
  count: number,
): Promise<ExamQuestionInput[]> {
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You generate study exam questions from provided material. Respond ONLY with JSON ' +
          'of the form {"questions":[{"prompt":string,"type":"multiple_choice"|"true_false",' +
          '"options":string[],"correctAnswer":string}]}. For multiple_choice include 4 options ' +
          'and set correctAnswer to one of them. For true_false use options ["True","False"] ' +
          'and correctAnswer "True" or "False"; phrase the prompt as a plain declarative ' +
          'statement and do NOT prefix it with "True or False:" or similar (the UI already ' +
          'labels it). Write questions in the same language as the source.',
      },
      {
        role: 'user',
        content: `Generate ${count} questions from this material:\n\n${source}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new AppError(502, 'AI returned an empty response');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(502, 'AI returned malformed JSON');
  }
  const result = questionsResponseSchema.safeParse(parsed);
  if (!result.success) throw new AppError(502, 'AI response did not match the expected shape');
  return result.data.questions.slice(0, count);
}

export async function generateQuestions(
  db: SupabaseClient,
  userId: string,
  input: GenerateQuestionsInput,
): Promise<ExamQuestionInput[]> {
  const openai = getOpenAI();
  if (!openai) throw new AppError(503, 'AI is not configured (missing OPENAI_API_KEY)');

  await assertSubjectOwned(db, userId, input.subjectId);
  const source = await resolveText(db, userId, input.materialId, input.sourceText);
  const questions = await callQuestionModel(openai, source, input.count);

  if (input.persist && questions.length > 0) {
    const rows = questions.map((q) => ({
      user_id: userId,
      subject_id: input.subjectId,
      material_id: input.materialId ?? null,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      correct_answer: q.correctAnswer,
    }));
    const { error } = await db.from('questions').insert(rows);
    if (error) throw new AppError(500, error.message);
  }

  return questions;
}

/**
 * Regenerates a subject's question bank: builds source text from the subject's
 * materials' content, asks the model for a fresh set, then **replaces** the bank
 * (deletes the subject's existing questions and inserts the new ones). The model is
 * called before any deletion, so an AI failure leaves the current bank intact.
 * Throws 422 when the subject has no material text to work from.
 */
export async function regenerateSubjectQuestions(
  db: SupabaseClient,
  userId: string,
  subjectId: string,
  count: number,
): Promise<ExamQuestionInput[]> {
  const openai = getOpenAI();
  if (!openai) throw new AppError(503, 'AI is not configured (missing OPENAI_API_KEY)');

  await assertSubjectOwned(db, userId, subjectId);

  const { data: materials, error: matError } = await db
    .from('materials')
    .select('content')
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .not('content', 'is', null)
    .order('created_at', { ascending: true });
  if (matError) throw new AppError(500, matError.message);

  const source = (materials ?? [])
    .map((m) => (m.content as string | null)?.trim())
    .filter((c): c is string => !!c)
    .join('\n\n')
    .slice(0, MAX_SOURCE_CHARS);
  if (!source) {
    throw new AppError(
      422,
      'No material content to generate questions from — add a material with text first.',
    );
  }

  const questions = await callQuestionModel(openai, source, count);
  if (questions.length === 0) throw new AppError(502, 'AI returned no questions');

  // Replace the bank. (Past exams keep their own snapshot in exam_questions.)
  const { error: delError } = await db
    .from('questions')
    .delete()
    .eq('user_id', userId)
    .eq('subject_id', subjectId);
  if (delError) throw new AppError(500, delError.message);

  const rows = questions.map((q) => ({
    user_id: userId,
    subject_id: subjectId,
    material_id: null,
    prompt: q.prompt,
    type: q.type,
    options: q.options,
    correct_answer: q.correctAnswer,
  }));
  const { error: insError } = await db.from('questions').insert(rows);
  if (insError) throw new AppError(500, insError.message);

  return questions;
}

export async function summarize(
  db: SupabaseClient,
  userId: string,
  input: SummarizeInput,
): Promise<{ summary: string }> {
  const openai = getOpenAI();
  if (!openai) throw new AppError(503, 'AI is not configured (missing OPENAI_API_KEY)');

  const source = await resolveText(db, userId, input.materialId, input.text);

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'You summarize study material into a concise study summary (key ideas, a few bullet ' +
          'points). Reply in the same language as the source, plain text only.',
      },
      { role: 'user', content: source },
    ],
  });

  const summary = completion.choices[0]?.message?.content?.trim();
  if (!summary) throw new AppError(502, 'AI returned an empty response');

  if (input.persist && input.materialId) {
    const { error } = await db
      .from('materials')
      .update({ summary })
      .eq('user_id', userId)
      .eq('id', input.materialId);
    if (error) throw new AppError(500, error.message);
  }

  return { summary };
}

const flashcardSchema = z.object({ front: z.string().min(1), back: z.string().min(1) });
const flashcardsResponseSchema = z.object({ flashcards: z.array(flashcardSchema) });

async function persistFlashcards(
  db: SupabaseClient,
  userId: string,
  subjectId: string,
  materialId: string,
  cards: Flashcard[],
): Promise<void> {
  // Replace any previous set so re-generating doesn't duplicate.
  const { error: delError } = await db
    .from('flashcards')
    .delete()
    .eq('user_id', userId)
    .eq('material_id', materialId);
  if (delError) throw new AppError(500, delError.message);
  if (cards.length === 0) return;
  const rows = cards.map((c) => ({
    user_id: userId,
    subject_id: subjectId,
    material_id: materialId,
    front: c.front,
    back: c.back,
  }));
  const { error } = await db.from('flashcards').insert(rows);
  if (error) throw new AppError(500, error.message);
}

export async function generateFlashcards(
  db: SupabaseClient,
  userId: string,
  input: GenerateFlashcardsInput,
): Promise<Flashcard[]> {
  const openai = getOpenAI();
  if (!openai) throw new AppError(503, 'AI is not configured (missing OPENAI_API_KEY)');

  await assertSubjectOwned(db, userId, input.subjectId);
  const source = await resolveText(db, userId, input.materialId, input.sourceText);

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You create study flashcards from provided material. Respond ONLY with JSON of the ' +
          'form {"flashcards":[{"front":string,"back":string}]}. Front is a concept/term/question, ' +
          'back is the concise answer/definition. Use the same language as the source.',
      },
      { role: 'user', content: `Create ${input.count} flashcards from this material:\n\n${source}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new AppError(502, 'AI returned an empty response');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(502, 'AI returned malformed JSON');
  }
  const result = flashcardsResponseSchema.safeParse(parsed);
  if (!result.success) throw new AppError(502, 'AI response did not match the expected shape');
  const flashcards = result.data.flashcards.slice(0, input.count);

  if (input.persist && input.materialId) {
    await persistFlashcards(db, userId, input.subjectId, input.materialId, flashcards);
  }
  return flashcards;
}

const studyAidsSchema = z.object({
  summary: z.string(),
  keyConcepts: z.array(z.string()).default([]),
  flashcards: z.array(flashcardSchema).default([]),
});

export type ProcessMaterialResult = {
  summary: string;
  keyConcepts: string[];
  flashcardsCount: number;
  questionsCount: number;
};

/** One-shot "AI processing": summary + key concepts + flashcards + question bank. */
export async function processMaterial(
  db: SupabaseClient,
  userId: string,
  input: ProcessMaterialInput,
): Promise<ProcessMaterialResult> {
  const openai = getOpenAI();
  if (!openai) throw new AppError(503, 'AI is not configured (missing OPENAI_API_KEY)');

  const material = await getMaterial(db, userId, input.materialId);
  const source = material.content?.trim();
  if (!source) throw new AppError(422, 'Material has no content to process');

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You create study aids from material. Respond ONLY with JSON of the form ' +
          '{"summary":string,"keyConcepts":string[],"flashcards":[{"front":string,"back":string}]}. ' +
          `Provide a concise summary, a list of key concepts, and ${input.flashcardCount} flashcards. ` +
          'Use the same language as the source.',
      },
      { role: 'user', content: source },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new AppError(502, 'AI returned an empty response');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(502, 'AI returned malformed JSON');
  }
  const result = studyAidsSchema.safeParse(parsed);
  if (!result.success) throw new AppError(502, 'AI response did not match the expected shape');
  const { summary, keyConcepts } = result.data;
  const flashcards = result.data.flashcards.slice(0, input.flashcardCount);

  const { error: updateError } = await db
    .from('materials')
    .update({ summary, key_concepts: keyConcepts })
    .eq('user_id', userId)
    .eq('id', material.id);
  if (updateError) throw new AppError(500, updateError.message);

  await persistFlashcards(db, userId, material.subjectId, material.id, flashcards);

  const questions = await generateQuestions(db, userId, {
    subjectId: material.subjectId,
    materialId: material.id,
    count: input.questionCount,
    sourceText: source,
    persist: true,
  });

  return {
    summary,
    keyConcepts,
    flashcardsCount: flashcards.length,
    questionsCount: questions.length,
  };
}
