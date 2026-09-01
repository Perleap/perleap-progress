# Fix Log

Short documentation of changes from the Phase 2 refactor roadmap.

## R1 — Shared dashboard cards (2026-08-29)

Extracted `ClassroomViewModeSelect`, `StudentClassroomCard`, `TeacherClassroomCard`, and `getClassroomCardsContainerProps` into `src/components/features/dashboard/shared/`. Both `StudentClassroomsSection` and `TeacherClassroomsSection` now delegate card rendering to these shared components, removing ~250 lines of duplicated JSX while preserving identical UI behavior.

## R2 — Teacher dashboard parity (2026-08-29)

Extracted `TeacherDashboardHero` and `TeacherDashboardSidebar` from the page and content orchestrator. `TeacherDashboard.tsx` now matches the student pattern: layout shell, hero component, content delegate.

## R3 — Classroom orchestrator hooks (2026-08-29)

Extracted `useTeacherClassroomSections`, `useClassroomDetailDialogs`, and `TeacherClassroomDialogs` from `ClassroomDetailContent.tsx`. Tab navigation and dialog state are now isolated in hooks and a dialog host component.

## R4 — Overview section cards (2026-08-29)

Decomposed `TeacherClassroomOverviewSection.tsx` (~424→~65 lines) into six focused cards under `src/components/features/classroom/overview/`: `InviteCodeCard`, `CourseInfoCards`, `LearningOutcomesChallengesCard`, `DomainsAccordion`, `CourseMaterialsGrid`, and `ClassroomActionBar`. Behavior and RTL styling preserved.

## R5 — Reset dialog polish (2026-08-30)

Extracted `ResetPreviewSummary` and shared `TypedConfirmInput`/`matchesTypedConfirm`. Classroom reset typed confirm now matches classroom name (i18n-aligned). `DeleteAccountDialog` reuses the shared input.

## R8 — Classroom dialog migration (2026-08-30)

Moved `EditClassroomDialog` and `CreateClassroomDialog` to `src/components/features/classroom/dialogs/` with barrel exports.

## R6/R7 — Legacy module migration (2026-08-29)

Moved `SubmissionsTab.tsx` to `features/submission/` and `ClassroomAnalytics.tsx` to `features/analytics/`, fixing relative imports to use `@/` paths. Barrel exports updated.

## S5-3 — ErrorBoundary (2026-08-29)

Mounted `ErrorBoundary` around routed content in `App.tsx` so React render errors show a recovery UI instead of a blank screen.

## S5-4 — AuthContext memoization (2026-08-29)

Wrapped `signOut` and `refreshProfile` in `useCallback`, and the provider value in `useMemo`, to avoid unnecessary re-renders of auth consumers.

## S5-4 — AuthContext listener cleanup (2026-08-30)

Memoized `handleTokenRefreshFailure`; fixed auth listener deps and `SIGNED_OUT` profile cache key to use event session (avoids stale closure).

## S5-4 — AuthContext hook extraction (2026-08-31)

Split profile query, session listener, and health monitor into `src/contexts/auth/` hooks; trimmed verbose auth logs; optional `VITE_DEBUG_AUTH` for dev.

## S5-6 — Repo hygiene (2026-08-29)

Removed stray root SQL scripts: `debug_profile_issue.sql`, `fix_profile_language.sql`.

## S5-9 — VERCEL_SHARE_TOKEN docs (2026-08-30)

Documented `VERCEL_SHARE_TOKEN`, `VERCEL_OIDC_TOKEN`, and bypass-secret precedence in verify-perleap `SKILL.md` Staging section.

## S5-10 — Feature docs parity (2026-08-30)

Scaffolded 17 missing verify-perleap feature `.md` files; synced `features/README.md` with all 27 registry IDs.

## S5-2 — API rate limits (2026-08-30)

Wired Postgres-backed `checkRateLimit` into 12 additional OpenAI edge functions (16 user-facing proxies total).

## S5-8 — E2E Tracks G + I (2026-08-30)

