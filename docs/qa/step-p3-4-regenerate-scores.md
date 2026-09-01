# Step P3-4 — RegenerateScoresButton migration

**Date:** 2026-09-01

## What changed

- Moved `RegenerateScoresButton` to `features/analytics/`
- Added `hasEvaluationRefreshBatch`, `hasRunningEvaluationRefreshJob`, `undoEvaluationRefresh` to `analyticsService.ts`

## Manual live QA

| Feature | Run | Result |
|---------|-----|--------|
| `teacher-classroom-analytics-tab` | `p3-t4-gate` | PASS |
