# Step P3-1 — AssignmentChatInterface migration

**Date:** 2026-09-01

## What changed

- Moved [`AssignmentChatInterface.tsx`](../../src/components/features/assignment/chat/AssignmentChatInterface.tsx) from `src/components/` to `features/assignment/chat/`
- Added [`assignmentChatService.ts`](../../src/services/assignmentChatService.ts) for admin check, attachment upload, conversation fetch, and sentence flag RPCs
- Extracted [`types.ts`](../../src/components/features/assignment/chat/types.ts) and [`chatTtsUtils.ts`](../../src/components/features/assignment/chat/chatTtsUtils.ts)
- Updated [`AssignmentDetailChatPanel.tsx`](../../src/components/features/assignment/AssignmentDetailChatPanel.tsx) import path
- Verify seed pins `preferred_language: en` on sandbox accounts (fixes Hebrew UI breaking English E2E selectors)

## Manual live QA (headed)

| Feature | Run | Result |
|---------|-----|--------|
| `student-assignment-detail` | `p3-t1-gate1` | PASS |
| `student-complete-chat` | `p3-t1-gate2` | PASS |
| `student-open-essay` | `p3-t1-gate3` | PASS |

Evidence: `.cursor/skills/verify-perleap/evidence/p3-t1-gate*/`

## Automated gates

- `npm run test:run` — 256/256
- `npm run check:i18n` — 0 missing
- `npm run build` — pass
