# Step P4-2 — Shared markdown, settings delete dialog, wellbeing card

**Date:** 2026-09-01

## What changed

- Moved `SafeMathMarkdown` → `src/components/shared/SafeMathMarkdown.tsx` (+ `shared/index.ts` barrel)
- Moved `DeleteAccountDialog` → `src/components/features/settings/DeleteAccountDialog.tsx`
- Moved `WellbeingAlertCard` → `src/components/features/submission/WellbeingAlertCard.tsx`
- Updated imports in assignment chat, classroom, submission tabs, settings, TeacherAssistant

## Live QA (local verify)

| Feature | Run | Result |
|---------|-----|--------|
| `student-settings-profile` | `p4-t2-gate-student` | PASS |
| `teacher-submission-detail` | `p4-t2-gate-teacher` | PASS |

## Automated gates

- `npm run test:run` — 256/256
