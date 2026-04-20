/**
 * Module flow: ordered activities (section_resources) + assignments per section.
 */

import { supabase, handleSupabaseError } from '@/api/client';
import { SUBMISSION_STATUS } from '@/config/constants';
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
      .from('module_flow_steps' as any)
      .select('*')
      .in('section_id', sectionIds);

    if (error) return { data: null, error: handleSupabaseError(error) };
    const rows = ((data as any[]) as ModuleFlowStep[]).slice();
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
      .from('module_flow_steps' as any)
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

    const { error: rpcErr } = await supabase.rpc('replace_module_flow_steps' as any, {
      p_section_id: sectionId,
      p_steps: payload,
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

export const getStudentModuleFlowProgress = async (
  studentId: string,
  stepIds: string[],
): Promise<{ data: StudentModuleFlowProgress[] | null; error: ApiError | null }> => {
  try {
    if (stepIds.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
      .from('student_module_flow_progress' as any)
      .select('*')
      .eq('student_id', studentId)
      .in('module_flow_step_id', stepIds);

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data as any[]) as StudentModuleFlowProgress[], error: null };
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
      .from('student_module_flow_progress' as any)
      .select('id')
      .eq('student_id', studentId)
      .eq('module_flow_step_id', moduleFlowStepId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('student_module_flow_progress' as any)
        .update({
          status,
          completed_at: status === 'completed' ? now : null,
        })
        .eq('id', (existing as any).id)
        .select()
        .single();

      if (error) return { data: null, error: handleSupabaseError(error) };
      return { data: data as any as StudentModuleFlowProgress, error: null };
    }

    const { data, error } = await supabase
      .from('student_module_flow_progress' as any)
      .insert({
        student_id: studentId,
        module_flow_step_id: moduleFlowStepId,
        status,
        completed_at: status === 'completed' ? now : null,
      })
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as StudentModuleFlowProgress, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

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
