/**
 * Syllabus Service
 * Handles all syllabus-related Supabase operations
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type { Database } from '@/integrations/supabase/types';
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
} from '@/types/syllabus';
import { createSectionResource, uploadResourceFile } from '@/services/syllabusResourceService';
import { normalizeReleaseMode } from '@/lib/releaseMode';

// ---------------------------------------------------------------------------
// Syllabus
// ---------------------------------------------------------------------------

export const getSyllabusByClassroom = async (
  classroomId: string
): Promise<{ data: SyllabusWithSections | null; error: ApiError | null }> => {
  try {
    const { data: syllabus, error: syllabusError } = await supabase
      .from('syllabi' as any)
      .select('*')
      .eq('classroom_id', classroomId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (syllabusError) return { data: null, error: handleSupabaseError(syllabusError) };
    if (!syllabus) return { data: null, error: null };

    const [sectionsResult, gradingResult] = await Promise.all([
      supabase
        .from('syllabus_sections' as any)
        .select('*')
        .eq('syllabus_id', (syllabus as any).id)
        .eq('active', true)
        .order('order_index', { ascending: true }),
      supabase
        .from('grading_categories' as any)
        .select('*')
        .eq('syllabus_id', (syllabus as any).id)
        .order('created_at', { ascending: true }),
    ]);

    const { data: sections, error: sectionsError } = sectionsResult;
    const { data: gradingCategories, error: gradingError } = gradingResult;

    if (sectionsError) return { data: null, error: handleSupabaseError(sectionsError) };
    if (gradingError) return { data: null, error: handleSupabaseError(gradingError) };

    const sectionIds = (sections as any[])?.map((s: any) => s.id) || [];
    let sectionResourcesMap: Record<string, any[]> = {};
    if (sectionIds.length > 0) {
      const { data: resources } = await supabase
        .from('activity_list' as any)
        .select('*')
        .in('section_id', sectionIds)
        .eq('active', true)
        .order('order_index', { ascending: true });

      if (resources) {
        (resources as any[]).forEach((r: any) => {
          if (!sectionResourcesMap[r.section_id]) sectionResourcesMap[r.section_id] = [];
          sectionResourcesMap[r.section_id].push(r);
        });
      }
    }

    const s = syllabus as any;
    return {
      data: {
        ...s,
        release_mode: normalizeReleaseMode(s.release_mode),
        sections: (sections as any[]) || [],
        grading_categories: (gradingCategories as any[]) || [],
        section_resources: sectionResourcesMap,
      } as SyllabusWithSections,
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
  classroomId: string,
): Promise<{ data: SyllabusWithSections | null; error: ApiError | null }> => {
  try {
    const { data: syllabus, error: syllabusError } = await supabase
      .from('syllabi' as any)
      .select('*')
      .eq('classroom_id', classroomId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (syllabusError) return { data: null, error: handleSupabaseError(syllabusError) };
    if (!syllabus) return { data: null, error: null };

    const { data: sections, error: sectionsError } = await supabase
      .from('syllabus_sections' as any)
      .select('*')
      .eq('syllabus_id', (syllabus as any).id)
      .eq('active', true)
      .order('order_index', { ascending: true });

    if (sectionsError) return { data: null, error: handleSupabaseError(sectionsError) };

    const s = syllabus as any;
    return {
      data: {
        ...s,
        release_mode: normalizeReleaseMode(s.release_mode),
        sections: (sections as any[]) || [],
        grading_categories: [],
        section_resources: {},
      } as SyllabusWithSections,
      error: null,
    };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

const DEFAULT_SYLLABUS_INSERT = {
  release_mode: 'all_at_once' as const,
  published_at: null as string | null,
  accent_color: null as string | null,
  banner_url: null as string | null,
  section_label_override: null as string | null,
  custom_settings: {} as Record<string, unknown>,
};

export const createSyllabus = async (
  input: CreateSyllabusInput
): Promise<{ data: Syllabus | null; error: ApiError | null }> => {
  try {
    let published_at = input.published_at ?? DEFAULT_SYLLABUS_INSERT.published_at;
    if (input.status === 'published' && !published_at) {
      published_at = new Date().toISOString();
    }
    const row = {
      ...input,
      release_mode: input.release_mode ?? DEFAULT_SYLLABUS_INSERT.release_mode,
      published_at,
      accent_color: input.accent_color ?? DEFAULT_SYLLABUS_INSERT.accent_color,
      banner_url: input.banner_url ?? DEFAULT_SYLLABUS_INSERT.banner_url,
      section_label_override: input.section_label_override ?? DEFAULT_SYLLABUS_INSERT.section_label_override,
      custom_settings: input.custom_settings ?? DEFAULT_SYLLABUS_INSERT.custom_settings,
    };
    const { data, error } = await supabase
      .from('syllabi' as any)
      .insert([row] as any)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as Syllabus, error: null };
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

    const syllabusId = (syllabus as Syllabus).id;

    if (bundle.gradingCategories.length > 0) {
      const catRows = bundle.gradingCategories
        .filter((c) => c.name.trim())
        .map((c) => ({
          syllabus_id: syllabusId,
          name: c.name,
          weight: c.weight,
        }));
      if (catRows.length > 0) {
        const { error: catError } = await supabase.from('grading_categories' as any).insert(catRows as any);
        if (catError) return { data: null, error: handleSupabaseError(catError) };
      }
    }

    const sections = bundle.sections;
    if (sections.length === 0) {
      return { data: syllabus as Syllabus, error: null };
    }

    const phaseARows = sections.map((s) => ({
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
      prerequisites: [] as string[],
      is_locked: s.is_locked,
    }));

    const { data: createdSections, error: sectionsError } = await supabase
      .from('syllabus_sections' as any)
      .insert(phaseARows as any)
      .select();

    if (sectionsError) return { data: null, error: handleSupabaseError(sectionsError) };
    const dbRows = ((createdSections as any[]) || []).slice() as Array<{ id: string; order_index: number }>;
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
        const { error: upErr } = await supabase
          .from('syllabus_sections' as any)
          .update({ prerequisites: prereqIds } as any)
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
            url: result.publicUrl,
            mime_type: item.file.type || null,
            file_size: item.file.size,
            order_index: orderIdx++,
          });
          if (rErr) return { data: null, error: rErr };
        }
      }
    }

    return { data: syllabus as Syllabus, error: null };
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
      .from('syllabi' as any)
      .update(updates as any)
      .eq('id', syllabusId)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as Syllabus, error: null };
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
      .from('syllabus_sections' as any)
      .insert([input] as any)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as SyllabusSection, error: null };
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
      .from('syllabus_sections' as any)
      .update(updates as any)
      .eq('id', sectionId)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as SyllabusSection, error: null };
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
      .from('syllabus_sections' as any)
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
          .from('syllabus_sections' as any)
          .update({ order_index: a } as any)
          .eq('id', orderedIds[a])
          .eq('syllabus_id', syllabusId),
        supabase
          .from('syllabus_sections' as any)
          .update({ order_index: b } as any)
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
            .from('syllabus_sections' as any)
            .update({ order_index: index } as any)
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
      .from('grading_categories' as any)
      .insert([input] as any)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as GradingCategory, error: null };
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
      .from('grading_categories' as any)
      .update(updates as any)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as GradingCategory, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const deleteGradingCategory = async (
  categoryId: string
): Promise<{ error: ApiError | null }> => {
  try {
    const { error } = await supabase
      .from('grading_categories' as any)
      .delete()
      .eq('id', categoryId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

// ---------------------------------------------------------------------------
// Assignment Linking
// ---------------------------------------------------------------------------

const ASSIGNMENT_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
): Promise<{ data: any[] | null; error: ApiError | null }> => {
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
): Promise<{ data: { total: number; submitted: number; graded: number; progressPercent: number } | null; error: ApiError | null }> => {
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
      for (const row of flowRows as unknown as { step_kind: string; assignment_id: string | null }[]) {
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
      assignmentIds = assignments.map((a: any) => a.id);
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

    const submitted = (submissions || []).filter((s: any) => s.status === 'submitted' || s.status === 'completed').length;
    const graded = (submissions || []).filter((s: any) => s.status === 'completed').length;
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
  studentId: string,
): Promise<{ data: Record<string, boolean>; error: ApiError | null }> => {
  try {
    if (assignmentIds.length === 0) {
      return { data: {}, error: null };
    }
    const { data, error } = await supabase
      .from('submissions')
      .select('assignment_id, status')
      .in('assignment_id', assignmentIds)
      .eq('student_id', studentId);
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
