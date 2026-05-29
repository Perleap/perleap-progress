import type { ModuleFlowStep, SectionResource } from '@/types/syllabus';
import {
  getOrderedActivityCenterFlowSteps,
  type OrderedActivityCenterFlowStepsOptions,
} from '@/lib/moduleFlow';
import { persistedStepDone, type StudentFlowProgressContext } from '@/lib/moduleFlowStudent';

export type SectionModuleProgressStats = {
  total: number;
  done: number;
  percent: number;
};

/** Minimal assignment shape for counting (matches section-linked list items). */
export type SectionModuleLinkedAssignmentRef = { id: string };

/**
 * Progress for a single syllabus section — matches {@link SectionContentPage} module bar:
 * persisted flow steps when present, otherwise linked assignments only.
 */
export function computeSectionModuleProgressStats(opts: {
  persistedSteps: ModuleFlowStep[];
  resources: SectionResource[];
  linkedAssignments: SectionModuleLinkedAssignmentRef[];
  flowCtx: StudentFlowProgressContext;
  flowStepOptions?: OrderedActivityCenterFlowStepsOptions;
}): SectionModuleProgressStats {
  const { persistedSteps, resources, linkedAssignments, flowCtx, flowStepOptions } = opts;

  const orderedFlow =
    persistedSteps.length > 0
      ? getOrderedActivityCenterFlowSteps(persistedSteps, resources, flowStepOptions)
      : [];

  if (orderedFlow.length > 0) {
    const assignmentById: Record<string, SectionModuleLinkedAssignmentRef> = {};
    linkedAssignments.forEach((a) => {
      assignmentById[a.id] = a;
    });
    const resourceById: Record<string, SectionResource> = {};
    resources.forEach((r) => {
      resourceById[r.id] = r;
    });

    let total = 0;
    let done = 0;
    orderedFlow.forEach((step, i) => {
      if (step.step_kind === 'resource' && step.activity_list_id) {
        if (!resourceById[step.activity_list_id]) return;
        total += 1;
        if (persistedStepDone(step, orderedFlow, i, flowCtx)) done += 1;
      } else if (step.step_kind === 'assignment' && step.assignment_id) {
        if (!assignmentById[step.assignment_id]) return;
        total += 1;
        if (persistedStepDone(step, orderedFlow, i, flowCtx)) done += 1;
      }
    });

    return {
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }

  const total = linkedAssignments.length;
  let done = 0;
  for (const a of linkedAssignments) {
    if (flowCtx.assignmentDoneMap[a.id]) done += 1;
  }

  return {
    total,
    done,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}
