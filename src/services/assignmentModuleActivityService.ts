/**
 * Assignment ↔ module activity (section_resource) links for AI context and UX.
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type { ApiError } from '@/types';
import type {
  AssignmentModuleActivity,
  AssignmentModuleActivityInput,
} from '@/types/syllabus';

const TABLE = 'assignment_module_activities' as const;

export async function getLinkedActivitiesForAssignment(
  assignmentId: string,
): Promise<{ data: AssignmentModuleActivity[] | null; error: ApiError | null }> {
  try {
    const { data, error } = await supabase
      .from(TABLE as any)
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('order_index', { ascending: true });

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data as AssignmentModuleActivity[]) || [], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
}

export async function getSectionResourceIdsForSectionInOrder(
  sectionId: string,
): Promise<{ data: string[] | null; error: ApiError | null }> {
  try {
    const { data, error } = await supabase
      .from('section_resources' as any)
      .select('id')
      .eq('section_id', sectionId)
      .order('order_index', { ascending: true });

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data as { id: string }[]).map((r) => r.id), error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
}

/**
 * Validates that every section_resource_id belongs to the given syllabus section.
 */
async function validateLinksBelongToSection(
  sectionId: string,
  items: AssignmentModuleActivityInput[],
): Promise<{ ok: boolean; error: ApiError | null }> {
  if (items.length === 0) return { ok: true, error: null };
  const ids = items.map((i) => i.section_resource_id);
  const { data, error } = await supabase
    .from('section_resources' as any)
    .select('id')
    .eq('section_id', sectionId)
    .in('id', ids);

  if (error) return { ok: false, error: handleSupabaseError(error) };
  const allowed = new Set((data as { id: string }[] | null)?.map((r) => r.id) ?? []);
  for (const id of ids) {
    if (!allowed.has(id)) {
      return {
        ok: false,
        error: { message: `Activity ${id} does not belong to the selected module` } as ApiError,
      };
    }
  }
  return { ok: true, error: null };
}

/**
 * Replace all links for an assignment. Pass empty array to clear.
 */
export async function setAssignmentLinkedActivities(
  assignmentId: string,
  syllabusSectionId: string | null,
  items: AssignmentModuleActivityInput[],
): Promise<{ error: ApiError | null }> {
  try {
    if (!syllabusSectionId) {
      if (items.length > 0) {
        return {
          error: { message: 'Pick a syllabus module before linking activities' } as ApiError,
        };
      }
      const { error } = await supabase.from(TABLE as any).delete().eq('assignment_id', assignmentId);
      if (error) return { error: handleSupabaseError(error) };
      return { error: null };
    }

    const { ok, error: vErr } = await validateLinksBelongToSection(syllabusSectionId, items);
    if (!ok) return { error: vErr };

    const { error: delErr } = await supabase.from(TABLE as any).delete().eq('assignment_id', assignmentId);
    if (delErr) return { error: handleSupabaseError(delErr) };

    if (items.length === 0) return { error: null };

    const rows = items.map((item) => ({
      assignment_id: assignmentId,
      section_resource_id: item.section_resource_id,
      order_index: item.order_index,
      include_in_ai_context: item.include_in_ai_context,
    }));

    const { error: insErr } = await supabase.from(TABLE as any).insert(rows as any);
    if (insErr) return { error: handleSupabaseError(insErr) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
}

/**
 * Default: all module activities linked, in order, all included in AI context.
 */
export async function setDefaultLinksForAssignmentFromSection(
  assignmentId: string,
  syllabusSectionId: string,
): Promise<{ error: ApiError | null }> {
  const { data: ids, error } = await getSectionResourceIdsForSectionInOrder(syllabusSectionId);
  if (error) return { error };
  const items: AssignmentModuleActivityInput[] = (ids || []).map((id, i) => ({
    section_resource_id: id,
    order_index: i,
    include_in_ai_context: true,
  }));
  return setAssignmentLinkedActivities(assignmentId, syllabusSectionId, items);
}
