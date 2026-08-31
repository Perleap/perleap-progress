/**
 * Syllabus Service
 * Handles all syllabus-related Supabase operations
 */

import type { Database, Json } from '@/integrations/supabase/types';
import type { ApiError } from '@/types';
import type {
  Syllabus,
  SyllabusSection,
  GradingCategory,
  SyllabusWithSections,
  CreateSyllabusInput,
  UpdateSyllabusInput,
  CreateSyllabusSectionInput,
  UpdateSyllabusSectionInput,
  CreateGradingCategoryInput,
  UpdateGradingCategoryInput,
  ProvisionSyllabusBundleInput,
  ResourceType,
  SectionResource,
  SyllabusStructureType,
  SyllabusStatus,
  CompletionStatus,
} from '@/types/syllabus';
import { supabase, handleSupabaseError } from '@/api/client';
import { normalizeReleaseMode } from '@/lib/releaseMode';
import {
  createSectionResource,
  mapActivityListRowToSectionResource,
  uploadResourceFile,
} from '@/services/syllabusResourceService';

type SyllabusRow = Database['public']['Tables']['syllabi']['Row'];
type SyllabusInsert = Database['public']['Tables']['syllabi']['Insert'];
type SyllabusUpdate = Database['public']['Tables']['syllabi']['Update'];
type SyllabusSectionRow = Database['public']['Tables']['syllabus_sections']['Row'];
type SyllabusSectionInsert = Database['public']['Tables']['syllabus_sections']['Insert'];
type SyllabusSectionUpdate = Database['public']['Tables']['syllabus_sections']['Update'];
type GradingCategoryRow = Database['public']['Tables']['grading_categories']['Row'];
type GradingCategoryInsert = Database['public']['Tables']['grading_categories']['Insert'];
type GradingCategoryUpdate = Database['public']['Tables']['grading_categories']['Update'];
type ActivityListRow = Database['public']['Tables']['activity_list']['Row'];

type SyllabusSectionWithActivities = SyllabusSectionRow & {
  activity_list: ActivityListRow[] | null;
};

type SyllabusWithRelations = SyllabusRow & {
  syllabus_sections: SyllabusSectionWithActivities[] | null;
  grading_categories: GradingCategoryRow[] | null;
};

type SectionAssignmentSummary = Pick<
  Database['public']['Tables']['assignments']['Row'],
  'id' | 'title' | 'type' | 'status' | 'due_at' | 'syllabus_section_id' | 'grading_category_id'
>;

const DEFAULT_SYLLABUS_INSERT = {
  release_mode: 'all_at_once' as const,
  published_at: null as string | null,
  accent_color: null as string | null,
  banner_url: null as string | null,
  section_label_override: null as string | null,
  custom_settings: {} as Record<string, unknown>,
};

function parsePolicies(raw: Json): Syllabus['policies'] {
  if (!Array.isArray(raw)) return [];
  return raw as unknown as Syllabus['policies'];
}

