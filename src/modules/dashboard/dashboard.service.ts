import { getSupabaseAdmin } from '../../lib/supabase.js';
import { AppError } from '../../middleware/error.js';

export type DashboardDTO = {
  subjectsCount: number;
  materialsCount: number;
  examsTaken: number;
  averageScore: number | null;
  lastExam: { id: string; name: string; subject: string | null; score: number; date: string } | null;
};

export type ActivityType = 'exam' | 'material' | 'subject';

export type ActivityDTO = {
  /** Unique across types, e.g. `exam:<uuid>` — rows from different tables can share a uuid. */
  id: string;
  type: ActivityType;
  /** The item's own name: exam/material title, or the subject name for a `subject` row. */
  title: string;
  /** Parent subject name for exams/materials; null for a `subject` row (the title is the subject). */
  subject: string | null;
  /** Trailing note such as a score (`85%`); null when not applicable. */
  note: string | null;
  /** ISO 8601 timestamp the feed is sorted by. */
  timestamp: string;
};

/** Newest items returned by the activity feed. */
const ACTIVITY_LIMIT = 20;

/** Supabase returns an embedded `subjects(name)` relation as an object, array, or null. */
type SubjectRel = { name: string } | { name: string }[] | null | undefined;
function relSubjectName(rel: SubjectRel): string | null {
  if (rel == null) return null;
  return Array.isArray(rel) ? (rel[0]?.name ?? null) : rel.name;
}

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
        subject: relSubjectName(latest.subjects as SubjectRel),
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

/**
 * Recent cross-entity activity feed for the History screen: the newest subjects,
 * materials, and taken/scheduled exams merged and sorted by timestamp. Each table
 * is capped at ACTIVITY_LIMIT before merging so one busy table can't crowd out the
 * others, then the merged list is re-sorted and capped again.
 */
export async function getActivity(userId: string): Promise<ActivityDTO[]> {
  const db = getSupabaseAdmin();
  const [subjects, materials, exams] = await Promise.all([
    db
      .from('subjects')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_LIMIT),
    db
      .from('materials')
      .select('id, title, created_at, subjects(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_LIMIT),
    db
      .from('exams')
      .select('id, name, score, date, subjects(name)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(ACTIVITY_LIMIT),
  ]);
  for (const result of [subjects, materials, exams]) {
    if (result.error) throw new AppError(500, result.error.message);
  }

  const items: ActivityDTO[] = [
    ...(subjects.data ?? []).map((s) => ({
      id: `subject:${s.id}`,
      type: 'subject' as const,
      title: s.name as string,
      subject: null,
      note: null,
      timestamp: s.created_at as string,
    })),
    ...(materials.data ?? []).map((m) => ({
      id: `material:${m.id}`,
      type: 'material' as const,
      title: m.title as string,
      subject: relSubjectName(m.subjects as SubjectRel),
      note: null,
      timestamp: m.created_at as string,
    })),
    ...(exams.data ?? []).map((e) => ({
      id: `exam:${e.id}`,
      type: 'exam' as const,
      title: e.name as string,
      subject: relSubjectName(e.subjects as SubjectRel),
      note: e.score == null ? null : `${e.score}%`,
      timestamp: e.date as string,
    })),
  ];

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, ACTIVITY_LIMIT);
}
