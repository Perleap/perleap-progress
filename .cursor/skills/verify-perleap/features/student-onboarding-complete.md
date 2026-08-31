# Student onboarding complete

Dedicated onboarding student completes the 6-step wizard and lands on the dashboard.

## Preconditions

- `npm run verify:seed-onboarding` (creates disposable auth users if needed)
- `npm run verify:reset-onboarding -- --role student`
- `npm run verify:login-onboarding -- --role student`

## Steps

1. `npm run verify:feature -- --id student-onboarding-complete --run <run-id>`
2. **Observable result:** Student Dashboard after **Complete Setup**

## Gotchas

- Uses `onboarding-student` auth state — not the main verify student account
- Profile is recreated each suite run via reset-onboarding
