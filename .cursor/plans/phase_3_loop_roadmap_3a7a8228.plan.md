---
name: Phase 3 loop roadmap
overview: Decompose legacy root-level components into feature modules with section splits and verify gates.
todos:
  - id: t1-chat-interface
    content: P3-1 — AssignmentChatInterface migration
    status: completed
  - id: t2-create-assignment-dialog
    content: P3-2 — CreateAssignmentDialog migration
    status: completed
  - id: t3-edit-assignment-dialog
    content: P3-3 — EditAssignmentDialog migration
    status: completed
  - id: t4-regenerate-scores
    content: P3-4 — RegenerateScoresButton migration
    status: completed
  - id: t5-edit-classroom-split
    content: P3-5 — EditClassroomDialog section split
    status: completed
  - id: t6-classroom-analytics
    content: P3-6 — ClassroomAnalytics section split
    status: completed
  - id: t7-notification-service
    content: P3-7 — notificationService consolidation
    status: completed
  - id: t8-storage-backfill-apply
    content: P3-8 — Storage backfill --apply on staging
    status: completed
  - id: t9-shared-classroom-forms
    content: P3-9 — Shared classroom form sections (wizard + edit)
    status: completed
  - id: t10-marketing-pages
    content: P3-10 — Marketing pages light pass + Pricing card extract
    status: completed
  - id: t11-admin-monitoring-renames
    content: P3-11 — Admin monitoring *Page → *Content renames
    status: completed
  - id: t12-ci-e2e-smoke
    content: P3-12 — workflow_dispatch E2E smoke (~6 features)
    status: completed
  - id: p3-capstone
    content: P3-capstone — full qa:refactor 30/30 on staging
    status: completed
---

# Phase 3 loop roadmap

Legacy component migration and decomposition under `src/components/features/`.

## P3-6 — ClassroomAnalytics (done 2026-09-01)

- Split ~1179-line orchestrator into five sections under `features/analytics/sections/`
- View model: `useClassroomAnalyticsViewModel.ts`
- Verify: `teacher-classroom-analytics-tab` / `p3-t6-gate` PASS
- QA: `docs/qa/step-p3-6-classroom-analytics.md`

## P3-7 — notificationService (done 2026-09-01)

- Moved to `src/services/`; query hooks in `useNotificationQueries.ts`
- QA: `docs/qa/step-p3-7-notification-service.md`

## P3-8 — Storage backfill apply (done 2026-09-01)

- `--apply --staging` on backfill script; 24 legacy URLs normalized on staging
- Post-apply dry-run: 0 candidates
- QA: `docs/qa/step-p3-8-storage-backfill-apply.md`

## P3-9 — Shared classroom forms (done 2026-09-01)

- Shared sections under `features/classroom/forms/sections/`
- Create wizard + edit dialog compose same `ClassroomFormData` sections
- Verify: `teacher-list-classrooms`, `teacher-classroom-overview` / `p3-t9-gate-*` PASS
- QA: `docs/qa/step-p3-9-shared-classroom-forms.md`

## P3-10 — Marketing pages (done 2026-09-01)

- `MarketingPageLayout` + `PricingPlanCard` under `components/marketing/`
- Pricing refactored; dead `Index.tsx` removed
- Gate: `npm run build` PASS
- QA: `docs/qa/step-p3-10-marketing-pages.md`

## P3-11 — Admin monitoring renames (done 2026-09-01)

- Feature files renamed `*Page.tsx` → `*Content.tsx` under `features/admin/monitoring/`
- Verify: `admin-monitoring-overview` / `p3-t11-gate` PASS
- QA: `docs/qa/step-p3-11-admin-monitoring-renames.md`

## P3-12 — CI E2E smoke (done 2026-09-01)

- `e2e-smoke.yml` workflow_dispatch + `ci-smoke` suite (6 features)
- Staging gate: `verify:ci-smoke` 6/6 PASS
- QA: `docs/qa/step-p3-12-ci-e2e-smoke.md`

## P3-capstone — Full regression (done 2026-09-01)

- `npm run qa:refactor:staging` — unit 256/256, i18n 0 missing, E2E **30/30 PASS** (`p3-capstone-v3`)
- Verify harness fixes for join-class, assignment-open, and complete-chat repeat runs
- QA: `docs/qa/step-p3-capstone.md`

**Phase 3 loop: complete.**
