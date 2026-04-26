/**
 * Syllabus Resource Service
 * Handles file uploads, resource CRUD, student progress, changelog, and comments
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type { Database, Json } from '@/integrations/supabase/types';
import type { ApiError } from '@/types';

type ActivityListInsert = Database['public']['Tables']['activity_list']['Insert'];
type ActivityListUpdate = Database['public']['Tables']['activity_list']['Update'];
type StudentSectionProgressInsert = Database['public']['Tables']['student_section_progress']['Insert'];
type SyllabusChangelogInsert = Database['public']['Tables']['syllabus_changelog']['Insert'];
type SectionCommentInsert = Database['public']['Tables']['section_comments']['Insert'];
import type {
  SectionResource,
  CreateSectionResourceInput,
  UpdateSectionResourceInput,
  StudentSectionProgress,
  StudentProgressStatus,
  SyllabusChangelog,
  SectionComment,
} from '@/types/syllabus';

const STORAGE_BUCKET = 'syllabus-resources';

/**
 * Keys allowed on activity_list insert/update. PostgREST returns 400 if the JSON includes a
 * column name that does not exist (e.g. after manually dropping columns).
 * Slim schema (typical): section_id, title, resource_type, order_index, status, lesson_content,
 * active, deleted_at. Re-add any of summary, body_text, estimated_duration_minutes, file_path,
 * url, mime_type, file_size when those columns exist in your DB.
 */
const ACTIVITY_LIST_WRITE_KEYS = new Set([
  'section_id',
  'title',
  'resource_type',
  'order_index',
  'status',
  'lesson_content',
  'active',
  'deleted_at',
]);

