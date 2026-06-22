import { getSupabaseAdmin } from '../../lib/supabase.js';
import { AppError } from '../../middleware/error.js';
import { mapExam, type ExamDTO } from '../exams/exams.service.js';
import { mapMaterial, type MaterialDTO } from '../materials/materials.service.js';
import type { CreateSubjectInput, UpdateSubjectInput } from './subjects.schema.js';

export type SubjectDTO = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  color: string;
  progress: number;
  materialsCount: number;
  examsCount: number;
  createdAt: string;
  updatedAt: string;
};

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  color: string;
  progress: number;
  created_at: string;
  updated_at: string;
  materials?: { count: number }[];
  exams?: { count: number }[];
};

function mapSubject(row: SubjectRow): SubjectDTO {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    color: row.color,
    progress: row.progress,
    materialsCount: row.materials?.[0]?.count ?? 0,
    examsCount: row.exams?.[0]?.count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_WITH_COUNTS = '*, materials(count), exams(count)';

export async function listSubjects(userId: string): Promise<SubjectDTO[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('subjects')
    .select(SELECT_WITH_COUNTS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  return (data as SubjectRow[]).map(mapSubject);
}

export async function getSubjectRow(userId: string, id: string): Promise<SubjectDTO> {
  const { data, error } = await getSupabaseAdmin()
    .from('subjects')
    .select(SELECT_WITH_COUNTS)
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Subject not found');
  return mapSubject(data as SubjectRow);
}

export type SubjectDetailDTO = SubjectDTO & {
  materials: MaterialDTO[];
  exams: ExamDTO[];
};

export async function getSubjectDetail(userId: string, id: string): Promise<SubjectDetailDTO> {
  const subject = await getSubjectRow(userId, id);
  const db = getSupabaseAdmin();
  const [materials, exams] = await Promise.all([
    db
      .from('materials')
      .select('*')
      .eq('user_id', userId)
      .eq('subject_id', id)
      .order('created_at', { ascending: false }),
    db
      .from('exams')
      .select('*')
      .eq('user_id', userId)
      .eq('subject_id', id)
      .order('date', { ascending: false }),
  ]);
  if (materials.error) throw new AppError(500, materials.error.message);
  if (exams.error) throw new AppError(500, exams.error.message);
  return {
    ...subject,
    materials: materials.data.map(mapMaterial),
    exams: exams.data.map(mapExam),
  };
}

export async function createSubject(
  userId: string,
  input: CreateSubjectInput,
): Promise<SubjectDTO> {
  const { data, error } = await getSupabaseAdmin()
    .from('subjects')
    .insert({
      user_id: userId,
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
      color: input.color,
      progress: input.progress ?? 0,
    })
    .select(SELECT_WITH_COUNTS)
    .single();
  if (error) throw new AppError(500, error.message);
  return mapSubject(data as SubjectRow);
}

export async function updateSubject(
  userId: string,
  id: string,
  input: UpdateSubjectInput,
): Promise<SubjectDTO> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.code !== undefined) patch.code = input.code;
  if (input.description !== undefined) patch.description = input.description;
  if (input.color !== undefined) patch.color = input.color;
  if (input.progress !== undefined) patch.progress = input.progress;

  const { data, error } = await getSupabaseAdmin()
    .from('subjects')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select(SELECT_WITH_COUNTS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Subject not found');
  return mapSubject(data as SubjectRow);
}

export async function deleteSubject(userId: string, id: string): Promise<void> {
  const { error, count } = await getSupabaseAdmin()
    .from('subjects')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw new AppError(500, error.message);
  if (!count) throw new AppError(404, 'Subject not found');
}
