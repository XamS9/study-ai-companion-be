import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../middleware/error.js';

export type DashboardDTO = {
  subjectsCount: number;
  materialsCount: number;
  examsTaken: number;
  averageScore: number | null;
  lastExam: { id: string; name: string; subject: string | null; score: number; date: string } | null;
};

export type SubjectStatsDTO = {
  subjectId: string;
  subject: string;
  color: string;
  examsTaken: number;
  averageScore: number | null;
  bestScore: number | null;
  worstScore: number | null;
  totalStudyTimeSeconds: number;
};

export type StatsDTO = {
  examsTaken: number;
  averageScore: number | null;
  bestScore: number | null;
  worstScore: number | null;
  totalStudyTimeSeconds: number;
  perSubject: SubjectStatsDTO[];
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

/** Same embedding, but pulling both name and color for the stats breakdown. */
type SubjectColorRel =
  | { name: string; color: string }
  | { name: string; color: string }[]
  | null
  | undefined;
function relSubject(rel: SubjectColorRel): { name: string; color: string } | null {
  if (rel == null) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

async function countRows(db: SupabaseClient, table: string, userId: string): Promise<number> {
  const { count, error } = await db
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new AppError(500, error.message);
  return count ?? 0;
}

export async function getDashboard(db: SupabaseClient, userId: string): Promise<DashboardDTO> {
  const [subjectsCount, materialsCount] = await Promise.all([
    countRows(db, 'subjects', userId),
    countRows(db, 'materials', userId),
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

const average = (scores: number[]): number | null =>
  scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

/**
 * Academic statistics for the History screen: overall and per-subject exam
 * performance over the user's *taken* exams (those with a score). Aggregated in
 * JS — the dataset is one row per attempt, which stays small for a student.
 */
export async function getStats(db: SupabaseClient, userId: string): Promise<StatsDTO> {
  const { data, error } = await db
    .from('exams')
    .select('subject_id, score, time_elapsed_seconds, subjects(name, color)')
    .eq('user_id', userId)
    .not('score', 'is', null);
  if (error) throw new AppError(500, error.message);

  type Row = {
    subject_id: string;
    score: number;
    time_elapsed_seconds: number | null;
    subjects: SubjectColorRel;
  };
  const rows = (data ?? []) as Row[];

  const allScores = rows.map((r) => r.score);
  const totalStudyTimeSeconds = rows.reduce((sum, r) => sum + (r.time_elapsed_seconds ?? 0), 0);

  // Group attempts by subject, keeping the subject's display name and color.
  const groups = new Map<string, { name: string; color: string; scores: number[]; time: number }>();
  for (const r of rows) {
    const subj = relSubject(r.subjects);
    const group = groups.get(r.subject_id) ?? {
      name: subj?.name ?? 'Unknown',
      color: subj?.color ?? 'primary',
      scores: [],
      time: 0,
    };
    group.scores.push(r.score);
    group.time += r.time_elapsed_seconds ?? 0;
    groups.set(r.subject_id, group);
  }

  const perSubject: SubjectStatsDTO[] = [...groups.entries()]
    .map(([subjectId, g]) => ({
      subjectId,
      subject: g.name,
      color: g.color,
      examsTaken: g.scores.length,
      averageScore: average(g.scores),
      bestScore: Math.max(...g.scores),
      worstScore: Math.min(...g.scores),
      totalStudyTimeSeconds: g.time,
    }))
    .sort((a, b) => b.examsTaken - a.examsTaken);

  return {
    examsTaken: rows.length,
    averageScore: average(allScores),
    bestScore: allScores.length > 0 ? Math.max(...allScores) : null,
    worstScore: allScores.length > 0 ? Math.min(...allScores) : null,
    totalStudyTimeSeconds,
    perSubject,
  };
}

/**
 * Recent cross-entity activity feed for the History screen: the newest subjects,
 * materials, and taken/scheduled exams merged and sorted by timestamp. Each table
 * is capped at ACTIVITY_LIMIT before merging so one busy table can't crowd out the
 * others, then the merged list is re-sorted and capped again.
 */
export async function getActivity(db: SupabaseClient, userId: string): Promise<ActivityDTO[]> {
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