function pickActivityListWritePayload(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    if (!ACTIVITY_LIST_WRITE_KEYS.has(key)) continue;
    const v = row[key];
    if (v === undefined) continue;
    out[key] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Section Resources
// ---------------------------------------------------------------------------

export const getSectionResourceById = async (
  resourceId: string,
): Promise<{ data: SectionResource | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('activity_list')
      .select('*')
      .eq('id', resourceId)
      .eq('active', true)
      .maybeSingle();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as unknown as SectionResource | null, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const getSectionResources = async (
  sectionId: string
): Promise<{ data: SectionResource[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('activity_list')
      .select('*')
      .eq('section_id', sectionId)
      .eq('active', true)
      .order('order_index', { ascending: true });

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data ?? []) as unknown as SectionResource[], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const createSectionResource = async (
  input: CreateSectionResourceInput
): Promise<{ data: SectionResource | null; error: ApiError | null }> => {
  try {
    const row = pickActivityListWritePayload({
      ...input,
      status: input.status ?? 'published',
      lesson_content: input.lesson_content ?? null,
    });
    const { data, error } = await supabase
      .from('activity_list')
      .insert([row as ActivityListInsert])
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as unknown as SectionResource, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const updateSectionResource = async (
  resourceId: string,
  updates: UpdateSectionResourceInput,
): Promise<{ data: SectionResource | null; error: ApiError | null }> => {
  try {
    const payload = pickActivityListWritePayload(updates as Record<string, unknown>);
    const { data, error } = await supabase
      .from('activity_list')
      .update(payload as ActivityListUpdate)
      .eq('id', resourceId)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as unknown as SectionResource, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const deleteSectionResource = async (
  resourceId: string,
  filePath?: string | null
): Promise<{ error: ApiError | null }> => {
  try {
    const { error: junctionErr } = await supabase
      .from('assignment_module_activities')
      .delete()
      .eq('activity_list_id', resourceId);

    if (junctionErr) return { error: handleSupabaseError(junctionErr) };

    if (filePath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
    }

    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from('activity_list')
      .update({ active: false, deleted_at: deletedAt })
      .eq('id', resourceId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

export const uploadResourceFile = async (
  sectionId: string,
  file: File
): Promise<{ filePath: string; publicUrl: string } | { error: string }> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${sectionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, { upsert: false });

    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    return { filePath: fileName, publicUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Upload failed' };
  }
};

export const getResourcePublicUrl = (filePath: string): string => {
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);
  return publicUrl;
};

function deriveResourceType(mimeType: string): SectionResource['resource_type'] {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'document';
  return 'file';
}

export const uploadAndCreateResource = async (
  sectionId: string,
  file: File,
  orderIndex: number
): Promise<{ data: SectionResource | null; error: ApiError | null }> => {
  const uploadResult = await uploadResourceFile(sectionId, file);
  if ('error' in uploadResult) {
    return { data: null, error: { message: uploadResult.error } };
  }

  return createSectionResource({
    section_id: sectionId,
    title: file.name,
    resource_type: deriveResourceType(file.type),
    file_path: uploadResult.filePath,
    url: uploadResult.publicUrl,
    mime_type: file.type,
    file_size: file.size,
    order_index: orderIndex,
  });
};

export const createLinkResource = async (
  sectionId: string,
  title: string,
  url: string,
  orderIndex: number
): Promise<{ data: SectionResource | null; error: ApiError | null }> => {
  return createSectionResource({
    section_id: sectionId,
    title,
    resource_type: 'link',
    file_path: null,
    url,
    mime_type: null,
    file_size: null,
    order_index: orderIndex,
  });
};

// ---------------------------------------------------------------------------
// Student Section Progress
// ---------------------------------------------------------------------------

export const getStudentProgress = async (
  syllabusId: string,
  studentId: string
): Promise<{ data: StudentSectionProgress[] | null; error: ApiError | null }> => {
  try {
    const { data: sectionRows } = await supabase
      .from('syllabus_sections')
      .select('id')
      .eq('syllabus_id', syllabusId);
    const sectionIds = sectionRows?.map((s) => s.id) ?? [];
    if (sectionIds.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
      .from('student_section_progress')
      .select('*')
      .eq('student_id', studentId)
      .in('section_id', sectionIds);

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data ?? []) as unknown as StudentSectionProgress[], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const upsertStudentProgress = async (
  sectionId: string,
  studentId: string,
  status: StudentProgressStatus
): Promise<{ data: StudentSectionProgress | null; error: ApiError | null }> => {
  try {
    const upsertRow: StudentSectionProgressInsert = {
      section_id: sectionId,
      student_id: studentId,
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase
      .from('student_section_progress')
      .upsert(upsertRow, { onConflict: 'section_id,student_id' })
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as unknown as StudentSectionProgress, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

// ---------------------------------------------------------------------------
// Syllabus Changelog
// ---------------------------------------------------------------------------

export const getChangelog = async (
  syllabusId: string
): Promise<{ data: SyllabusChangelog[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('syllabus_changelog')
      .select('*')
      .eq('syllabus_id', syllabusId)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data ?? []) as unknown as SyllabusChangelog[], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const createChangelogEntry = async (
  syllabusId: string,
  changedBy: string,
  changeSummary: string,
  snapshot?: Record<string, unknown>
): Promise<{ error: ApiError | null }> => {
  try {
    const insertRow: SyllabusChangelogInsert = {
      syllabus_id: syllabusId,
      changed_by: changedBy,
      change_summary: changeSummary,
      snapshot:
        snapshot != null ? (JSON.parse(JSON.stringify(snapshot)) as Json) : null,
    };
    const { error } = await supabase.from('syllabus_changelog').insert([insertRow]);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

// ---------------------------------------------------------------------------
// Section Comments
// ---------------------------------------------------------------------------

function mapSectionCommentRow(row: Record<string, unknown>): SectionComment {
  const authorName = row.author_display_name as string | null | undefined;
  const authorAvatar = row.author_avatar_url as string | null | undefined;
  return {
    id: row.id as string,
    section_id: row.section_id as string,
    user_id: row.user_id as string,
    content: row.content as string,
    parent_id: (row.parent_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    user_name: authorName ?? (row.user_name as string | undefined) ?? undefined,
    user_avatar: authorAvatar ?? (row.user_avatar as string | undefined) ?? undefined,
  };
}

export const getSectionComments = async (
  sectionId: string
): Promise<{ data: SectionComment[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('section_comments')
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: handleSupabaseError(error) };
    const mapped = (data ?? []).map((r) =>
      mapSectionCommentRow(r as unknown as Record<string, unknown>),
    );
    return { data: mapped, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const createSectionComment = async (
  sectionId: string,
  userId: string,
  content: string,
  parentId?: string | null
): Promise<{ data: SectionComment | null; error: ApiError | null }> => {
  try {
    const insertRow: SectionCommentInsert = {
      section_id: sectionId,
      user_id: userId,
      content,
      parent_id: parentId || null,
    };
    const { data, error } = await supabase
      .from('section_comments')
      .insert([insertRow])
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    const mapped = mapSectionCommentRow(data as unknown as Record<string, unknown>);
    return { data: mapped, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const deleteSectionComment = async (
  commentId: string
): Promise<{ error: ApiError | null }> => {
  try {
    const { error } = await supabase
      .from('section_comments')
      .delete()
      .eq('id', commentId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};
