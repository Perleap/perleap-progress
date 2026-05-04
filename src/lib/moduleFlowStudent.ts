/**
 * Student sequential access for module flow (persisted steps + fallback computed flow).
 */

import type { ModuleFlowStep, SectionResource } from '@/types/syllabus';
import { isPastDueForNewAttempts } from '@/lib/assignmentAttemptPolicy';
import {
  computeDefaultModuleFlow,
  getOrderedActivityCenterFlowSteps,
  type AssignmentRow,
  type ComputedFlowItem,
} from '@/lib/moduleFlow';

/** Maps: flow step id -> completed resource progress; assignment id -> submission complete */
export type StudentFlowProgressContext = {
  progressByStep: Record<string, boolean>;
  assignmentDoneMap: Record<string, boolean>;
  /** True when the student has at least one submissions row for that assignment (any status). */
  assignmentHasSubmissionRowMap?: Record<string, boolean>;
};

/**
 * `multiple_until_due`, past due, not completed, and never started (no submission rows).
 * Students with an in-progress draft are not treated as missed.
 */
export function isAssignmentMissedDeadline(
  assignmentId: string,
  assignments: AssignmentRow[],
  ctx: StudentFlowProgressContext,
  now: Date
): boolean {
  const a = assignments.find((x) => x.id === assignmentId);
  if (!a) return false;
  const mode = a.attempt_mode ?? 'single';
  if (mode !== 'multiple_until_due') return false;
  if (!a.due_at) return false;
  if (!isPastDueForNewAttempts(a.due_at, now)) return false;
  if (ctx.assignmentDoneMap[assignmentId]) return false;
  if (ctx.assignmentHasSubmissionRowMap?.[assignmentId]) return false;
  return true;
}

/**
 * Resource steps: done when progress exists, or when any later assignment in this flow has a
 * completed submission (covers lost `student_module_flow_progress` rows after flow replace).
 */
export function persistedStepDone(
  step: ModuleFlowStep,
  steps: ModuleFlowStep[],
  stepIndex: number,
  ctx: StudentFlowProgressContext
): boolean {
  if (step.step_kind === 'assignment' && step.assignment_id) {
    return ctx.assignmentDoneMap[step.assignment_id] ?? false;
  }
  if (step.step_kind === 'resource' && step.activity_list_id) {
    if (ctx.progressByStep[step.id]) return true;
    for (let k = stepIndex + 1; k < steps.length; k++) {
      const s = steps[k];
      if (
        s.step_kind === 'assignment' &&
        s.assignment_id &&
        ctx.assignmentDoneMap[s.assignment_id]
      ) {
        return true;
      }
    }
    return false;
  }
  return false;
}

/** All steps before `index` are done (for persisted module_flow_steps). */
export function persistedPreviousStepsComplete(
  steps: ModuleFlowStep[],
  index: number,
  ctx: StudentFlowProgressContext,
  accessMeta?: { assignments: AssignmentRow[]; now: Date }
): boolean {
  if (index === 0) return true;
  for (let i = 0; i < index; i++) {
    if (persistedStepDone(steps[i], steps, i, ctx)) continue;
    const s = steps[i];
    if (
      accessMeta &&
      s.step_kind === 'assignment' &&
      s.assignment_id &&
      isAssignmentMissedDeadline(s.assignment_id, accessMeta.assignments, ctx, accessMeta.now)
    ) {
      continue;
    }
    return false;
  }
  return true;
}

export type StepVisualState = 'locked' | 'available' | 'done' | 'missed_deadline';

export function stepVisualStateFromFlags(
  done: boolean,
  previousStepsComplete: boolean
): StepVisualState {
  if (done) return 'done';
  if (!previousStepsComplete) return 'locked';
  return 'available';
}

export function persistedStepVisualState(
  step: ModuleFlowStep,
  steps: ModuleFlowStep[],
  index: number,
  ctx: StudentFlowProgressContext,
  accessMeta?: { assignments: AssignmentRow[]; now: Date }
): StepVisualState {
  const prevOk = persistedPreviousStepsComplete(steps, index, ctx, accessMeta);
  const done = persistedStepDone(step, steps, index, ctx);
  return stepVisualStateFromFlags(done, prevOk);
}

/** First index that is the “next up” step (all prior complete, this one not). -1 if all done. */
export function firstIncompletePersistedIndex(
  steps: ModuleFlowStep[],
  ctx: StudentFlowProgressContext
): number {
  for (let i = 0; i < steps.length; i++) {
    if (!persistedPreviousStepsComplete(steps, i, ctx)) continue;
    if (!persistedStepDone(steps[i], steps, i, ctx)) return i;
  }
  return -1;
}

/** Next actionable step: skips assignments that are closed after the due date with no submission. */
export function firstIncompleteActionablePersistedIndex(
  steps: ModuleFlowStep[],
  ctx: StudentFlowProgressContext,
  assignments: AssignmentRow[],
  now: Date
): number {
  for (let i = 0; i < steps.length; i++) {
    if (!persistedPreviousStepsComplete(steps, i, ctx, { assignments, now })) continue;
    if (persistedStepDone(steps[i], steps, i, ctx)) continue;
    const step = steps[i];
    if (
      step.step_kind === 'assignment' &&
      step.assignment_id &&
      isAssignmentMissedDeadline(step.assignment_id, assignments, ctx, now)
    ) {
      continue;
    }
    return i;
  }
  return -1;
}

