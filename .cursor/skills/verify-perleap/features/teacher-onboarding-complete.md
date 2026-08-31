# Teacher onboarding complete

Dedicated onboarding teacher completes the 2-step wizard and lands on the dashboard.

## Preconditions

- `npm run verify:seed-onboarding`
- `npm run verify:reset-onboarding -- --role teacher`
- `npm run verify:login-onboarding -- --role teacher`

## Steps

1. `npm run verify:feature -- --id teacher-onboarding-complete --run <run-id>`
2. **Observable result:** Teacher dashboard with **My Perleap's Classrooms**

## Gotchas

- Uses `onboarding-teacher` auth state — not the main verify teacher account
