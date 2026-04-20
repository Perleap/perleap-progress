/**
 * Student sequential access for module flow (persisted steps + fallback computed flow).
 */

import {
  computeDefaultModuleFlow,
  getOrderedActivityCenterFlowSteps,
  type AssignmentRow,
  type ComputedFlowItem,
} from '@/lib/moduleFlow';
import type { ModuleFlowStep, SectionResource } from '@/types/syllabus';

/** Maps: flow step id -> completed resource progress; assignment id -> submission complete */
export type StudentFlowProgressContext = {
  progressByStep: Record<string, boolean>;
  assignmentDoneMap: Record<string, boolean>;
};

/**
 * Resource steps: done when progress exists, or when any later assignment in this flow has a
 * completed submission (covers lost `student_module_flow_progress` rows after flow replace).
 */
export function persistedStepDone(
  step: ModuleFlowStep,
  steps: ModuleFlowStep[],
  stepIndex: number,
  ctx: StudentFlowProgressContext,
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
): boolean {
  if (index === 0) return true;
  for (let i = 0; i < index; i++) {
    if (!persistedStepDone(steps[i], steps, i, ctx)) return false;
  }
  return true;
}

export type StepVisualState = 'locked' | 'available' | 'done';

export function stepVisualStateFromFlags(
  done: boolean,
  previousStepsComplete: boolean,
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
): StepVisualState {
  const prevOk = persistedPreviousStepsComplete(steps, index, ctx);
  const done = persistedStepDone(step, steps, index, ctx);
  return stepVisualStateFromFlags(done, prevOk);
}

/** First index that is the “next up” step (all prior complete, this one not). -1 if all done. */
export function firstIncompletePersistedIndex(
  steps: ModuleFlowStep[],
  ctx: StudentFlowProgressContext,
): number {
  for (let i = 0; i < steps.length; i++) {
    if (!persistedPreviousStepsComplete(steps, i, ctx)) continue;
    if (!persistedStepDone(steps[i], steps, i, ctx)) return i;
  }
  return -1;
}

/** Fallback flow: only assignments block; resources never count as “done” for progress. */
export function computedStepDone(c: ComputedFlowItem, ctx: StudentFlowProgressContext): boolean {
  if (c.kind === 'assignment') return ctx.assignmentDoneMap[c.assignment_id] ?? false;
  return false;
}

export function computedPreviousStepsComplete(
  items: ComputedFlowItem[],
  index: number,
  ctx: StudentFlowProgressContext,
): boolean {
  if (index === 0) return true;
  for (let i = 0; i < index; i++) {
    const c = items[i];
    if (c.kind === 'assignment' && !(ctx.assignmentDoneMap[c.assignment_id] ?? false)) return false;
  }
  return true;
}

export function computedStepVisualState(
  c: ComputedFlowItem,
  items: ComputedFlowItem[],
  index: number,
  ctx: StudentFlowProgressContext,
): StepVisualState {
  const prevOk = computedPreviousStepsComplete(items, index, ctx);
  const done = computedStepDone(c, ctx);
  return stepVisualStateFromFlags(done, prevOk);
}

export function firstIncompleteComputedIndex(
  items: ComputedFlowItem[],
  ctx: StudentFlowProgressContext,
): number {
  for (let i = 0; i < items.length; i++) {
    if (!computedPreviousStepsComplete(items, i, ctx)) continue;
    if (!computedStepDone(items[i], ctx)) return i;
  }
  return -1;
}

/** Student may open this persisted step (not sequentially locked). */
export function canAccessPersistedStep(
  steps: ModuleFlowStep[],
  index: number,
  ctx: StudentFlowProgressContext,
): boolean {
  const step = steps[index];
  if (persistedStepDone(step, steps, index, ctx)) return true;
  return persistedPreviousStepsComplete(steps, index, ctx);
}

export function canAccessComputedStep(
  items: ComputedFlowItem[],
  index: number,
  ctx: StudentFlowProgressContext,
): boolean {
  return computedPreviousStepsComplete(items, index, ctx);
}

/** Same “all steps done” rule as Curriculum: persisted flow if any, else default computed flow. */
export function isSectionActivityFlowFullyComplete(
  sectionId: string,
  persistedSteps: ModuleFlowStep[],
  sectionResources: SectionResource[],
  assignments: AssignmentRow[],
  ctx: StudentFlowProgressContext,
): boolean {
  const orderedPersisted = getOrderedActivityCenterFlowSteps(persistedSteps, sectionResources);
  const computed = computeDefaultModuleFlow(sectionId, sectionResources, assignments);
  if (orderedPersisted.length > 0) {
    return firstIncompletePersistedIndex(orderedPersisted, ctx) === -1;
  }
  if (computed.length > 0) {
    return firstIncompleteComputedIndex(computed, ctx) === -1;
  }
  return false;
}
