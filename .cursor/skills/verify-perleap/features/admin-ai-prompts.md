# Admin AI prompts

Admin opens the student chat AI prompts management page.

## Sub-features

- `ai-prompts-shell` — `/admin/ai-prompts` loads
- `prompts-heading` — **Student chat AI prompts** visible

## How to get to it (user POV)

- Sign in as admin → navigate to **AI Prompts** (or `/admin/ai-prompts`)
- Page heading **Student chat AI prompts**

## Driving it with Playwright

Preconditions:

- `npm run verify:login -- --role admin`
- Admin account in `.env.verify`

Steps:

1. `npm run verify:feature -- --id admin-ai-prompts --run <run-id>`
2. **Observable result:** AI prompts heading in screenshot

## Gotchas

- Requires admin role — student/teacher auth storage will redirect or fail
- Part of refactor-regression suite only (not default smoke)
