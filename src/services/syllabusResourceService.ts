/**
 * Syllabus Resource Service
 * Handles file uploads, resource CRUD, student progress, changelog, and comments
 */

import { supabase, handleSupabaseError } from '@/api/client';
import {
  TUS_UPLOAD_THRESHOLD_BYTES,
  uploadFileResumable,
  type UploadProgressCallback,
} from '@/lib/resumableStorageUpload';
import { isStoragePayloadTooLarge } from '@/lib/storageUploadErrors';
import { ACTIVITY_LIST_OPTIONAL_COLUMNS } from '@/lib/activityListOptionalColumns';
import { activityListWriteWithUnknownColumnFallback } from '@/lib/activityListSchemaFallback';
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

/** Outline links / uploads use `lesson_content` when `url` / `file_path` columns are missing (slim `activity_list`). */
const OUTLINE_LINK_V1 = '__outline_link_v1';
const OUTLINE_FILE_V1 = '__outline_file_v1';

function normalizeUrlForLinkStorage(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function outlineLinkLessonJson(url: string): Json {
  return { [OUTLINE_LINK_V1]: { url } } as unknown as Json;
}

function extractOutlineLinkUrl(lessonContent: unknown): string | null {
  if (!lessonContent || typeof lessonContent !== 'object' || Array.isArray(lessonContent)) return null;
  const inner = (lessonContent as Record<string, unknown>)[OUTLINE_LINK_V1];
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) return null;
  const u = (inner as Record<string, unknown>).url;
  return typeof u === 'string' && u.trim() ? u.trim() : null;
}

function outlineFileLessonJson(meta: {
  file_path: string;
  url: string;
  mime_type: string;
  file_size: number;
}): Json {
  return {
    [OUTLINE_FILE_V1]: {
      file_path: meta.file_path,
      url: meta.url,
      mime_type: meta.mime_type,
      file_size: meta.file_size,
    },
  } as unknown as Json;
}

function extractOutlineFileMeta(lessonContent: unknown): {
  file_path: string;
  url: string;
  mime_type: string | null;
  file_size: number | null;
} | null {
  if (!lessonContent || typeof lessonContent !== 'object' || Array.isArray(lessonContent)) return null;
  const inner = (lessonContent as Record<string, unknown>)[OUTLINE_FILE_V1];
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) return null;
  const o = inner as Record<string, unknown>;
  const file_path = o.file_path;
  const url = o.url;
  if (typeof file_path !== 'string' || !file_path.trim()) return null;
  if (typeof url !== 'string' || !url.trim()) return null;
  const mime_type = typeof o.mime_type === 'string' ? o.mime_type : null;
  const rawSize = o.file_size;
  let file_size: number | null = null;
  if (typeof rawSize === 'number' && Number.isFinite(rawSize)) file_size = rawSize;
  else if (typeof rawSize === 'string' && rawSize.trim() !== '' && Number.isFinite(Number(rawSize))) {
    file_size = Number(rawSize);
  }
  return { file_path: file_path.trim(), url: url.trim(), mime_type, file_size };
}

const FILE_BACKED_RESOURCE_TYPES = new Set<SectionResource['resource_type']>([
  'file',
  'document',
  'image',
  'video',
]);

export function mapActivityListRowToSectionResource(row: SectionResource | null | undefined): SectionResource | null {
  if (!row) return null;

  if (row.resource_type === 'link') {
    const u = row.url?.trim();
    if (u) return row;
    const fromLc = extractOutlineLinkUrl(row.lesson_content);
    if (!fromLc) return row;
    return { ...row, url: fromLc };
  }

  if (FILE_BACKED_RESOURCE_TYPES.has(row.resource_type)) {
    const hasPath = row.file_path?.trim();
    const hasUrl = row.url?.trim();
    if (hasPath && hasUrl) return row;
    const meta = extractOutlineFileMeta(row.lesson_content);
    if (!meta) return row;
    return {
      ...row,
      file_path: hasPath ?? meta.file_path,
      url: hasUrl ?? meta.url,
      mime_type: row.mime_type ?? meta.mime_type,
      file_size: row.file_size ?? meta.file_size,
    };
  }

  return row;
}

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
  'summary',
  'body_text',
  'file_path',
  'url',
  'mime_type',
  'file_size',
  'estimated_duration_minutes',
  'active',
  'deleted_at',
]);

/** Omit from PATCH like nulls — trims noise and avoids slim DB rejecting unknown cols on empty payloads. */
const ACTIVITY_PATCH_OMIT_WHEN_ABSENTLIKE = ACTIVITY_LIST_OPTIONAL_COLUMNS;

