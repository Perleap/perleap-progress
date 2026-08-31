# Step S5-7 — Storage path backfill (dry-run)

**Date:** 2026-08-31

## What changed

- Unit tests: [`src/utils/storageUrls.test.ts`](src/utils/storageUrls.test.ts)
- Dry-run script: [`scripts/storage-path-backfill.mjs`](scripts/storage-path-backfill.mjs)
- **No DB writes** — report only

## Run dry-run

```bash
npm run storage:backfill:dry-run
```

Report written to `scripts/reports/storage-path-backfill-<timestamp>.json`.

Scopes: `avatars`, `submissions`, `materials`, `syllabus`.

## Manual QA

| # | Action | Pass if |
|---|--------|---------|
| 1 | Run dry-run | Script exits 0; JSON report created |
| 2 | Student avatar on dashboard/settings | Renders |
| 3 | Teacher submission with attachments | Files open/preview |
| 4 | Student curriculum / activity resource | Loads if present |
| 5 | Teacher classroom materials | PDFs/links work |

## Verify-perleap smoke

```bash
npm run verify:launch
npm run verify:login -- --role student
npm run verify:feature -- --id student-settings-profile --run s5-7-student
npm run verify:feature -- --id student-classroom-curriculum --run s5-7-curriculum
npm run verify:login -- --role teacher
npm run verify:feature -- --id teacher-submission-detail --run s5-7-submission
npm run verify:feature -- --id teacher-classroom-overview --run s5-7-overview
npm run verify:cleanup
```

Zero candidates in dry-run is OK if all rows already store paths — runtime compat still handles legacy URLs.
