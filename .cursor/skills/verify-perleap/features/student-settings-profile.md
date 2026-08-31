# Student settings profile

Student opens settings and sees the profile form with Full Name field.

## Sub-features

- `settings-shell` — `/student/settings` loads
- `profile-form` — **Full Name** labeled input visible

## How to get to it (user POV)

- Sign in as student → navigate to **Settings** (or `/student/settings`)
- Profile section shows editable **Full Name**

## Driving it with Playwright

Preconditions:

- `npm run verify:login -- --role student`

Steps:

1. `npm run verify:feature -- --id student-settings-profile --run <run-id>`
2. **Observable result:** `finalUrl` contains `/student/settings`; **Full Name** field visible

## Gotchas

- Read-only smoke — does not save profile changes
- Incomplete onboarding may redirect away from settings
