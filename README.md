# Vercel Swag Store

A fictional storefront built with Next.js 16, React Server Components,
Cache Components, Suspense, and Server Actions.

## Links

- Live application: https://vercel-swag-phi.vercel.app/
- Repository: https://github.com/KingKerr/Vercel-Swag

## Local development

Use Node.js 24.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local`.
3. Supply the assigned API bypass token.
4. Run `npm run dev`.

## Verification

- `npm run lint`
- `npm run test:unit`
- `npm run build`
- `npm run test:e2e`

Playwright starts the production server on port 3100.
Build the application before running the E2E suite.

## Rendering and data-freshness decisions

| Resource | Strategy | Reason |
| --- | --- | --- |
| Featured products | `use cache`, hours profile | Reusable catalog content |
| Product information | `use cache`, hours profile | Independent of live stock |
| Categories | `use cache`, hours profile | Reusable filter options |
| Promotions | Request-bound, Suspense | Upstream promotion can vary |
| Stock | Request-bound, Suspense | Availability can change per request |
| Cart | Uncached, session-dependent | Isolated to the browser session |
| Search results | Server-rendered from URL parameters | Shareable filtering state |

## Cart architecture

- Anonymous carts are stored by the supplied API.
- The cart token is held in an HTTP-only session cookie.
- Server Actions validate input and perform mutations.
- Prices and totals come from the API.
- Increasing quantities triggers a fresh stock check.
- Reductions and removal do not depend on current stock.
- A confirmed missing cart can be reset explicitly.
- Other upstream failures do not clear the session.

## Test coverage

Document the suites and actual verified results here.

Distinguish live browser integration tests from mocked action tests.

## Known limitations

- No checkout or payment processing.
- Inventory checks are not atomic reservations.
- Simultaneous mutations across tabs are not serialized.
- Simultaneous first-time adds can race during cart creation.
- An ambiguous failed mutation is not automatically retried.
- Browser acceptance tests depend on upstream API availability.
- Expired carts are reset rather than restored.