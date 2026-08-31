# S5-5 — TypeScript strict

## What changed

- `tsconfig.app.json`: `"strict": true`
- Fixed 23 pre-existing tsc errors + ~123 strict-mode errors (Select null handlers, refs, Json casts)

## How to verify

```bash
npx tsc --noEmit -p tsconfig.app.json   # 0 errors
npm run test:run                         # 250 passed
npm run qa:refactor:watch                # 30/30 E2E
```
