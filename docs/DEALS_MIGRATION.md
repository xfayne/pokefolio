# Deals migration (#15)

Owner approved the manual-search and scope picker mock on 2026-11-25. The legacy engine is the behavioral reference; the staging Worker already provides search, item-condition, item-images and analysis endpoints. No Worker or Firestore changes are required for this increment.

- Wishlist scope defaults to all current cards. Browser-only, owner-specific exclusions leave new Wishlist cards included and never mutate wishlist order or binder pockets.
- Single-card scope bypasses Wishlist exclusions. Opening either scope must not start a search.
- Explicit runs snapshot card selection and use sequential batches of four with a 500ms delay; cancel stale requests, deduplicate and stop at throttling. Unknown shipping is not free.
- Keep exact printing references, condition-specific prices, review-only listings below strong matches, and legacy ranking groups.
- Follow-up before enabling the route: React scope picker/results, all legacy filters, price/FX integration, seller enrichment, lazy gallery, AI analysis reuse, card detail action and draft purchase handoff. Verify CI and mobile behavior before release.

This commit adds isolated scan/scope/ranking modules and focused unit regressions. It does not yet activate the Deals route. No legacy or production data is accessed or changed.