function activityPatchIncludesField(key: string, v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (
    ACTIVITY_PATCH_OMIT_WHEN_ABSENTLIKE.has(key) &&
    typeof v === 'string' &&
    !v.trim()
  ) {
    return false;
  }
  return true;
}

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
    return { data: mapActivityListRowToSectionResource(data as unknown as SectionResource), error: null };
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
    const mapped = (data ?? []).map((r) =>
      mapActivityListRowToSectionResource(r as unknown as SectionResource),
    ) as SectionResource[];
    return { data: mapped, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const createSectionResource = async (
  input: CreateSectionResourceInput
): Promise<{ data: SectionResource | null; error: ApiError | null }> => {
  try {
    const normalizedInput =
      input.resource_type === 'link' && typeof input.url === 'string'
        ? { ...input, url: normalizeUrlForLinkStorage(input.url) }
        : input;

    const isFileBackedOutline =
      FILE_BACKED_RESOURCE_TYPES.has(normalizedInput.resource_type) &&
      typeof normalizedInput.file_path === 'string' &&
      normalizedInput.file_path.trim() !== '' &&
      typeof normalizedInput.url === 'string' &&
      normalizedInput.url.trim() !== '';

    const row =
      normalizedInput.resource_type === 'link' && typeof normalizedInput.url === 'string'
        ? (() => {
            const { url: _omitUrl, lesson_content: _omitLc, ...linkRest } = normalizedInput;
            return pickActivityListWritePayload({
              ...linkRest,
              status: normalizedInput.status ?? 'published',
              lesson_content: outlineLinkLessonJson(normalizedInput.url),
            } as Record<string, unknown>);
          })()
        : isFileBackedOutline
          ? (() => {
              const {
                file_path: _fp,
                url: _u,
                mime_type: _mt,
                file_size: _fs,
                lesson_content: _lc,
                ...fileRest
              } = normalizedInput;
              return pickActivityListWritePayload({
                ...fileRest,
                status: normalizedInput.status ?? 'published',
                lesson_content: outlineFileLessonJson({
                  file_path: normalizedInput.file_path!,
                  url: normalizedInput.url!,
                  mime_type: normalizedInput.mime_type ?? '',
                  file_size: normalizedInput.file_size ?? 0,
                }),
              } as Record<string, unknown>);
            })()
          : pickActivityListWritePayload({
              ...normalizedInput,
              status: normalizedInput.status ?? 'published',
              lesson_content: normalizedInput.lesson_content ?? null,
            });

    /** Inserts only non-null fields; retries without unknown columns on slim `activity_list` schemas. */
    const insertRow = Object.fromEntries(
      Object.entries(row).filter(([, v]) => v !== null && v !== undefined),
    );
    const { data, error } = await activityListWriteWithUnknownColumnFallback(
      insertRow,
      async (payload) => {
        const result = await supabase
          .from('activity_list')
          .insert([payload as ActivityListInsert])
          .select()
          .single();
        return { data: result.data, error: result.error };
      },
      'No insertable fields left for activity_list after dropping unknown columns.',
      'activity_list INSERT stopped after exhausting schema column fallbacks; check migrations vs remote DB.',
    );

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
    return {
      data: mapActivityListRowToSectionResource(data as unknown as SectionResource),
      error: null,
    };
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
    // Omit null/undefined PATCH fields — PostgREST errors on unknown column names present in JSON (even null).
    // Slim `activity_list` stacks often lack body_text/url/file_path; merges still send nullable columns.
    const patchMutable: Record<string, unknown> = Object.fromEntries(
      Object.entries(payload).filter(([k, v]) => activityPatchIncludesField(k, v)),
    );

    const { data, error } = await activityListWriteWithUnknownColumnFallback(
      patchMutable,
      async (mutable) => {
        const result = await supabase
          .from('activity_list')
          .update(mutable as ActivityListUpdate)
          .eq('id', resourceId)
          .select()
          .single();
        return { data: result.data, error: result.error };
      },
      'No updatable fields left for activity_list after dropping unknown columns.',
      'activity_list PATCH stopped after exhausting schema column fallbacks; check migrations vs remote DB.',
    );

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
    return {
      data: mapActivityListRowToSectionResource(data as unknown as SectionResource),
      error: null,
    };
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

export type UploadResourceFileOptions = {
  onProgress?: UploadProgressCallback;
};

export const uploadResourceFile = async (
  sectionId: string,
  file: File,
  options?: UploadResourceFileOptions,
): Promise<{ filePath: string; publicUrl: string } | { error: string }> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${sectionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    if (file.size > TUS_UPLOAD_THRESHOLD_BYTES) {
      await uploadFileResumable(STORAGE_BUCKET, fileName, file, options?.onProgress);
    } else {
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file, { upsert: false });

      if (uploadError) return { error: uploadError.message };
      options?.onProgress?.(file.size, file.size);
    }

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    return { filePath: fileName, publicUrl };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'STORAGE_GLOBAL_LIMIT_EXCEEDED' || isStoragePayloadTooLarge(error))
    ) {
      return { error: 'STORAGE_GLOBAL_LIMIT_EXCEEDED' };
    }
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
  orderIndex: number,
  options?: UploadResourceFileOptions,
): Promise<{ data: SectionResource | null; error: ApiError | null }> => {
  const uploadResult = await uploadResourceFile(sectionId, file, options);
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
