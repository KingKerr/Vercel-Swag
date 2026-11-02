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
E2E Tests with Playwright:
```
Running 7 tests using 1 worker

  ✓  1 …romium] › tests/e2e/storefront.spec.ts:11:5 › homepage displays at least six correctly contained products (3.4s)
  ✓  2 …mium] › tests/e2e/storefront.spec.ts:52:5 › a featured product opens a detail page with purchase controls (5.7s)
  ✓  3 [chromium] › tests/e2e/storefront.spec.ts:86:5 › search submits query and category into the URL (8.3s)
  ✓  4 …hromium] › tests/e2e/storefront.spec.ts:126:5 › search distinguishes an empty result from a loading state (1.2s)
  ✓  5 …mium] › tests/e2e/storefront.spec.ts:143:5 › invalid category displays validation instead of querying it (401ms)
  ✓  6 [chromium] › tests/e2e/storefront.spec.ts:156:5 › empty cart opens, closes with Escape, and restores focus (2.0s)
  ✓  7 [chromium] › tests/e2e/storefront.spec.ts:185:5 › mobile storefront does not overflow horizontally (2.5s)

  7 passed (24.6s)
```

Cart Tests with Vitest:  
```
 ✓ tests/unit/cart-actions.test.ts (11 tests) 13ms
   ✓ addToCartAction (5)
     ✓ rejects an invalid quantity without calling the API 10ms
     ✓ creates a cart lazily and saves its token before adding 1ms
     ✓ checks existing cart quantity plus the requested addition 0ms
     ✓ does not retry an ambiguous add failure 0ms
     ✓ does not silently replace an expired cart during an add 0ms
   ✓ editCartAction (3)
     ✓ removes an item even if the quantity field is empty 0ms
     ✓ allows quantity reductions without checking stock 0ms
     ✓ rejects an increase above current stock 0ms
   ✓ resetExpiredCartAction (3)
     ✓ clears the session after a confirmed missing-cart response 0ms
     ✓ preserves an active cart instead of clearing it 0ms
     ✓ preserves the session when the API is unavailable 0ms

 Test Files  1 passed (1)
      Tests  11 passed (11)  
```

## Known limitations

- No checkout or payment processing.
- Inventory checks are not atomic reservations.
- Simultaneous mutations across tabs are not serialized.
- Simultaneous first-time adds can race during cart creation.
- An ambiguous failed mutation is not automatically retried.
- Browser acceptance tests depend on upstream API availability.
- Expired carts are reset rather than restored.
