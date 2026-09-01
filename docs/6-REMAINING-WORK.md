# Remaining Work

Page refactor tracks **A–M are complete** (Master Refactor Loop Roadmap, Aug 2026). **Phase 3 (P3-1…P3-12 + capstone) is complete** as of 2026-09-01 — see `docs/qa/step-p3-capstone.md`. **Phase 4 (P4-1…P4-14 + capstone) is complete** as of 2026-09-01 — see `docs/qa/step-p4-capstone.md` and `.cursor/plans/phase_4_loop_roadmap_5c3a3297.plan.md`.

This document lists what is **still open** after that work—not the old monolithic-page plan.

## Completed page refactors (tracks A–M)

| Track | Target | Result |
|-------|--------|--------|
| **A–C** | Teacher/student classroom dashboards & detail | Thin page shells + `*Content` orchestrators + section components |
| **D** | `SubmissionDetail` | Service layer + sections + verify `teacher-submission-detail` |
| **E** | `ClassroomActivityPage` | Content/nav split + verify `student-activity-page` |
| **F** | `AssignmentDetail` | Full orchestrator + type routers + verify E2E |
| **G** | `LiveSessionPage` | `LiveSessionContent` + sections |
| **H** | Settings (student/teacher) | Tab sections + verify settings smoke |
| **I** | Onboarding | Step sections + `onboardingService` |
| **J** | Planner | `PlannerContent` + `plannerService` |
| **K** | Lesson brief + pilot report | Analytics feature module |
| **L** | Admin + auth | `features/admin`, `features/auth`, monitoring module |
| **M** | Polish | Feature barrels, `classroomViewMode` helpers, i18n, doc updates |

**Convention:** Page shells import from `@/components/features/<feature>` barrels, not deep file paths.

## Post-refactor backlog

### 1. Root-level dialogs and legacy components

**Phase 4 complete (P4-1–P4-7):** All legacy `src/components/*.tsx` root files migrated to `common/`, `shared/`, or `features/*`. Root is clear of page-level components.

**Previously moved (R8 / P3):** `CreateClassroomDialog`, `EditClassroomDialog` → `features/classroom/dialogs/` · `SubmissionsTab` → `features/submission/`

**P3-5 (done):** `EditClassroomDialog` decomposed into section components under `dialogs/sections/`; submit/rephrase/upload via `classroomService`.

**P3-6 (done):** `ClassroomAnalytics` decomposed into section components under `features/analytics/sections/`; view model in `useClassroomAnalyticsViewModel.ts`.

**Goal:** Move or refactor to feature modules; prefer services/hooks over direct Supabase in UI.

### 2. Notification service location

Done in P3-7: `notificationService` lives under `src/services/`; components use `useNotificationQueries` hooks.

### 3. Marketing pages

**Phase 4 complete (P4-8–P4-14):** Marketing pages use `MarketingPageLayout`, section content components under `components/marketing/sections/`, shared `MarketingHero`/`MarketingCta`, i18n keys, and verify-perleap `marketing-smoke` + expanded `ci-smoke` (8 features).

### 4. Optional renames

- ~~Admin monitoring `*Page.tsx` → `*Content.tsx` in features module~~ **Done (P3-11)**

## Verify-perleap regression smoke

Re-run after large changes to auth, dashboard, classroom, or assignment flows:

| Feature ID | When to run |
|------------|-------------|
| `student-auth-dashboard`, `teacher-auth-dashboard` | Auth / dashboard changes |
| `student-list-classrooms`, `teacher-classroom-overview` | Classroom list/detail |
| `student-assignment-detail`, `student-complete-chat` | Assignment detail |
| `student-activity-page` | Activity page |
| `teacher-submission-detail` | Submission detail |
| `student-join-class`, `student-classroom-detail` | Enrollment / student classroom |

```bash
npm run verify:doctor
npm run verify:launch
npm run verify:login -- --role student
npm run verify:login -- --role teacher
npm run verify:feature -- --id <feature-id> --run <run-id>
```

## Success criteria (ongoing)

- Page shells stay thin (~5–40 lines): params, guards, render `*Content`
- Business logic in services; data fetching in hooks where appropriate
- No new deep imports from pages into feature internals—use barrels
- `npm run test:run` and `npm run check:i18n` pass after each change

## QA checklist per change

1. Unit tests + i18n key check
2. Relevant verify-perleap feature(s) when user-facing routes change
3. Manual smoke for admin/monitoring or AI-heavy flows without E2E coverage

---

**Last updated:** Aug 2026 — after Track M completion.

## Phase 2 refactor QA gate

Before merging to staging, run:

```bash
npm run qa:refactor              # local: unit + i18n + 30 E2E
npm run qa:refactor:staging      # against staging.perleap.ai
```

Reports: `.cursor/skills/verify-perleap/evidence/refactor-qa-*/index.html`

Step guides: `docs/qa/step-*.md` · Change log: `docs/FIX-LOG.md`