Added browser E2E for live session (seeded ready state) and full student/teacher onboarding wizards. Refactor regression suite is now 30 features with Track G/I coverage in the QA report.

## S5-5 — TypeScript strict (2026-08-30)

Enabled `strict: true` in `tsconfig.app.json` and fixed all compiler errors (pre-existing + strict null checks across 51 files). CI `tsc --noEmit` now passes with full strict mode.

## S5-7 — Storage path backfill dry-run (2026-08-31)

Added `storageUrls` unit tests and `npm run storage:backfill:dry-run` to report legacy signed/public storage URLs that could be normalized to object paths (no DB writes; display compat unchanged).

## Q1 — CI hardening (2026-08-29)

Made ESLint, Prettier, and TypeScript blocking in `.github/workflows/ci.yml` (removed `continue-on-error`). E2E remains local/staging via `npm run qa:refactor`.

## S5-10 — Feature docs parity (2026-08-30)

Added 17 missing verify-perleap feature `.md` files (auth, student view modes, assignment types, teacher tabs/settings/planner, admin pages). Updated `features/README.md` with admin/anonymous sections and refactor-regression suite index. See `docs/qa/step-s5-10-feature-docs.md`.

## P3-1 — AssignmentChatInterface migration (2026-09-01)

Moved chat UI to `features/assignment/chat/`; extracted Supabase calls into `assignmentChatService.ts`. Verify seed now pins sandbox accounts to English for stable E2E selectors.

## P3-2 / P3-3 — Assignment dialog migration (2026-09-01)

Moved `CreateAssignmentDialog` and `EditAssignmentDialog` to `features/assignment/dialogs/` with barrel exports; updated planner, submission, syllabus, and classroom importers.

## P3-4 — RegenerateScoresButton migration (2026-09-01)

Moved button to `features/analytics/`; evaluation refresh batch/job queries and undo invoke now live in `analyticsService.ts`.

## P3-7 — notificationService consolidation (2026-09-01)

Moved `notificationService` to `src/services/`; assignment UI now uses notification query hooks instead of direct service calls in components.

## P3-5 — EditClassroomDialog section split (2026-09-01)

Split `EditClassroomDialog` (~768→~119 lines) into four section components under `dialogs/sections/`. Form helpers in `editClassroomFormTypes.ts`; rephrase/upload moved to `classroomService.ts`; submit uses `updateClassroom` instead of direct Supabase.

## P3-6 — ClassroomAnalytics section split (2026-09-01)

Split `ClassroomAnalytics.tsx` (~1179→~69 lines) into five section components under `features/analytics/sections/`. View-model hook `useClassroomAnalyticsViewModel.ts` holds filters, URL sync, KPIs, exports, and narrative evidence; orchestrator keeps `useClassroomAnalytics` as data source.

## P3-8 — Storage path backfill apply (2026-09-01)

Added `--apply --staging` to `storage-path-backfill.mjs` and `npm run storage:backfill:apply:staging`. Applied 24 legacy signed/public URL normalizations on staging (22 submission fields, 2 classroom materials); post-apply dry-run reports 0 candidates.

## P3-9 — Shared classroom form sections (2026-09-01)

Extracted `ClassroomBasicInfoSection`, `ClassroomSubjectAreasSection`, `ClassroomOutcomesSection`, and `ClassroomMaterialsSection` under `features/classroom/forms/sections/`; create wizard and edit dialog now share the same form UI and `ClassroomFormData` types.

## P3-10 — Marketing pages light pass (2026-09-01)

Added shared `MarketingPageLayout` and `PricingPlanCard`; refactored Pricing and four other marketing pages to use the layout. Removed unused `Index.tsx` scaffold.

## P3-11 — Admin monitoring Content renames (2026-09-01)

Renamed four admin monitoring feature files from `*Page.tsx` to `*Content.tsx` to align filenames with exported components; route shells under `pages/admin/monitoring/` unchanged.

## P3-12 — CI E2E smoke workflow (2026-09-01)

Added opt-in `workflow_dispatch` workflow `.github/workflows/e2e-smoke.yml` and `ci-smoke` verify suite (6 features) with `npm run verify:ci-smoke`; staging gate 6/6 PASS locally.

