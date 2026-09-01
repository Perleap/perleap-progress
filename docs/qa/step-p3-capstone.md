# Step P3-capstone — Phase 3 full regression gate

**Date:** 2026-09-01

## What changed

No product code in this step — verify harness hardening so the full `refactor-regression` suite (30 features) passes reliably on staging after P3-1…P3-12.

### Verify fixes

- **`student-join-class`** — wait for dashboard load; detect seed enrollment via text (not heading-only); treat already-enrolled toast as success
- **`student-open-assignment-readonly`** — skip click on disabled “Start another attempt”
- **`student-open-essay`** — accept editor, post-submit, or retry affordance states
- **`student-complete-chat`** — reset all sandbox chat submissions before run; use `domcontentloaded` on remote; retry loop for chat input

## Capstone gate (staging)

| Gate | Result |
|------|--------|
| `npm run test:run` | **256/256** |
| `npm run lint` | PASS |
| `npm run format:check` | PASS |
| `npx tsc --noEmit` | PASS |
| i18n | **0 missing** |
| `npm run qa:refactor:staging -- --run p3-capstone-v3` | **30/30 E2E PASS** |

Evidence: `.cursor/skills/verify-perleap/evidence/p3-capstone-v3/`

Report: `.cursor/skills/verify-perleap/evidence/p3-capstone-v3/index.html`

## Phase 3 status

**Complete** — T1–T12 implemented and gated; capstone regression green on staging.