function parseCustomSettings(raw: Json): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function mapSyllabusRow(row: SyllabusRow): Syllabus {
  return {
    id: row.id,
    classroom_id: row.classroom_id,
    title: row.title,
    summary: row.summary,
    structure_type: row.structure_type as SyllabusStructureType,
    policies: parsePolicies(row.policies),
    status: row.status as SyllabusStatus,
    release_mode: normalizeReleaseMode(row.release_mode),
    published_at: row.published_at,
    accent_color: row.accent_color,
    banner_url: row.banner_url,
    section_label_override: row.section_label_override,
    custom_settings: parseCustomSettings(row.custom_settings),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapSyllabusSectionRow(row: SyllabusSectionRow): SyllabusSection {
  return {
    id: row.id,
    syllabus_id: row.syllabus_id,
    title: row.title,
    description: row.description,
    content: row.content,
    order_index: row.order_index,
    start_date: row.start_date,
    end_date: row.end_date,
    objectives: row.objectives,
    resources: row.resources,
    notes: row.notes,
    completion_status: row.completion_status as CompletionStatus,
    prerequisites: row.prerequisites,
    is_locked: row.is_locked,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapGradingCategoryRow(row: GradingCategoryRow): GradingCategory {
  return row;
}

function toSyllabusInsert(
  input: CreateSyllabusInput & { published_at?: string | null }
): SyllabusInsert {
  return {
    classroom_id: input.classroom_id,
    title: input.title,
    summary: input.summary,
    structure_type: input.structure_type,
    policies: input.policies as unknown as Json,
    status: input.status,
    release_mode: input.release_mode ?? DEFAULT_SYLLABUS_INSERT.release_mode,
    published_at: input.published_at ?? DEFAULT_SYLLABUS_INSERT.published_at,
    accent_color: input.accent_color ?? DEFAULT_SYLLABUS_INSERT.accent_color,
    banner_url: input.banner_url ?? DEFAULT_SYLLABUS_INSERT.banner_url,
    section_label_override:
      input.section_label_override ?? DEFAULT_SYLLABUS_INSERT.section_label_override,
    custom_settings: (input.custom_settings ??
      DEFAULT_SYLLABUS_INSERT.custom_settings) as unknown as Json,
  };
}

function toSyllabusUpdate(updates: UpdateSyllabusInput): SyllabusUpdate {
  const { policies, custom_settings, ...rest } = updates;
  const payload: SyllabusUpdate = { ...rest };
  if (policies !== undefined) payload.policies = policies as unknown as Json;
  if (custom_settings !== undefined) {
    payload.custom_settings = custom_settings as unknown as Json;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Syllabus
// ---------------------------------------------------------------------------

export const getSyllabusByClassroom = async (
  classroomId: string
): Promise<{ data: SyllabusWithSections | null; error: ApiError | null }> => {
  try {
    const { data: row, error: syllabusError } = await supabase
      .from('syllabi')
      .select(
        `
        *,
        syllabus_sections (
          *,
          activity_list (*)
        ),
        grading_categories (*)
      `
      )
      .eq('classroom_id', classroomId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (syllabusError) return { data: null, error: handleSupabaseError(syllabusError) };
    if (!row) return { data: null, error: null };

    const bundled = row as SyllabusWithRelations;
    const rawSections = bundled.syllabus_sections ?? [];
    const gradingCategories = [...(bundled.grading_categories ?? [])].sort((a, b) => {
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return ta - tb;
    });

    const sections = [...rawSections]
      .filter((sec) => sec.active)
      .sort((a, b) => a.order_index - b.order_index);

    const sectionResourcesMap: Record<string, SectionResource[]> = {};
    for (const sec of sections) {
      const resources = (sec.activity_list ?? [])
        .filter((r) => r.active)
        .sort((a, b) => a.order_index - b.order_index)
        .map((r) => mapActivityListRowToSectionResource(r as unknown as SectionResource))
        .filter(Boolean) as SectionResource[];
      sectionResourcesMap[String(sec.id)] = resources;
    }

    const sectionsClean = sections.map(({ activity_list: _al, ...rest }) =>
      mapSyllabusSectionRow(rest)
    );

    const { syllabus_sections: _ss, grading_categories: _gc, ...syllabusBase } = bundled;

    return {
      data: {
        ...mapSyllabusRow(syllabusBase),
        sections: sectionsClean,
        grading_categories: gradingCategories.map(mapGradingCategoryRow),
        section_resources: sectionResourcesMap,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Syllabus + sections only (no grading categories, no activity_list).
 * Use for admin filters / nav where full section payload is unnecessary — saves a round trip + heavy activity_list query.
 */
export const getSyllabusOutlineByClassroom = async (
  classroomId: string
): Promise<{ data: SyllabusWithSections | null; error: ApiError | null }> => {
  try {
    const { data: syllabus, error: syllabusError } = await supabase
      .from('syllabi')
      .select('*')
      .eq('classroom_id', classroomId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (syllabusError) return { data: null, error: handleSupabaseError(syllabusError) };
    if (!syllabus) return { data: null, error: null };

    const { data: sections, error: sectionsError } = await supabase
      .from('syllabus_sections')
      .select('*')
      .eq('syllabus_id', syllabus.id)
      .eq('active', true)
      .order('order_index', { ascending: true });

    if (sectionsError) return { data: null, error: handleSupabaseError(sectionsError) };

    return {
      data: {
        ...mapSyllabusRow(syllabus),
        sections: (sections ?? []).map(mapSyllabusSectionRow),
        grading_categories: [],
        section_resources: {},
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const createSyllabus = async (
  input: CreateSyllabusInput
): Promise<{ data: Syllabus | null; error: ApiError | null }> => {
  try {
    let published_at = input.published_at ?? DEFAULT_SYLLABUS_INSERT.published_at;
    if (input.status === 'published' && !published_at) {
      published_at = new Date().toISOString();
    }
    const insertRow = toSyllabusInsert({ ...input, published_at });
    const { data, error } = await supabase.from('syllabi').insert(insertRow).select().single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data ? mapSyllabusRow(data) : null, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

function fileResourceTypeFromName(fileName: string, mime: string): ResourceType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  return 'document';
}

/**
 * Creates syllabus, grading categories, sections (with prerequisite resolution), and section resources.
 * Used by Create Classroom Wizard so payloads match Course Outline / SyllabusEditor defaults.
 */
export const provisionSyllabusBundle = async (
  bundle: ProvisionSyllabusBundleInput
): Promise<{ data: Syllabus | null; error: ApiError | null }> => {
  try {
    const policiesPayload = bundle.policies
      .filter((p) => p.content.trim())
      .map((p, i) => ({ ...p, order_index: i }));

    const { data: syllabus, error: syllabusError } = await createSyllabus({
      classroom_id: bundle.classroom_id,
      title: bundle.title,
      summary: bundle.summary,
      structure_type: bundle.structure_type,
      policies: policiesPayload,
      status: bundle.status,
      release_mode: bundle.release_mode,
    });

    if (syllabusError) return { data: null, error: syllabusError };
    if (!syllabus) return { data: null, error: { message: 'Syllabus insert returned no row' } };

    const syllabusId = syllabus.id;

    if (bundle.gradingCategories.length > 0) {
      const catRows: GradingCategoryInsert[] = bundle.gradingCategories
        .filter((c) => c.name.trim())
        .map((c) => ({
          syllabus_id: syllabusId,
          name: c.name,
          weight: c.weight,
        }));
      if (catRows.length > 0) {
        const { error: catError } = await supabase.from('grading_categories').insert(catRows);
        if (catError) return { data: null, error: handleSupabaseError(catError) };
      }
    }

    const sections = bundle.sections;
    if (sections.length === 0) {
      return { data: syllabus, error: null };
    }

    const phaseARows: SyllabusSectionInsert[] = sections.map((s) => ({
      syllabus_id: syllabusId,
      title: s.title,
      description: s.description,
      content: s.content,
      order_index: s.order_index,
      start_date: s.start_date,
      end_date: s.end_date,
      objectives: s.objectives.filter((o) => o.trim()),
      resources: s.resources,
      notes: s.notes,
      completion_status: s.completion_status,
      prerequisites: [],
      is_locked: s.is_locked,
    }));

    const { data: createdSections, error: sectionsError } = await supabase
      .from('syllabus_sections')
      .insert(phaseARows)
      .select();

    if (sectionsError) return { data: null, error: handleSupabaseError(sectionsError) };
    const dbRows = (createdSections ?? []).slice();
    const idByOrderIndex = new Map<number, string>();
    dbRows.forEach((row) => {
      if (row?.id != null && row.order_index != null) idByOrderIndex.set(row.order_index, row.id);
    });

    const tempIdToId = new Map<string, string>();
    const idToOrderIndex = new Map<string, number>();
    sections.forEach((s) => {
      const id = idByOrderIndex.get(s.order_index);
      if (id) {
        tempIdToId.set(s.tempId, id);
        idToOrderIndex.set(id, s.order_index);
      }
    });

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const sectionId = tempIdToId.get(s.tempId);
      if (!sectionId) continue;

      const prereqIds: string[] = [];
      for (const tempId of s.prerequisitesTempIds) {
        const targetId = tempIdToId.get(tempId);
        if (!targetId || targetId === sectionId) continue;
        const targetOrder = idToOrderIndex.get(targetId);
        if (targetOrder === undefined || targetOrder >= s.order_index) continue;
        if (!prereqIds.includes(targetId)) prereqIds.push(targetId);
      }

      if (prereqIds.length > 0) {
        const updatePayload: SyllabusSectionUpdate = { prerequisites: prereqIds };
        const { error: upErr } = await supabase
          .from('syllabus_sections')
          .update(updatePayload)
          .eq('id', sectionId);
        if (upErr) return { data: null, error: handleSupabaseError(upErr) };
      }

      const items = bundle.sectionResourceItems[i] || [];
      let orderIdx = 0;
      for (const item of items) {
        if (item.type === 'link') {
          const { error: rErr } = await createSectionResource({
            section_id: sectionId,
            title: item.title || item.url,
            resource_type: 'link',
            file_path: null,
            url: item.url,
            mime_type: null,
            file_size: null,
            order_index: orderIdx++,
          });
          if (rErr) return { data: null, error: rErr };
        } else {
          const result = await uploadResourceFile(sectionId, item.file);
          if ('error' in result) {
            return { data: null, error: { message: result.error } };
          }
          const rType = fileResourceTypeFromName(item.file.name, item.file.type || '');
          const { error: rErr } = await createSectionResource({
            section_id: sectionId,
            title: item.title || item.file.name,
            resource_type: rType,
            file_path: result.filePath,
            url: null,
            mime_type: item.file.type || null,
            file_size: item.file.size,
            order_index: orderIdx++,
          });
          if (rErr) return { data: null, error: rErr };
        }
      }
    }

    return { data: syllabus, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const updateSyllabus = async (
  syllabusId: string,
  updates: UpdateSyllabusInput
): Promise<{ data: Syllabus | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('syllabi')
      .update(toSyllabusUpdate(updates))
      .eq('id', syllabusId)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data ? mapSyllabusRow(data) : null, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const publishSyllabus = async (
  syllabusId: string
): Promise<{ data: Syllabus | null; error: ApiError | null }> => {
  return updateSyllabus(syllabusId, {
    status: 'published',
    published_at: new Date().toISOString(),
  });
};

export const archiveSyllabus = async (
  syllabusId: string
): Promise<{ data: Syllabus | null; error: ApiError | null }> => {
  return updateSyllabus(syllabusId, { status: 'archived' });
};

// ---------------------------------------------------------------------------
// Syllabus Sections
// ---------------------------------------------------------------------------

export const createSyllabusSection = async (
  input: CreateSyllabusSectionInput
): Promise<{ data: SyllabusSection | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('syllabus_sections')
      .insert(input)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data ? mapSyllabusSectionRow(data) : null, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const updateSyllabusSection = async (
  sectionId: string,
  updates: UpdateSyllabusSectionInput
): Promise<{ data: SyllabusSection | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('syllabus_sections')
      .update(updates)
      .eq('id', sectionId)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data ? mapSyllabusSectionRow(data) : null, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const deleteSyllabusSection = async (
  sectionId: string
): Promise<{ error: ApiError | null }> => {
  try {
    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from('syllabus_sections')
      .update({ active: false, deleted_at: deletedAt })
      .eq('id', sectionId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

export const reorderSyllabusSections = async (
  syllabusId: string,
  orderedIds: string[],
  swapPair?: [number, number]
): Promise<{ error: ApiError | null }> => {
  try {
    if (swapPair) {
      const [a, b] = swapPair;
      await Promise.all([
        supabase
          .from('syllabus_sections')
          .update({ order_index: a })
          .eq('id', orderedIds[a])
          .eq('syllabus_id', syllabusId),
        supabase
          .from('syllabus_sections')
          .update({ order_index: b })
          .eq('id', orderedIds[b])
          .eq('syllabus_id', syllabusId),
      ]).then((results) => {
        const err = results.find((r) => r.error);
        if (err?.error) throw err.error;
      });
    } else {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from('syllabus_sections')
            .update({ order_index: index })
            .eq('id', id)
            .eq('syllabus_id', syllabusId)
        )
      ).then((results) => {
        const err = results.find((r) => r.error);
        if (err?.error) throw err.error;
      });
    }

    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

// ---------------------------------------------------------------------------
// Grading Categories
// ---------------------------------------------------------------------------

export const createGradingCategory = async (
  input: CreateGradingCategoryInput
): Promise<{ data: GradingCategory | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('grading_categories')
      .insert(input)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data ? mapGradingCategoryRow(data) : null, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const updateGradingCategory = async (
  categoryId: string,
  updates: UpdateGradingCategoryInput
): Promise<{ data: GradingCategory | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('grading_categories')
      .update(updates)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data ? mapGradingCategoryRow(data) : null, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const deleteGradingCategory = async (
  categoryId: string
): Promise<{ error: ApiError | null }> => {
  try {
    const { error } = await supabase.from('grading_categories').delete().eq('id', categoryId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

// ---------------------------------------------------------------------------
// Assignment Linking
// ---------------------------------------------------------------------------

const ASSIGNMENT_ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const linkAssignmentToSection = async (
  assignmentId: string,
  sectionId: string,
  gradingCategoryId?: string | null
): Promise<{ error: ApiError | null }> => {
  try {
    if (!assignmentId || !ASSIGNMENT_ID_UUID.test(assignmentId)) {
      return { error: handleSupabaseError(new Error('Invalid assignment id')) };
    }
    const updates: Database['public']['Tables']['assignments']['Update'] = {
      syllabus_section_id: sectionId,
    };
    if (gradingCategoryId !== undefined) {
      updates.grading_category_id = gradingCategoryId;
    }
    const { error } = await supabase.from('assignments').update(updates).eq('id', assignmentId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

export const unlinkAssignmentFromSection = async (
  assignmentId: string
): Promise<{ error: ApiError | null }> => {
  try {
    if (!assignmentId || !ASSIGNMENT_ID_UUID.test(assignmentId)) {
      return { error: handleSupabaseError(new Error('Invalid assignment id')) };
    }
    const { error } = await supabase
      .from('assignments')
      .update({ syllabus_section_id: null, grading_category_id: null })
      .eq('id', assignmentId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

export const getAssignmentsBySection = async (
  sectionId: string
): Promise<{ data: SectionAssignmentSummary[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('id, title, type, status, due_at, syllabus_section_id, grading_category_id')
      .eq('syllabus_section_id', sectionId)
      .eq('active', true)
      .order('due_at', { ascending: true });

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data || [], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const getSectionAssignmentProgress = async (
  sectionId: string,
  studentId: string
): Promise<{
  data: { total: number; submitted: number; graded: number; progressPercent: number } | null;
  error: ApiError | null;
}> => {
  try {
    const { data: flowRows, error: flowErr } = await supabase
      .from('module_flow_steps')
      .select('step_kind, assignment_id, order_index')
      .eq('section_id', sectionId)
      .order('order_index', { ascending: true });
    if (flowErr) return { data: null, error: handleSupabaseError(flowErr) };

    let assignmentIds: string[];

    if (flowRows && flowRows.length > 0) {
      const seen = new Set<string>();
      assignmentIds = [];
      for (const row of flowRows as unknown as {
        step_kind: string;
        assignment_id: string | null;
      }[]) {
        if (row.step_kind === 'assignment' && row.assignment_id && !seen.has(row.assignment_id)) {
          seen.add(row.assignment_id);
          assignmentIds.push(row.assignment_id);
        }
      }
    } else {
      const { data: assignments, error: aErr } = await supabase
        .from('assignments')
        .select('id')
        .eq('syllabus_section_id', sectionId)
        .eq('active', true);
      if (aErr) return { data: null, error: handleSupabaseError(aErr) };
      if (!assignments || assignments.length === 0) {
        return { data: { total: 0, submitted: 0, graded: 0, progressPercent: 0 }, error: null };
      }
      assignmentIds = assignments.map((a) => a.id);
    }

    if (assignmentIds.length === 0) {
      return { data: { total: 0, submitted: 0, graded: 0, progressPercent: 0 }, error: null };
    }
    const { data: submissions, error: sErr } = await supabase
      .from('submissions')
      .select('id, status, assignment_id')
      .in('assignment_id', assignmentIds)
      .eq('student_id', studentId);
    if (sErr) return { data: null, error: handleSupabaseError(sErr) };

    const submitted = (submissions ?? []).filter((s) => {
      const status = s.status as string;
      return status === 'submitted' || status === 'completed';
    }).length;
    const graded = (submissions ?? []).filter((s) => s.status === 'completed').length;
    const total = assignmentIds.length;

    return {
      data: {
        total,
        submitted,
        graded,
        progressPercent: total > 0 ? Math.round((submitted / total) * 100) : 0,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/** Per-assignment: true if the student has any submission with status submitted or completed (matches getSectionAssignmentProgress). */
export const getAssignmentSubmittedOrCompletedMap = async (
  assignmentIds: string[],
  studentId: string
): Promise<{ data: Record<string, boolean>; error: ApiError | null }> => {
  try {
    if (assignmentIds.length === 0) {
      return { data: {}, error: null };
    }
    const { data, error } = await supabase
      .from('submissions')
      .select('assignment_id, status')
      .in('assignment_id', assignmentIds)
      .eq('student_id', studentId)
      .eq('is_teacher_attempt', false);
    if (error) return { data: {}, error: handleSupabaseError(error) };
    const map: Record<string, boolean> = {};
    assignmentIds.forEach((id) => {
      map[id] = false;
    });
    (data ?? []).forEach((row: { assignment_id?: string; status?: string }) => {
      const aid = row.assignment_id;
      if (!aid) return;
      if (row.status === 'submitted' || row.status === 'completed') {
        map[aid] = true;
      }
    });
    return { data: map, error: null };
  } catch (error) {
    return { data: {}, error: handleSupabaseError(error) };
  }
};
