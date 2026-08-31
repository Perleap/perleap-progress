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
