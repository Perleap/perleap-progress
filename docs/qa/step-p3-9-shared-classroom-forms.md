# Step P3-9 — Shared classroom form sections

**Date:** 2026-09-01

## What changed

- Extracted shared form sections to `src/components/features/classroom/forms/sections/`:
  - `ClassroomBasicInfoSection`, `ClassroomSubjectAreasSection`, `ClassroomOutcomesSection`, `ClassroomMaterialsSection`
- Shared types/helpers in `forms/classroomFormTypes.ts` (`ClassroomFormData`, build/update helpers)
- `CourseBasicsStep` (create wizard) and `EditClassroomDialog` now compose the same sections
- Wizard rephrase uses `rephraseCourseDescription` service (was direct edge invoke)
- `dialogs/sections/` re-exports shared modules for backward compatibility

## Manual live QA

| Feature | Run | Result |
|---------|-----|--------|
| `teacher-list-classrooms` | `p3-t9-gate-list` | PASS |
| `teacher-classroom-overview` | `p3-t9-gate-overview` | PASS |

## Automated gates

- `npm run test:run` — 256/256
- `npm run check:i18n` — clean
