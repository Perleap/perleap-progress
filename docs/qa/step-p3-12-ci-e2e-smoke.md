# Step P3-12 — CI E2E smoke workflow

**Date:** 2026-09-01

## What changed

- New verify suite [`ci-smoke.json`](../../.cursor/skills/verify-perleap/features/suites/ci-smoke.json) — 6 features
- New npm script: `npm run verify:ci-smoke`
- New workflow: [`.github/workflows/e2e-smoke.yml`](../../.github/workflows/e2e-smoke.yml) (`workflow_dispatch` only)
- CI env helper: [`scripts/write-verify-ci-env.mjs`](../../scripts/write-verify-ci-env.mjs)

### CI smoke features

1. `auth-page-load`
2. `student-auth-dashboard`
3. `student-assignment-detail`
4. `teacher-auth-dashboard`
5. `teacher-classroom-overview`
6. `teacher-submission-detail`

### Trigger (GitHub)

Actions → **E2E Smoke** → Run workflow. Requires repo secrets listed in the workflow header.

## Local gate (staging)

| Run | Result |
|-----|--------|
| `npm run verify:ci-smoke -- --run p3-t12-gate` (VERIFY_PROFILE=staging) | **6/6 PASS** |

Evidence: `.cursor/skills/verify-perleap/evidence/p3-t12-gate/`

## Automated gates

- `npm run test:run` — 256/256 (unchanged)
