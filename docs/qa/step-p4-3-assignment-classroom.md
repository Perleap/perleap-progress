# Step P4-3 — Assignment wizard + classroom profile cluster

**Date:** 2026-09-01

## What changed

- Moved `AssignmentCourseOutlineLinkCard` → `src/components/features/assignment/wizard/`
- Moved `StudentProfilePanel` → `src/components/features/classroom/`
- Moved `TeacherStudentDetailDialog` → `src/components/features/classroom/dialogs/`
- Updated imports in planner, classroom students tab, and related callers

## Live QA (local verify)

| Feature | Run | Result |
|---------|-----|--------|
| `teacher-classroom-students-tab` | `p4-t3-gate` | PASS |
| `teacher-planner-load` | `p4-t3-gate` | PASS |

## Automated gates

- `npm run test:run` — 256/256
