# Teacher settings profile

Teacher opens settings and sees the profile form with Full Name field.

## Sub-features

- `settings-shell` — `/teacher/settings` loads
- `profile-form` — **Full Name** labeled input visible

## How to get to it (user POV)

- Sign in as teacher → **Settings** or `/teacher/settings`
- Profile section shows **Full Name** field

## Driving it with Playwright

Preconditions:

- `npm run verify:login -- --role teacher`

Steps:

1. `npm run verify:feature -- --id teacher-settings-profile --run <run-id>`
2. **Observable result:** `finalUrl` contains `/teacher/settings`; **Full Name** visible

## Gotchas

- Read-only smoke — no profile save asserted
- Uses same form patterns as student settings (shared profile fields)
