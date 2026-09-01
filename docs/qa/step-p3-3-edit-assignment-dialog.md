# Step P3-3 — EditAssignmentDialog migration

**Date:** 2026-09-01

## What changed

- Moved `EditAssignmentDialog` to `src/components/features/assignment/dialogs/`
- Updated importers: `PlannerContent`, `TeacherClassroomDialogs`

## Manual live QA

| Feature | Run | Result |
|---------|-----|--------|
| `teacher-planner-load` | (shared with T2) | PASS |
| `teacher-classroom-overview` | `p3-t3-gate` | PASS |
