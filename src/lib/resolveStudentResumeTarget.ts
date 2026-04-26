/**
 * First activity/assignment the student should open when resuming a course (About CTA).
 */

import {
  computeDefaultModuleFlow,
  getOrderedActivityCenterFlowSteps,
  type AssignmentRow,
  type ComputedFlowItem,
} from '@/lib/moduleFlow';
import { getFirstNavigableInSection, type FlowStepTarget } from '@/lib/moduleFlowNavigation';
import {
  firstIncompleteComputedIndex,
  firstIncompletePersistedIndex,
  type StudentFlowProgressContext,
} from '@/lib/moduleFlowStudent';
import { isSectionUnlocked } from '@/lib/sectionUnlock';
import type { ReleaseMode, StudentProgressStatus, SyllabusSection } from '@/types/syllabus';
import type { ModuleFlowStep, SectionResource } from '@/types/syllabus';

function persistedStepToTarget(step: ModuleFlowStep): FlowStepTarget | null {
  if (step.step_kind === 'resource' && step.activity_list_id) {
    return { kind: 'resource', id: step.activity_list_id };
  }
  if (step.step_kind === 'assignment' && step.assignment_id) {
    return { kind: 'assignment', id: step.assignment_id };
  }
  return null;
}

function computedItemToTarget(c: ComputedFlowItem): FlowStepTarget {
  if (c.kind === 'resource') {
    return { kind: 'resource', id: c.activity_list_id };
  }
  return { kind: 'assignment', id: c.assignment_id };
}

export function resolveStudentResumeTarget(params: {
  sections: SyllabusSection[];
  releaseMode: ReleaseMode;
  studentProgressMap: Record<string, StudentProgressStatus>;
  flowBulk: Record<string, ModuleFlowStep[]>;
  resourceMap: Record<string, SectionResource[]>;
  assignments: AssignmentRow[];
  flowCtx: StudentFlowProgressContext;
}): FlowStepTarget | null {
  const { releaseMode, studentProgressMap, flowBulk, resourceMap, assignments, flowCtx } = params;
  const sorted = [...params.sections].sort((a, b) => a.order_index - b.order_index);

  for (const section of sorted) {
    if (!isSectionUnlocked(section, sorted, releaseMode, studentProgressMap)) {
      continue;
    }
    const persisted = flowBulk[section.id] ?? [];
    const sectionResources = resourceMap[section.id] ?? [];
    const orderedPersisted = getOrderedActivityCenterFlowSteps(persisted, sectionResources);

    if (orderedPersisted.length > 0) {
      const idx = firstIncompletePersistedIndex(orderedPersisted, flowCtx);
      if (idx >= 0) {
        const target = persistedStepToTarget(orderedPersisted[idx]);
        if (target) return target;
      }
      continue;
    }

    const computed = computeDefaultModuleFlow(section.id, sectionResources, assignments);
    if (computed.length > 0) {
      const cidx = firstIncompleteComputedIndex(computed, flowCtx);
      if (cidx >= 0) {
        return computedItemToTarget(computed[cidx]);
      }
    }
  }

  if (sorted.length > 0) {
    const first = sorted[0];
    return getFirstNavigableInSection({
      sectionId: first.id,
      sectionResources: resourceMap[first.id] ?? [],
      assignments,
      persistedSteps: flowBulk[first.id] ?? [],
    });
  }

  return null;
}