## P3-capstone — Phase 3 full regression (2026-09-01)

Hardened verify-perleap for seed-enrolled students and repeat chat runs (`student-join-class`, assignment open features, `student-complete-chat`). Full staging gate: unit 256/256, i18n 0 missing, E2E 30/30 (`p3-capstone-v3`).

## P4-1 — Common branding + dead root cleanup (2026-09-01)

Moved `PerleapLogo`, `ThemeToggle`, `LanguageSwitcher` to `src/components/common/`; deleted unused root `NavLink`, `StudentProfileModal`, and duplicate `DashboardHeader`. Gate: `auth-page-load` / `p4-t1-gate` PASS.

## P4-2 — Shared markdown, settings delete, wellbeing card (2026-09-01)

Moved `SafeMathMarkdown` to `shared/`, `DeleteAccountDialog` to `features/settings/`, `WellbeingAlertCard` to `features/submission/`. Gates: `student-settings-profile`, `teacher-submission-detail` PASS.

## P4-3 — Assignment wizard + classroom profile cluster (2026-09-01)

Moved `AssignmentCourseOutlineLinkCard`, `StudentProfilePanel`, and `TeacherStudentDetailDialog` into assignment/classroom feature modules. Gates: `teacher-classroom-students-tab`, `teacher-planner-load` PASS.

## P4-4 — Dashboard calendars (2026-09-01)

Moved `StudentCalendar` and `TeacherCalendar` to `features/dashboard/`. Gate: `student-auth-dashboard` PASS.

## P4-5 — Analytics charts + StudentAnalyticsPanel (2026-09-01)

Moved `RadarChart`/`FiveDChart` to `features/analytics/`; renamed `StudentAnalytics` → `StudentAnalyticsPanel`. Gates: `teacher-classroom-analytics-tab`, `teacher-submission-detail` PASS.

## P4-6 — Hard skills table + SubmissionCard (2026-09-01)

Moved `HardSkillsAssessmentTable` to analytics and `SubmissionCard` to submission features. Gates: `teacher-classroom-submissions-tab`, `teacher-submission-detail` PASS.

## P4-7 — ProtectedRoute to features/auth (2026-09-01)

Moved `ProtectedRoute` to `features/auth/`; updated `App.tsx` import. Gates: `auth-page-load`, `student-auth-dashboard` PASS.

## P4-8 — Marketing verify infrastructure (2026-09-01)

Registered four anonymous marketing verify features and `verify:marketing-smoke` suite. Gate: 4/4 PASS (`p4-t8-gate`).

## P4-9 — ContactUs shell + Footer links (2026-09-01)

Unified ContactUs on `MarketingPageLayout`; replaced Footer `#` placeholders with real routes. Gate: `marketing-contact-load` PASS.

## P4-10 — Landing sections merge (2026-09-01)

Moved landing components to `marketing/sections/`; added `LandingPageContent`; thinned `Landing.tsx`. Gate: `marketing-landing-load` PASS.

## P4-11 — Marketing page content extraction (2026-09-01)

Extracted `ProductPageContent`, `SolutionsPageContent`, `AboutUsPageContent`; thinned page shells. Gate: `marketing-nav-links` PASS.

## P4-12 — Landing auth hook + marketing i18n (2026-09-01)

Added `useLandingAuthRedirect`; i18n for product/solutions/pricing/contact pages. Gates: marketing landing/pricing/contact PASS; i18n 0 missing.

## P4-13 — MarketingHero/MarketingCta primitives (2026-09-01)

Shared hero/CTA components; refactored landing, product, and solutions sections. Gate: `marketing-nav-links` PASS.

## P4-14 — CI smoke marketing (2026-09-01)

Expanded `ci-smoke` to 8 features (added marketing landing + pricing). Gate: 8/8 PASS locally.

## P4-capstone — Phase 4 full regression (2026-09-01)

Local capstone: unit 256/256, i18n 0 missing, refactor-regression 30/30, marketing-smoke 4/4 (`p4-capstone`).
