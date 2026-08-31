# QA Guide — R1 Shared Dashboard Cards

## Scope

**Files touched:**
- `src/components/features/dashboard/shared/` (new: ViewModeSelect, StudentClassroomCard, TeacherClassroomCard, layout helper)
- `StudentClassroomsSection.tsx`, `TeacherClassroomsSection.tsx` (slimmed)

**Expected behavior:** Unchanged. Same view modes, card layouts, join/create flows, navigation.

## Automated gate

```bash
npm run test:run && npm run test:edge && npm run check:i18n
npm run qa:refactor -- --run refactor-qa-step-r1-<date>
npm run qa:refactor:staging -- --run refactor-qa-staging-step-r1-<date>
```

**E2E features:** `student-list-classrooms`, `student-dashboard-view-modes`, `teacher-list-classrooms`

## Manual spot-check

1. Student dashboard: switch grid / compact / list / detailed / table / timeline — sandbox visible in each mode
2. Teacher dashboard: same view modes; invite code copy still works
3. Click a classroom card — navigates to detail page
