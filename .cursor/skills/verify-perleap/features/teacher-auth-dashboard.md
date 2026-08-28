# Teacher auth and dashboard

Teacher signs in and sees the dashboard with classrooms section or empty state.

## Sub-features

- `sign-in-email` — Email/password auth on `/auth`
- `dashboard-shell` — **Teacher Dashboard** heading and classrooms area

## How to get to it (user POV)

- Open `/auth`, sign in as teacher
- Redirect to `/teacher/dashboard`
- See **My Perleap's Classrooms** or **No classrooms yet**

## Driving it with Playwright

Preconditions:

- `npm run verify:login -- --role teacher` completed

Steps:

1. `npm run verify:feature -- --id teacher-auth-dashboard --run <run-id>`
2. **Observable result:** Screenshot shows Teacher Dashboard with classrooms list or empty state

## Gotchas

- Admin users may redirect differently — use a plain teacher test account
- Empty dashboard is valid proof for this feature (not for teacher-classroom-overview)
