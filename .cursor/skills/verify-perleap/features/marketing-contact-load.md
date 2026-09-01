# Marketing contact load

Anonymous visitor opens `/contact` and sees the contact form (UI-only submit; no backend).

## Sub-features

- `contact-form` — **Send us a Message**, First Name field, **Send Message** button

## Driving it with Playwright

1. `npm run verify:feature -- --id marketing-contact-load --run <run-id>`
2. **Observable result:** form fields and submit button visible