/** Fallback flow: only assignments block; resources never count as “done” for progress. */
export function computedStepDone(c: ComputedFlowItem, ctx: StudentFlowProgressContext): boolean {
  if (c.kind === 'assignment') return ctx.assignmentDoneMap[c.assignment_id] ?? false;
  return false;
}

/**
 * For aggregate progress when the module has no activity-center persisted steps: walk
 * `computeDefaultModuleFlow` order. Assignments use submission map; resources match
 * `persistedStepDone` inference (later completed assignment implies earlier resource done).
 */
export function computedFlowItemDoneForProgress(
  item: ComputedFlowItem,
  items: ComputedFlowItem[],
  index: number,
  ctx: StudentFlowProgressContext
): boolean {
  if (item.kind === 'assignment') {
    return ctx.assignmentDoneMap[item.assignment_id] ?? false;
  }
  for (let k = index + 1; k < items.length; k++) {
    const c = items[k];
    if (c.kind === 'assignment' && ctx.assignmentDoneMap[c.assignment_id]) {
      return true;
    }
  }
  return false;
}

export function computedPreviousStepsComplete(
  items: ComputedFlowItem[],
  index: number,
  ctx: StudentFlowProgressContext,
  accessMeta?: { assignments: AssignmentRow[]; now: Date }
): boolean {
  if (index === 0) return true;
  for (let i = 0; i < index; i++) {
    const c = items[i];
    if (c.kind !== 'assignment') continue;
    if (ctx.assignmentDoneMap[c.assignment_id]) continue;
    if (
      accessMeta &&
      isAssignmentMissedDeadline(c.assignment_id, accessMeta.assignments, ctx, accessMeta.now)
    ) {
      continue;
    }
    return false;
  }
  return true;
}

export function computedStepVisualState(
  c: ComputedFlowItem,
  items: ComputedFlowItem[],
  index: number,
  ctx: StudentFlowProgressContext,
  accessMeta?: { assignments: AssignmentRow[]; now: Date }
): StepVisualState {
  const prevOk = computedPreviousStepsComplete(items, index, ctx, accessMeta);
  const done = computedStepDone(c, ctx);
  return stepVisualStateFromFlags(done, prevOk);
}

export function firstIncompleteComputedIndex(
  items: ComputedFlowItem[],
  ctx: StudentFlowProgressContext
): number {
  for (let i = 0; i < items.length; i++) {
    if (!computedPreviousStepsComplete(items, i, ctx)) continue;
    if (!computedStepDone(items[i], ctx)) return i;
  }
  return -1;
}

export function firstIncompleteActionableComputedIndex(
  items: ComputedFlowItem[],
  ctx: StudentFlowProgressContext,
  assignments: AssignmentRow[],
  now: Date
): number {
  for (let i = 0; i < items.length; i++) {
    if (!computedPreviousStepsComplete(items, i, ctx, { assignments, now })) continue;
    if (computedStepDone(items[i], ctx)) continue;
    const c = items[i];
    if (
      c.kind === 'assignment' &&
      isAssignmentMissedDeadline(c.assignment_id, assignments, ctx, now)
    ) {
      continue;
    }
    return i;
  }
  return -1;
}

/** Student may open this persisted step (not sequentially locked). */
export function canAccessPersistedStep(
  steps: ModuleFlowStep[],
  index: number,
  ctx: StudentFlowProgressContext,
  accessMeta?: { assignments: AssignmentRow[]; now: Date }
): boolean {
  const step = steps[index];
  if (
    step.step_kind === 'assignment' &&
    step.assignment_id &&
    accessMeta &&
    isAssignmentMissedDeadline(step.assignment_id, accessMeta.assignments, ctx, accessMeta.now)
  ) {
    return false;
  }
  if (persistedStepDone(step, steps, index, ctx)) return true;
  return persistedPreviousStepsComplete(steps, index, ctx, accessMeta);
}

export function canAccessComputedStep(
  items: ComputedFlowItem[],
  index: number,
  ctx: StudentFlowProgressContext,
  accessMeta?: { assignments: AssignmentRow[]; now: Date }
): boolean {
  const c = items[index];
  if (c.kind === 'assignment' && accessMeta) {
    if (isAssignmentMissedDeadline(c.assignment_id, accessMeta.assignments, ctx, accessMeta.now)) {
      return false;
    }
  }
  return computedPreviousStepsComplete(items, index, ctx, accessMeta);
}

/** Same “all steps done” rule as Curriculum: persisted flow if any, else default computed flow. */
export function isSectionActivityFlowFullyComplete(
  sectionId: string,
  persistedSteps: ModuleFlowStep[],
  sectionResources: SectionResource[],
  assignments: AssignmentRow[],
  ctx: StudentFlowProgressContext,
  now: Date
): boolean {
  const orderedPersisted = getOrderedActivityCenterFlowSteps(persistedSteps, sectionResources);
  const computed = computeDefaultModuleFlow(sectionId, sectionResources, assignments);
  if (orderedPersisted.length > 0) {
    return firstIncompleteActionablePersistedIndex(orderedPersisted, ctx, assignments, now) === -1;
  }
  if (computed.length > 0) {
    return firstIncompleteActionableComputedIndex(computed, ctx, assignments, now) === -1;
  }
  return false;
}
