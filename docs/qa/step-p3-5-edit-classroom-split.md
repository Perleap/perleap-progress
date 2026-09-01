# Step P3-5 — EditClassroomDialog section split

**Date:** 2026-09-01

## What changed

- Split `EditClassroomDialog.tsx` (~768→~119 lines) into four section components under `src/components/features/classroom/dialogs/sections/`:
  - `EditClassroomBasicInfoSection` — title, dates, description + rephrase via `rephraseCourseDescription`
  - `EditClassroomSubjectAreasSection` — domains/skills with internal handlers
  - `EditClassroomMaterialsSection` — PDF upload via `uploadCourseMaterialPdf`, links, material list
  - `EditClassroomOutcomesSection` — learning outcomes + key challenges
- Added `editClassroomFormTypes.ts` helpers: `buildEditClassroomFormData`, `buildClassroomUpdatePayload`
- Dialog submit now uses `updateClassroom` from `classroomService` (no direct Supabase in UI)
- Added `rephraseCourseDescription` and `uploadCourseMaterialPdf` to `classroomService.ts`

## Manual live QA

| Feature | Run | Result |
|---------|-----|--------|
| `teacher-classroom-overview` | `p3-t5-gate` | PASS |
