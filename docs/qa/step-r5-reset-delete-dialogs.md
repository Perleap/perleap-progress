# Step R5 — Reset/delete dialog polish

**Date:** 2026-08-30  
**Gate:** `npm run qa:refactor` (see run below)

## Change

- Extracted `ResetPreviewSummary` from `ClassroomResetDialogs.tsx`
- Added shared `TypedConfirmInput` + `matchesTypedConfirm` helper (reused in `DeleteAccountDialog`)
- Reset confirm now matches **classroom name** (aligned with i18n); account delete still uses `'confirm'`
- Added `typedConfirm.test.ts`

## Verification

- `npm run build` — pass
- Unit: **250/250** pass (includes `typedConfirm.test.ts`)
- Local headed QA (`npm run qa:refactor:watch` @ `127.0.0.1:8086`): **27/27 PASS** (2026-08-30)
