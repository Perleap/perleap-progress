import type { ModuleFlowStep, SectionResource } from '@/types/syllabus';
import {
  computeDefaultModuleFlow,
  getOrderedActivityCenterFlowSteps,
  type AssignmentRow,
} from '@/lib/moduleFlow';

/**
 * Step + assignment IDs needed for student module-flow progress queries.
 * Mirrors {@link prefetchStudentTimelineFlowProgressCaches} and {@link useStudentCurriculumFlowContext}.
 */
export function deriveStudentTimelineFlowPrefetchIndices(args: {
  sectionIds: string[];
  resourceMap: Record<string, SectionResource[]>;
  flowBulk: Record<string, ModuleFlowStep[]>;
  assigns: AssignmentRow[];
}): { allStepIds: string[]; assignmentIdsSortedJoin: string } {
  const { sectionIds, resourceMap, flowBulk, assigns } = args;
  const allStepIds: string[] = [];
  const assignmentIds = new Set<string>();

  sectionIds.forEach((sid) => {
    const persisted = flowBulk[sid] ?? [];
    const resources = resourceMap[sid] ?? [];
    const ordered = getOrderedActivityCenterFlowSteps(persisted, resources);
    ordered.forEach((s) => {
      allStepIds.push(s.id);
      if (s.step_kind === 'assignment' && s.assignment_id) assignmentIds.add(s.assignment_id);
    });
    computeDefaultModuleFlow(sid, resources, assigns).forEach((c) => {
      if (c.kind === 'assignment') assignmentIds.add(c.assignment_id);
    });
  });

  const assignmentIdsSortedJoin = [...assignmentIds].sort().join(',');
  return { allStepIds, assignmentIdsSortedJoin };
}
