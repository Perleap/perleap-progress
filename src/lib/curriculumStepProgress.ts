import type { ModuleFlowStep, SectionResource, SyllabusSection } from '@/types/syllabus';
import {
  computeDefaultModuleFlow,
  getOrderedActivityCenterFlowSteps,
  type AssignmentRow,
} from '@/lib/moduleFlow';
import {
  computedFlowItemDoneForProgress,
  persistedStepDone,
  type StudentFlowProgressContext,
} from '@/lib/moduleFlowStudent';
import { sectionsInCourseOrder } from '@/lib/sectionUnlock';

export type CurriculumStepProgress = {
  done: number;
  total: number;
  percent: number;
};

/** Minimal assignment shape needed to count progress (matches SectionContentPage linked list items). */
export type LinkedAssignmentRef = { id: string };

export function aggregateCurriculumStepProgress(params: {
  sections: SyllabusSection[];
  flowBulk: Record<string, ModuleFlowStep[]>;
  sectionResources: Record<string, SectionResource[]>;
  linkedAssignmentsMap: Record<string, LinkedAssignmentRef[]>;
  assignments: AssignmentRow[];
  flowCtx: StudentFlowProgressContext;
  /** When set (e.g. resume target module), only that section counts — matches “Continue: this unit” headline. */
  onlySectionId?: string | null;
}): CurriculumStepProgress {
  const {
    sections,
    flowBulk,
    sectionResources,
    linkedAssignmentsMap,
    assignments,
    flowCtx,
    onlySectionId,
  } = params;

  let done = 0;
  let total = 0;

  let ordered = sectionsInCourseOrder(sections);
  if (onlySectionId) {
    ordered = ordered.filter((s) => s.id === onlySectionId);
  }

  for (const sec of ordered) {
    const sectionId = sec.id;
    const resources = sectionResources[sectionId] ?? [];
    const persisted = flowBulk[sectionId] ?? [];
    const linkedAssigns = linkedAssignmentsMap[sectionId] ?? [];

    const orderedPersisted = getOrderedActivityCenterFlowSteps(persisted, resources);
    const computed = computeDefaultModuleFlow(sectionId, resources, assignments);
    const usePersisted = orderedPersisted.length > 0;

    const assignmentById: Record<string, LinkedAssignmentRef> = {};
    linkedAssigns.forEach((a) => {
      assignmentById[a.id] = a;
    });
    const resourceById: Record<string, SectionResource> = {};
    resources.forEach((r) => {
      resourceById[r.id] = r;
    });

    let sectionDone = 0;
    let sectionTotal = 0;

    if (usePersisted) {
      orderedPersisted.forEach((step, i) => {
        if (step.step_kind === 'resource' && step.activity_list_id) {
          if (!resourceById[step.activity_list_id]) return;
          sectionTotal += 1;
          if (persistedStepDone(step, orderedPersisted, i, flowCtx)) sectionDone += 1;
        } else if (step.step_kind === 'assignment' && step.assignment_id) {
          if (!assignmentById[step.assignment_id]) return;
          sectionTotal += 1;
          if (persistedStepDone(step, orderedPersisted, i, flowCtx)) sectionDone += 1;
        }
      });
    } else {
      sectionTotal = computed.length;
      for (let i = 0; i < computed.length; i++) {
        if (computedFlowItemDoneForProgress(computed[i], computed, i, flowCtx)) sectionDone += 1;
      }
    }

    done += sectionDone;
    total += sectionTotal;
  }

  return {
    done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}
