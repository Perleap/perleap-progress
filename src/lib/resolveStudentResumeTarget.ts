/**
 * First activity/assignment the student should open when resuming a course (About CTA).
 */

import {
  getOrderedActivityCenterFlowSteps,
  resolveDisplayedModuleFlow,
  type AssignmentRow,
  type ModuleFlowLocalStep,
} from '@/lib/moduleFlow';
import type { FlowStepTarget } from '@/lib/moduleFlowNavigation';
import type { StudentFlowProgressContext } from '@/lib/moduleFlowStudent';
import { isAssignmentMissedDeadline } from '@/lib/moduleFlowStudent';
import { isSectionUnlocked } from '@/lib/sectionUnlock';
import type { ReleaseMode, StudentProgressStatus, SyllabusSection, ModuleFlowStep, SectionResource } from '@/types/syllabus';

export type StudentResumeTargetHit = { target: FlowStepTarget; sectionId: string };

/** Mirrors persisted resource completion (step row or any later assignment in this list done). */
function localResourceStepDone(
  local: ModuleFlowLocalStep[],
  index: number,
  ctx: StudentFlowProgressContext,
  orderedPersisted: ModuleFlowStep[],
): boolean {
  const step = local[index];
  if (step.kind !== 'resource') return false;
  const persistedRow = orderedPersisted.find(
    (p) => p.step_kind === 'resource' && p.activity_list_id === step.resourceId,
  );
  if (persistedRow && ctx.progressByStep[persistedRow.id]) return true;
  for (let k = index + 1; k < local.length; k++) {
    const later = local[k];
    if (later.kind === 'assignment' && (ctx.assignmentDoneMap[later.assignmentId] ?? false)) {
      return true;
    }
  }
  return false;
}

function localStepDone(
  local: ModuleFlowLocalStep[],
  index: number,
  ctx: StudentFlowProgressContext,
  persisted: ModuleFlowStep[],
  sectionResources: SectionResource[],
): boolean {
  const step = local[index];
  if (step.kind === 'assignment') {
    return ctx.assignmentDoneMap[step.assignmentId] ?? false;
  }
  const orderedPersisted = getOrderedActivityCenterFlowSteps(persisted, sectionResources);
  return localResourceStepDone(local, index, ctx, orderedPersisted);
}

function localPreviousStepsComplete(
  local: ModuleFlowLocalStep[],
  index: number,
  ctx: StudentFlowProgressContext,
  persisted: ModuleFlowStep[],
  sectionResources: SectionResource[],
  assignments: AssignmentRow[],
  now: Date,
): boolean {
  if (index === 0) return true;
  for (let i = 0; i < index; i++) {
    if (localStepDone(local, i, ctx, persisted, sectionResources)) continue;
    const step = local[i];
    if (step.kind === 'assignment' && isAssignmentMissedDeadline(step.assignmentId, assignments, ctx, now)) {
      continue;
    }
    return false;
  }
  return true;
}

/**
 * Same ordering as Curriculum / outline (resolveDisplayedModuleFlow), including assignments
 * appended when the teacher flow omits them.
 */
function firstIncompleteInDisplayedFlow(
  sectionId: string,
  sectionResources: SectionResource[],
  assignments: AssignmentRow[],
  persisted: ModuleFlowStep[],
  ctx: StudentFlowProgressContext,
  now: Date,
): FlowStepTarget | null {
  const local = resolveDisplayedModuleFlow(sectionId, sectionResources, assignments, persisted);
  for (let i = 0; i < local.length; i++) {
    if (!localPreviousStepsComplete(local, i, ctx, persisted, sectionResources, assignments, now)) continue;
    if (!localStepDone(local, i, ctx, persisted, sectionResources)) {
      const s = local[i];
      if (s.kind === 'assignment' && isAssignmentMissedDeadline(s.assignmentId, assignments, ctx, now)) {
        continue;
      }
      if (s.kind === 'resource') return { kind: 'resource', id: s.resourceId };
      return { kind: 'assignment', id: s.assignmentId };
    }
  }
  return null;
}

export function resolveStudentResumeTargetWithSection(params: {
  sections: SyllabusSection[];
  releaseMode: ReleaseMode;
  studentProgressMap: Record<string, StudentProgressStatus>;
  flowBulk: Record<string, ModuleFlowStep[]>;
  resourceMap: Record<string, SectionResource[]>;
  assignments: AssignmentRow[];
  flowCtx: StudentFlowProgressContext;
  /** Clock for due-date checks (tests should pass a fixed instant). */
  now?: Date;
}): StudentResumeTargetHit | null {
  const { releaseMode, studentProgressMap, flowBulk, resourceMap, assignments, flowCtx } = params;
  const now = params.now ?? new Date();
  const sorted = [...params.sections].sort((a, b) => a.order_index - b.order_index);

  for (const section of sorted) {
    if (!isSectionUnlocked(section, sorted, releaseMode, studentProgressMap)) {
      continue;
    }
    const persisted = flowBulk[section.id] ?? [];
    const sectionResources = resourceMap[section.id] ?? [];

    const fromDisplayed = firstIncompleteInDisplayedFlow(
      section.id,
      sectionResources,
      assignments,
      persisted,
      flowCtx,
      now,
    );
    if (fromDisplayed) {
      return { target: fromDisplayed, sectionId: section.id };
    }
  }

  return null;
}

export function resolveStudentResumeTarget(params: {
  sections: SyllabusSection[];
  releaseMode: ReleaseMode;
  studentProgressMap: Record<string, StudentProgressStatus>;
  flowBulk: Record<string, ModuleFlowStep[]>;
  resourceMap: Record<string, SectionResource[]>;
  assignments: AssignmentRow[];
  flowCtx: StudentFlowProgressContext;
  now?: Date;
}): FlowStepTarget | null {
  return resolveStudentResumeTargetWithSection(params)?.target ?? null;
}
