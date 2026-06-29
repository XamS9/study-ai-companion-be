import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../middleware/error.js';
import type { CreateExamInput, ExamQuestionInput, SubmitExamInput } from './exams.schema.js';

export type ExamDTO = {
  id: string;
  subjectId: string;
  name: string;
  date: string;
  score: number | null;
  correctCount: number | null;
  totalCount: number;
  timeElapsedSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ExamQuestionDTO = {
  id: string;
  prompt: string;
  type: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
  position: number;
};

export type ExamDetailDTO = ExamDTO & { questions: ExamQuestionDTO[] };

type ExamRow = {
  id: string;
  subject_id: string;
  name: string;
  date: string;
  score: number | null;
  correct_count: number | null;
  total_count: number;
  time_elapsed_seconds: number | null;
  created_at: string;
  updated_at: string;
};

type ExamQuestionRow = {
  id: string;
  prompt: string;
  type: string;
  options: string[];
  correct_answer: string;
  user_answer: string | null;
  is_correct: boolean | null;
  position: number;
};

export function mapExam(row: ExamRow): ExamDTO {
  return {
    id: row.id,
    subjectId: row.subject_id,
    name: row.name,
    date: row.date,
    score: row.score,
    correctCount: row.correct_count,
    totalCount: row.total_count,
    timeElapsedSeconds: row.time_elapsed_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExamQuestion(row: ExamQuestionRow): ExamQuestionDTO {
  return {
    id: row.id,
    prompt: row.prompt,
    type: row.type,
    options: row.options ?? [],
    correctAnswer: row.correct_answer,
    userAnswer: row.user_answer,
    isCorrect: row.is_correct,
    position: row.position,
  };
}

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

export async function listExams(db: SupabaseClient, userId: string): Promise<ExamDTO[]> {
  const { data, error } = await db
    .from('exams')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw new AppError(500, error.message);
  return (data as ExamRow[]).map(mapExam);
}

async function loadExamRow(db: SupabaseClient, userId: string, id: string): Promise<ExamRow> {
  const { data, error } = await db
    .from('exams')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Exam not found');
  return data as ExamRow;
}

async function loadExamQuestions(db: SupabaseClient, examId: string): Promise<ExamQuestionRow[]> {
  const { data, error } = await db
    .from('exam_questions')
    .select('*')
    .eq('exam_id', examId)
    .order('position', { ascending: true });
  if (error) throw new AppError(500, error.message);
  return data as ExamQuestionRow[];
}

export async function getExamDetail(
  db: SupabaseClient,
  userId: string,
  id: string,
): Promise<ExamDetailDTO> {
  const exam = await loadExamRow(db, userId, id);
  const questions = await loadExamQuestions(db, id);
  return { ...mapExam(exam), questions: questions.map(mapExamQuestion) };
}

/** Pulls up to `count` questions from the subject's bank in random order. */
async function pickFromBank(
  db: SupabaseClient,
  userId: string,
  subjectId: string,
  count: number,
): Promise<ExamQuestionInput[]> {
  const { data, error } = await db
    .from('questions')
    .select('prompt, type, options, correct_answer')
    .eq('user_id', userId)
    .eq('subject_id', subjectId);
  if (error) throw new AppError(500, error.message);
  const shuffled = [...(data ?? [])].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((q) => ({
    prompt: q.prompt as string,
    type: q.type as ExamQuestionInput['type'],
    options: (q.options as string[]) ?? [],
    correctAnswer: q.correct_answer as string,
  }));
}

export async function createExam(
  db: SupabaseClient,
  userId: string,
  input: CreateExamInput,
): Promise<ExamDetailDTO> {
  await assertSubjectOwned(db, userId, input.subjectId);

  const questions =
    input.questions && input.questions.length > 0
      ? input.questions
      : await pickFromBank(db, userId, input.subjectId, input.questionCount);

  if (questions.length === 0) {
    throw new AppError(
      422,
      'No questions available — add questions to the subject or generate them first.',
    );
  }

  const { data: exam, error: examError } = await db
    .from('exams')
    .insert({
      user_id: userId,
      subject_id: input.subjectId,
      name: input.name,
      date: input.date ?? new Date().toISOString(),
      total_count: questions.length,
    })
    .select('*')
    .single();
  if (examError) throw new AppError(500, examError.message);

  const rows = questions.map((q, position) => ({
    exam_id: (exam as ExamRow).id,
    prompt: q.prompt,
    type: q.type,
    options: q.options,
    correct_answer: q.correctAnswer,
    position,
  }));
  const { error: qError } = await db.from('exam_questions').insert(rows);
  if (qError) throw new AppError(500, qError.message);

  return getExamDetail(db, userId, (exam as ExamRow).id);
}

const normalize = (s: string) => s.trim().toLowerCase();

export async function submitExam(
  db: SupabaseClient,
  userId: string,
  id: string,
  input: SubmitExamInput,
): Promise<ExamDetailDTO> {
  await loadExamRow(db, userId, id); // ownership check
  const questions = await loadExamQuestions(db, id);
  const answerById = new Map(input.answers.map((a) => [a.examQuestionId, a.answer]));

  let correct = 0;
  for (const q of questions) {
    const given = answerById.get(q.id);
    const isCorrect = given !== undefined && normalize(given) === normalize(q.correct_answer);
    if (isCorrect) correct += 1;
    const { error } = await db
      .from('exam_questions')
      .update({ user_answer: given ?? null, is_correct: isCorrect })
      .eq('id', q.id);
    if (error) throw new AppError(500, error.message);
  }

  const total = questions.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const { error: updateError } = await db
    .from('exams')
    .update({
      score,
      correct_count: correct,
      time_elapsed_seconds: input.timeElapsedSeconds ?? null,
      date: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('id', id);
  if (updateError) throw new AppError(500, updateError.message);

  return getExamDetail(db, userId, id);
}

export async function deleteExam(db: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error, count } = await db
    .from('exams')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw new AppError(500, error.message);
  if (!count) throw new AppError(404, 'Exam not found');
}
