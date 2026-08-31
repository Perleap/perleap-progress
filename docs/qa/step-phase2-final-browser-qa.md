# Phase 2 final browser QA gate

## Prerequisites

- `.env.verify` with test accounts (see `.env.verify.example`)
- `VITE_SUPABASE_SECRET_KEY` in `.env.local` (seed + onboarding users)
- App port matches `VERIFY_PORT` (default 8086)

## Run (visible browser)

```bash
npm run verify:seed
npm run verify:seed-onboarding
npm run qa:refactor:watch -- --run phase2-final-<date>
```

## Pass criteria

| Gate | Expected |
|------|----------|
| Unit tests | 250/250 |
| i18n | 0 missing keys |
| E2E | **30/30** features |
| Track G | `teacher-live-session-open` |
| Track I | `student-onboarding-complete`, `teacher-onboarding-complete` |
| Report | `.cursor/skills/verify-perleap/evidence/<run-id>/index.html` all green |

## Suite features (30)

See [refactor-regression.json](.cursor/skills/verify-perleap/features/suites/refactor-regression.json)
