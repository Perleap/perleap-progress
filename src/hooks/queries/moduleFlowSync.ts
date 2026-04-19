/**
 * Persist module_flow_steps to match resolveDisplayedModuleFlow (curriculum + student Activities).
 */

import type { QueryClient } from '@tanstack/react-query';
import { assignmentKeys } from '@/hooks/queries/useAssignmentQueries';
import { syllabusKeys } from '@/hooks/queries/useSyllabusQueries';
import { moduleFlowKeys } from '@/hooks/queries/useModuleFlowQueries';
import { buildResolvedModuleFlowStepInputs } from '@/lib/moduleFlow';
import { getModuleFlowSteps, replaceModuleFlowSteps } from '@/services/moduleFlowService';
import type { SyllabusWithSections } from '@/types/syllabus';

export async function syncModuleFlowToResolvedDisplayForSection(
  queryClient: QueryClient,
  classroomId: string,
  sectionId: string,
): Promise<void> {
  await queryClient.refetchQueries({ queryKey: assignmentKeys.listByClassroom(classroomId) });
  await queryClient.refetchQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
  const assignments = queryClient.getQueryData<
    { id: string; syllabus_section_id?: string | null; due_at?: string | null }[]
  >(assignmentKeys.listByClassroom(classroomId));
  const syllabus = queryClient.getQueryData<SyllabusWithSections | null>(
    syllabusKeys.byClassroom(classroomId),
  );
  const resources = syllabus?.section_resources?.[sectionId] ?? [];
  const { data: persisted, error: fetchErr } = await getModuleFlowSteps(sectionId);
  if (fetchErr) {
    console.error('module flow fetch before sync:', fetchErr);
    return;
  }
  const steps = buildResolvedModuleFlowStepInputs(sectionId, resources, assignments ?? [], persisted ?? []);
  const { error: repErr } = await replaceModuleFlowSteps(sectionId, steps);
  if (repErr) {
    console.error('module flow sync after assignment save:', repErr);
  }
  await queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all });
}
