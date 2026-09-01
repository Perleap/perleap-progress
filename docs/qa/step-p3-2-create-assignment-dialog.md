# Step P3-2 — CreateAssignmentDialog migration

**Date:** 2026-09-01

## What changed

- Moved `CreateAssignmentDialog` to `src/components/features/assignment/dialogs/`
- Updated importers: `PlannerContent`, `SubmissionDetailContent`, `ModuleFlowEditor`
- Barrel export via `features/assignment/dialogs/index.ts`

## Manual live QA

| Feature | Run | Result |
|---------|-----|--------|
| `teacher-planner-load` | `p3-t2-gate` | PASS |
| `teacher-submission-detail` | `p3-t2-gate2` | PASS |
