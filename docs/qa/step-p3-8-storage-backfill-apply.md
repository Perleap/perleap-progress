# Step P3-8 — Storage path backfill apply (staging)

**Date:** 2026-09-01

## What changed

- Added `--apply --staging` to [`scripts/storage-path-backfill.mjs`](../../scripts/storage-path-backfill.mjs)
- New npm script: `npm run storage:backfill:apply:staging`
- Apply refuses non-staging Supabase URLs (project ref `otjfoeyqiuerrgrdtgqx`)

## Staging run

| Step | Result |
|------|--------|
| Dry-run (pre) | 24 candidates (22 submissions, 2 materials) |
| `--apply --staging` | 24 field updates applied |
| Dry-run (post) | **0 candidates** |

Reports: `scripts/reports/storage-path-backfill-2026-09-01T11-08-*.json`

## Manual live QA (staging.perleap.ai)

| Feature | Run | Result |
|---------|-----|--------|
| `student-settings-profile` | `p3-t8-gate-student` | PASS |
| `teacher-submission-detail` | `p3-t8-gate-submission` | PASS |
| `teacher-classroom-overview` | `p3-t8-gate-overview` | PASS |

## Automated gates

- `npm run test:run` — 256/256
