# Marketing nav links

Anonymous visitor on `/` clicks **Product** in the navbar and reaches the product page.

## Sub-features

- `navbar-product` — desktop nav **Product** link
- `product-hero` — **Intelligent Agents for** heading on `/product`

## Driving it with Playwright

1. `npm run verify:feature -- --id marketing-nav-links --run <run-id>`
2. **Observable result:** URL includes `/product`; product hero heading visible

## Gotchas

- Requires desktop viewport so navbar links are visible (not mobile menu)
