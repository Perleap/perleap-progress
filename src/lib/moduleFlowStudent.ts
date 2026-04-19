/**
 * Student sequential access for module flow (persisted steps + fallback computed flow).
 */

import type { ComputedFlowItem } from '@/lib/moduleFlow';
import type { ModuleFlowStep } from '@/types/syllabus';

/** Maps: flow step id -> completed resource progress; assignment id -> submission complete */
export type StudentFlowProgressContext = {
  progressByStep: Record<string, boolean>;
  assignmentDoneMap: Record<string, boolean>;
};

export function persistedStepDone(step: ModuleFlowStep, ctx: StudentFlowProgressContext): boolean {
  if (step.step_kind === 'assignment' && step.assignment_id) {
    return ctx.assignmentDoneMap[step.assignment_id] ?? false;
  }
  if (step.step_kind === 'resource' && step.section_resource_id) {
    return !!ctx.progressByStep[step.id];
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
    if (!persistedStepDone(steps[i], ctx)) return false;
  }
  return true;
}

export type StepVisualState = 'locked' | 'available' | 'done';

export function stepVisualStateFromFlags(
  done: boolean,
  previousStepsComplete: boolean,
): StepVisualState {
  if (!previousStepsComplete) return 'locked';
  if (done) return 'done';
  return 'available';
}

export function persistedStepVisualState(
  step: ModuleFlowStep,
  steps: ModuleFlowStep[],
  index: number,
  ctx: StudentFlowProgressContext,
): StepVisualState {
  const prevOk = persistedPreviousStepsComplete(steps, index, ctx);
  const done = persistedStepDone(step, ctx);
  return stepVisualStateFromFlags(done, prevOk);
}

/** First index that is the “next up” step (all prior complete, this one not). -1 if all done. */
export function firstIncompletePersistedIndex(
  steps: ModuleFlowStep[],
  ctx: StudentFlowProgressContext,
): number {
  for (let i = 0; i < steps.length; i++) {
    if (!persistedPreviousStepsComplete(steps, i, ctx)) continue;
    if (!persistedStepDone(steps[i], ctx)) return i;
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
  return persistedPreviousStepsComplete(steps, index, ctx);
}

export function canAccessComputedStep(
  items: ComputedFlowItem[],
  index: number,
  ctx: StudentFlowProgressContext,
): boolean {
  return computedPreviousStepsComplete(items, index, ctx);
}
