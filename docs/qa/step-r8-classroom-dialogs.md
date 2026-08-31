# Step R8 — Classroom dialog migration

**Date:** 2026-08-30  
**Gate:** `npm run qa:refactor` (see run below)

## Change

Moved root-level dialogs into `src/components/features/classroom/dialogs/`:

- `EditClassroomDialog.tsx`
- `CreateClassroomDialog.tsx`
- Barrel `dialogs/index.ts`; re-export from `features/classroom/index.ts`

Updated imports in `TeacherClassroomDialogs`, `TeacherClassroomsSection`, and `scripts/qa-rls-config.mjs`.

## Verification

- `npm run build` — pass
- Unit: **250/250** pass
- Local headed QA: **27/27 PASS** (same run as R5, 2026-08-30)
