/**
 * Module flow: ordered activities (section_resources) + assignments per section.
 */

import { supabase, handleSupabaseError } from '@/api/client';
import { SUBMISSION_STATUS } from '@/config/constants';
import type { Json } from '@/integrations/supabase/types';
import type { ApiError } from '@/types';
import type {
  ModuleFlowStep,
  StudentModuleFlowProgress,
  StudentModuleFlowProgressStatus,
} from '@/types/syllabus';

export const getModuleFlowStepsBySections = async (
  sectionIds: string[],
): Promise<{ data: ModuleFlowStep[] | null; error: ApiError | null }> => {
  try {
    if (sectionIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('module_flow_steps')
      .select('*')
      .in('section_id', sectionIds);

    if (error) return { data: null, error: handleSupabaseError(error) };
    const rows = ((data ?? []) as unknown as ModuleFlowStep[]).slice();
    rows.sort((a, b) => {
      if (a.section_id !== b.section_id) return a.section_id.localeCompare(b.section_id);
      return a.order_index - b.order_index;
    });
    return { data: rows, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const getModuleFlowSteps = async (
  sectionId: string,
): Promise<{ data: ModuleFlowStep[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('module_flow_steps')
      .select('*')
      .eq('section_id', sectionId)
      .order('order_index', { ascending: true });

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: ((data ?? []) as any[]) as ModuleFlowStep[], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export type FlowStepInput = {
  order_index: number;
  step_kind: 'resource' | 'assignment';
  activity_list_id?: string | null;
  assignment_id?: string | null;
};

/**
 * Replace all flow steps for a section (delete + insert). See plan: teacher save persists rows.
 * Serialized per `sectionId` so concurrent callers (e.g. syllabus save + assignment wizard) cannot
 * interleave delete/insert and hit UNIQUE(section_id, order_index) with 409.
 */
const __replaceModuleFlowTailBySection = new Map<string, Promise<unknown>>();

async function replaceModuleFlowStepsImpl(
  sectionId: string,
  steps: FlowStepInput[],
): Promise<{ error: ApiError | null }> {
  try {
    const payload = steps.map((s) => ({
      order_index: s.order_index,
      step_kind: s.step_kind,
      activity_list_id: s.step_kind === 'resource' ? s.activity_list_id : null,
      assignment_id: s.step_kind === 'assignment' ? s.assignment_id : null,
    }));

    const { error: rpcErr } = await supabase.rpc('replace_module_flow_steps', {
      p_section_id: sectionId,
      p_steps: payload as unknown as Json,
    });

    if (rpcErr) return { error: handleSupabaseError(rpcErr) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
}

export const replaceModuleFlowSteps = (
  sectionId: string,
  steps: FlowStepInput[],
): Promise<{ error: ApiError | null }> => {
  const prev = __replaceModuleFlowTailBySection.get(sectionId) ?? Promise.resolve();
  const job = prev.then(() => replaceModuleFlowStepsImpl(sectionId, steps));
  __replaceModuleFlowTailBySection.set(sectionId, job.catch(() => {}));
  return job;
};

function moduleFlowStepsToReplaceInput(steps: ModuleFlowStep[]): FlowStepInput[] {
  return steps.map((s, order_index) => ({
    order_index,
    step_kind: s.step_kind,
    activity_list_id: s.step_kind === 'resource' ? s.activity_list_id : null,
    assignment_id: s.step_kind === 'assignment' ? s.assignment_id : null,
  }));
}

/**
 * Remove all module_flow_steps rows that reference this assignment (per section via replace RPC
 * so student_module_flow_progress is remapped). Call after soft-deleting an assignment.
 */
export const removeAssignmentFromModuleFlows = async (
  assignmentId: string,
): Promise<{ error: ApiError | null }> => {
  try {
    const { data: refs, error: refErr } = await supabase
      .from('module_flow_steps')
      .select('section_id')
      .eq('assignment_id', assignmentId);

    if (refErr) return { error: handleSupabaseError(refErr) };

    const sectionIds = [
      ...new Set((refs ?? []).map((r) => r.section_id)),
    ];
    if (sectionIds.length === 0) return { error: null };

    for (const sectionId of sectionIds) {
      const { data: current, error: loadErr } = await getModuleFlowSteps(sectionId);
      if (loadErr) return { error: loadErr };
      const rows = current ?? [];
      const kept = rows.filter(
        (s) => !(s.step_kind === 'assignment' && s.assignment_id === assignmentId),
      );
      const { error: repErr } = await replaceModuleFlowSteps(sectionId, moduleFlowStepsToReplaceInput(kept));
      if (repErr) return { error: repErr };
    }

    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

export const getStudentModuleFlowProgress = async (
  studentId: string,
  stepIds: string[],
): Promise<{ data: StudentModuleFlowProgress[] | null; error: ApiError | null }> => {
  try {
    if (stepIds.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
      .from('student_module_flow_progress')
      .select('*')
      .eq('student_id', studentId)
      .in('module_flow_step_id', stepIds);

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data ?? []) as unknown as StudentModuleFlowProgress[], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const upsertStudentModuleFlowProgress = async (
  studentId: string,
  moduleFlowStepId: string,
  status: StudentModuleFlowProgressStatus,
): Promise<{ data: StudentModuleFlowProgress | null; error: ApiError | null }> => {
  try {
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from('student_module_flow_progress')
      .select('id')
      .eq('student_id', studentId)
      .eq('module_flow_step_id', moduleFlowStepId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('student_module_flow_progress')
        .update({
          status,
          completed_at: status === 'completed' ? now : null,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: data as unknown as StudentModuleFlowProgress, error: null };
    }

    const { data, error } = await supabase
      .from('student_module_flow_progress')
      .insert({
        student_id: studentId,
        module_flow_step_id: moduleFlowStepId,
        status,
        completed_at: status === 'completed' ? now : null,
      })
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as unknown as StudentModuleFlowProgress, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/** Chunk size for `.in('assignment_id', …)` to stay within PostgREST / URL limits. */
const ASSIGNMENT_COMPLETED_MAP_CHUNK = 150;

/** True if student has a completed submission for this assignment. */
export const hasCompletedAssignmentSubmission = async (
  assignmentId: string,
  studentId: string,
): Promise<{ completed: boolean; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('id, status')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .eq('status', SUBMISSION_STATUS.COMPLETED);

    if (error) return { completed: false, error: handleSupabaseError(error) };
    return { completed: (data?.length ?? 0) > 0, error: null };
  } catch (error) {
    return { completed: false, error: handleSupabaseError(error) };
  }
};

export type AssignmentFlowProgressMaps = {
  /** At least one row with status completed (same as {@link hasCompletedAssignmentSubmission}). */
  completedMap: Record<string, boolean>;
  /** At least one submission row for this assignment (any status). */
  hasAnyRowMap: Record<string, boolean>;
};

/**
 * Bulk maps for curriculum flow: completed attempts + any submission presence (for due-date / access UI).
 */
export const getAssignmentFlowProgressMaps = async (
  assignmentIds: string[],
  studentId: string,
): Promise<{ data: AssignmentFlowProgressMaps; error: ApiError | null }> => {
  try {
    const unique = [...new Set(assignmentIds.filter(Boolean))];
    if (unique.length === 0) {
      return { data: { completedMap: {}, hasAnyRowMap: {} }, error: null };
    }

    const completedMap: Record<string, boolean> = {};
    const hasAnyRowMap: Record<string, boolean> = {};
    unique.forEach((id) => {
      completedMap[id] = false;
      hasAnyRowMap[id] = false;
    });

    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += ASSIGNMENT_COMPLETED_MAP_CHUNK) {
      chunks.push(unique.slice(i, i + ASSIGNMENT_COMPLETED_MAP_CHUNK));
    }

    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        supabase
          .from('submissions')
          .select('assignment_id, status')
          .in('assignment_id', chunk)
          .eq('student_id', studentId),
      ),
    );

    for (const { data, error } of chunkResults) {
      if (error) {
        return {
          data: { completedMap: {}, hasAnyRowMap: {} },
          error: handleSupabaseError(error),
        };
      }
      (data ?? []).forEach((row: { assignment_id?: string | null; status?: string | null }) => {
        const aid = row.assignment_id;
        if (!aid) return;
        hasAnyRowMap[aid] = true;
        if (row.status === SUBMISSION_STATUS.COMPLETED) {
          completedMap[aid] = true;
        }
      });
    }

    return { data: { completedMap, hasAnyRowMap }, error: null };
  } catch (error) {
    return {
      data: { completedMap: {}, hasAnyRowMap: {} },
      error: handleSupabaseError(error),
    };
  }
};
