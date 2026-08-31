# S5-8 — E2E Tracks G + I

## What changed

- Seeded `live_session` assignment + `ready` live_sessions row in verify sandbox
- Added features: `teacher-live-session-open`, `student-onboarding-complete`, `teacher-onboarding-complete`
- Suite expanded from 27 → 30 features in `refactor-regression.json`
- Onboarding uses disposable accounts via `verify:seed-onboarding` + profile reset

## How to verify

```bash
npm run verify:seed
npm run verify:seed-onboarding
npm run qa:refactor:watch
```

Pass: 30/30 E2E, unit tests green, i18n 0 missing.
