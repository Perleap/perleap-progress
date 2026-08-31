# Teacher classroom analytics tab

Teacher opens the Analytics section on the sandbox classroom.

## Sub-features

- `analytics-tab` — **Analytics** section button
- `analytics-shell` — **Analytics** label/content visible

## How to get to it (user POV)

- Sign in → open **Verify Sandbox** classroom
- Click **Analytics**
- Analytics panel loads (may be sparse without submission data)

## Driving it with Playwright

Preconditions:

- Teacher auth + sandbox classroom from seed

Steps:

1. `npm run verify:feature -- --id teacher-classroom-analytics-tab --run <run-id>`
2. **Observable result:** **Analytics** text visible in classroom detail

## Gotchas

- Migrated to `features/analytics/` in R6/R7 — smoke asserts tab mount, not chart data
- AI-heavy analytics may need completed submissions for rich content
