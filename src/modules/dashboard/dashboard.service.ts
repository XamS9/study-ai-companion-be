import { getSupabaseAdmin } from '../../lib/supabase.js';
import { AppError } from '../../middleware/error.js';

export type DashboardDTO = {
  subjectsCount: number;
  materialsCount: number;
  examsTaken: number;
  averageScore: number | null;
  lastExam: { id: string; name: string; subject: string | null; score: number; date: string } | null;
};

async function countRows(table: string, userId: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new AppError(500, error.message);
  return count ?? 0;
}

export async function getDashboard(userId: string): Promise<DashboardDTO> {
  const db = getSupabaseAdmin();
  const [subjectsCount, materialsCount] = await Promise.all([
    countRows('subjects', userId),
    countRows('materials', userId),
  ]);

  const { data: taken, error: takenError } = await db
    .from('exams')
    .select('id, name, score, date, subjects(name)')
    .eq('user_id', userId)
    .not('score', 'is', null)
    .order('date', { ascending: false });
  if (takenError) throw new AppError(500, takenError.message);

  const scores = (taken ?? []).map((e) => e.score as number);
  const averageScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const latest = taken?.[0];
  const lastExam = latest
    ? {
        id: latest.id as string,
        name: latest.name as string,
        subject:
          (latest.subjects as { name: string } | { name: string }[] | null) == null
            ? null
            : Array.isArray(latest.subjects)
              ? (latest.subjects[0]?.name ?? null)
              : (latest.subjects as { name: string }).name,
        score: latest.score as number,
        date: latest.date as string,
      }
    : null;

  return {
    subjectsCount,
    materialsCount,
    examsTaken: scores.length,
    averageScore,
    lastExam,
  };
}
