# Step P4-6 — Hard skills table + SubmissionCard

**Date:** 2026-09-01

## What changed

- Moved `HardSkillsAssessmentTable` → `src/components/features/analytics/`
- Moved `SubmissionCard` → `src/components/features/submission/`
- Updated classroom submissions tab and submission detail imports

## Live QA (local verify)

| Feature | Run | Result |
|---------|-----|--------|
| `teacher-classroom-submissions-tab` | `p4-t6-gate` | PASS |
| `teacher-submission-detail` | `p4-t6-gate` | PASS |

## Automated gates

- `npm run test:run` — 256/256
