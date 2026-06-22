import { getSupabaseAdmin } from '../../lib/supabase.js';
import { AppError } from '../../middleware/error.js';
import type { CreateMaterialInput, UpdateMaterialInput } from './materials.schema.js';

export type MaterialDTO = {
  id: string;
  subjectId: string;
  title: string;
  type: string;
  pages: number | null;
  content: string | null;
  summary: string | null;
  keyConcepts: string[];
  fileUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FlashcardDTO = {
  id: string;
  front: string;
  back: string;
};

type MaterialRow = {
  id: string;
  subject_id: string;
  title: string;
  type: string;
  pages: number | null;
  content: string | null;
  summary: string | null;
  key_concepts: string[] | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
};

export function mapMaterial(row: MaterialRow): MaterialDTO {
  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    type: row.type,
    pages: row.pages,
    content: row.content,
    summary: row.summary,
    keyConcepts: row.key_concepts ?? [],
    fileUrl: row.file_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getFlashcards(userId: string, materialId: string): Promise<FlashcardDTO[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('flashcards')
    .select('id, front, back')
    .eq('user_id', userId)
    .eq('material_id', materialId)
    .order('created_at', { ascending: true });
  if (error) throw new AppError(500, error.message);
  return (data as FlashcardDTO[]) ?? [];
}

/** Confirms the subject exists and belongs to the user (FK guard for inserts). */
async function assertSubjectOwned(userId: string, subjectId: string): Promise<void> {
  const { data, error } = await getSupabaseAdmin()
    .from('subjects')
    .select('id')
    .eq('user_id', userId)
    .eq('id', subjectId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Subject not found');
}

export async function listMaterials(userId: string, subjectId?: string): Promise<MaterialDTO[]> {
  let query = getSupabaseAdmin()
    .from('materials')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (subjectId) query = query.eq('subject_id', subjectId);
  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  return (data as MaterialRow[]).map(mapMaterial);
}

export async function getMaterial(userId: string, id: string): Promise<MaterialDTO> {
  const { data, error } = await getSupabaseAdmin()
    .from('materials')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Material not found');
  return mapMaterial(data as MaterialRow);
}

export async function createMaterial(
  userId: string,
  input: CreateMaterialInput,
): Promise<MaterialDTO> {
  await assertSubjectOwned(userId, input.subjectId);
  const { data, error } = await getSupabaseAdmin()
    .from('materials')
    .insert({
      user_id: userId,
      subject_id: input.subjectId,
      title: input.title,
      type: input.type,
      pages: input.pages ?? null,
      content: input.content ?? null,
      file_url: input.fileUrl ?? null,
    })
    .select('*')
    .single();
  if (error) throw new AppError(500, error.message);
  return mapMaterial(data as MaterialRow);
}

export async function updateMaterial(
  userId: string,
  id: string,
  input: UpdateMaterialInput,
): Promise<MaterialDTO> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.type !== undefined) patch.type = input.type;
  if (input.pages !== undefined) patch.pages = input.pages;
  if (input.content !== undefined) patch.content = input.content;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.fileUrl !== undefined) patch.file_url = input.fileUrl;

  const { data, error } = await getSupabaseAdmin()
    .from('materials')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Material not found');
  return mapMaterial(data as MaterialRow);
}

export async function deleteMaterial(userId: string, id: string): Promise<void> {
  const { error, count } = await getSupabaseAdmin()
    .from('materials')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw new AppError(500, error.message);
  if (!count) throw new AppError(404, 'Material not found');
}
