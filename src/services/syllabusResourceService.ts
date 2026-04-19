/**
 * Syllabus Resource Service
 * Handles file uploads, resource CRUD, student progress, changelog, and comments
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type { ApiError } from '@/types';
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

// ---------------------------------------------------------------------------
// Section Resources
// ---------------------------------------------------------------------------

export const getSectionResourceById = async (
  resourceId: string,
): Promise<{ data: SectionResource | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('section_resources' as any)
      .select('*')
      .eq('id', resourceId)
      .maybeSingle();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data as any) as SectionResource | null, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const getSectionResources = async (
  sectionId: string
): Promise<{ data: SectionResource[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('section_resources' as any)
      .select('*')
      .eq('section_id', sectionId)
      .order('order_index', { ascending: true });

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data as any[]) as SectionResource[], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const createSectionResource = async (
  input: CreateSectionResourceInput
): Promise<{ data: SectionResource | null; error: ApiError | null }> => {
  try {
    const row = {
      ...input,
      status: input.status ?? 'published',
      summary: input.summary ?? null,
      body_text: input.body_text ?? null,
      lesson_content: input.lesson_content ?? null,
      estimated_duration_minutes: input.estimated_duration_minutes ?? null,
    };
    const { data, error } = await supabase
      .from('section_resources' as any)
      .insert([row] as any)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as SectionResource, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const updateSectionResource = async (
  resourceId: string,
  updates: UpdateSectionResourceInput,
): Promise<{ data: SectionResource | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('section_resources' as any)
      .update(updates as any)
      .eq('id', resourceId)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as SectionResource, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const deleteSectionResource = async (
  resourceId: string,
  filePath?: string | null
): Promise<{ error: ApiError | null }> => {
  try {
    if (filePath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
    }

    const { error } = await supabase
      .from('section_resources' as any)
      .delete()
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
    const { data, error } = await supabase
      .from('student_section_progress' as any)
      .select('*')
      .eq('student_id', studentId)
      .in('section_id', (
        await supabase
          .from('syllabus_sections' as any)
          .select('id')
          .eq('syllabus_id', syllabusId)
      ).data?.map((s: any) => s.id) || []);

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data as any[]) as StudentSectionProgress[], error: null };
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
    const { data, error } = await supabase
      .from('student_section_progress' as any)
      .upsert(
        {
          section_id: sectionId,
          student_id: studentId,
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
        } as any,
        { onConflict: 'section_id,student_id' }
      )
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as StudentSectionProgress, error: null };
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
      .from('syllabus_changelog' as any)
      .select('*')
      .eq('syllabus_id', syllabusId)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data as any[]) as SyllabusChangelog[], error: null };
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
    const { error } = await supabase
      .from('syllabus_changelog' as any)
      .insert([{
        syllabus_id: syllabusId,
        changed_by: changedBy,
        change_summary: changeSummary,
        snapshot: snapshot || null,
      }] as any);

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
      .from('section_comments' as any)
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: handleSupabaseError(error) };
    const rows = (data || []) as Record<string, unknown>[];
    const mapped = rows.map(mapSectionCommentRow);
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
    const { data, error } = await supabase
      .from('section_comments' as any)
      .insert([{
        section_id: sectionId,
        user_id: userId,
        content,
        parent_id: parentId || null,
      }] as any)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    const mapped = mapSectionCommentRow(data as Record<string, unknown>);
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
      .from('section_comments' as any)
      .delete()
      .eq('id', commentId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};
