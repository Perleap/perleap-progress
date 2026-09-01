# Step P3-7 — notificationService consolidation

**Date:** 2026-09-01

## What changed

- Moved `notificationService.ts` from `src/lib/` to `src/services/`
- Updated 8 importers; exported from `services/index.ts`
- Added `fetchUnreadNotifications`, `useCreateBulkNotifications` to `useNotificationQueries.ts`
- `AssignmentDetailContent` uses `useMarkAsRead` + `fetchUnreadNotifications`
- `AssignmentWizardDialog` uses `useCreateBulkNotifications` mutation

## Manual live QA

| Feature | Run | Result |
|---------|-----|--------|
| `student-assignment-detail` | `p3-t7-gate` | PASS |

## Automated gates

- `npm run lint:fix` — pass
- `npm run test:run` — 256/256
