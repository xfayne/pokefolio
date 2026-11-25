# Deals migration (#15)

Owner approved manual Find deals and Wishlist scope picker on 2026-11-25. The existing staging Worker supplies eBay search, item-condition, item-images and analysis endpoints. No Worker or Firestore rule changes are needed.

- Wishlist scope defaults to all current cards. Browser-only, owner-specific exclusions leave new card IDs included and never mutate wishlist order or binder pockets.
- Single-card scope from Card Details bypasses the exclusions and does not start until the user presses Find deals.
- Explicit scans snapshot card selection and use sequential batches of four with a 500ms delay; pause aborts in-flight work, resume continues at the last completed batch. Partial provider errors remain visible; throttling stops rather than skipping the affected batch. Results are deduplicated.
- React results reuse exact-printing condition prices, display-currency FX, strong/review matching, shipping-inclusive comparison and legacy ranking groups. Unknown shipping or price never gives a discount; review matches cannot receive a recommendation. Filters apply locally to results.
- Top 18 unresolved matches receive bounded seller detail lookups following an explicit completed scan; per-item lookup remains available. Listing image metadata loads on opening the gallery. AI runs only on its explicit button; saved analysis is labeled and never used to rank without a new analysis, because photos may change. Manual overrides retain priority. No credentials are stored in the browser.
- Scope and postal code are stored locally per owner. The screen does not mutate inventory, Wishlist, Binder or transactions. AI saves use the already established owner-specific analysis service. No legacy or production writes.

Completed scans are cached in memory for 30 minutes by owner, scope, exact printing and postal code; revisiting never starts a scan. Manual comparison-grade changes retain result positions until a new sort/filter/run. Multiple condition selection is local. Purchase draft handoff is explicitly deferred by the owner (2026-11-25); no transaction UI or data changes are included.

Remaining verification: full visual and authenticated staging acceptance.  No release is claimed until the current PR checks and staging deployment pass.
