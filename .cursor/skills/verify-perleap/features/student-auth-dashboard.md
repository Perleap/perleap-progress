# Student auth and dashboard

Student signs in with email/password and lands on the dashboard showing their classes section.

## Sub-features

- `sign-in-email` — Email/password auth on `/auth`
- `dashboard-shell` — Dashboard title and My Classes section visible

## How to get to it (user POV)

- Open `/auth`, enter credentials, click **Sign In**
- Redirect to `/student/dashboard` when profile exists
- Dashboard shows heading **Student Dashboard** and **My Classes**

Note: **My Assignments** and calendar sidebar are currently hidden (`STUDENT_DASHBOARD_SHOW_CALENDAR_AND_ASSIGNMENTS = false`).

## Driving it with Playwright

Preconditions:

- `npm run verify:launch` and `npm run verify:doctor` pass
- `npm run verify:login -- --role student` completed

Steps:

1. **Login (once):** `npm run verify:login -- --role student` — saves `.auth/student.json`
2. **Drive:** `npm run verify:feature -- --id student-auth-dashboard --run <run-id>`
3. **Observable result:** `manifest.json` shows `finalUrl` ending in `/student/dashboard`; screenshot shows **Student Dashboard** and **My Classes**

## Gotchas

- Unconfirmed email or incomplete onboarding redirects away from dashboard — fix test account first
- Google OAuth is not used in automation
- Do not use port 8080 if it is the developer's personal session
