# Pokefolio design decisions

## Consolidated design handoff — 2026-11-20

This section records the owner's explicit approvals and subsequent corrections from the design session. It supersedes conflicting older mock imagery and the Search/Settings proposals in earlier comments. It is a **design handoff, not a completion or deployment receipt**. Issue #4 remains open; no runtime, data model, migration or live-data operation is authorized by this documentation update.

### Approved references and outstanding visual work

| Screen / artifact | Status | Reference |
| --- | --- | --- |
| Shared design system | Approved | [View mock](./approved/design-system.png) |
| Dashboard | Approved | [View mock](./approved/dashboard.png) |
| Collection / Overview | Approved; later refinements allowed | [View mock](./approved/collection-overview.png) |
| Collection / Cards | Approved | [View mock](./approved/collection-cards.png) |
| Collection / Binder | Approved; preserve existing behavior | [View mock](./approved/collection-binder.png) |
| Wishlist / Cards | Approved with label correction below | [View mock](./approved/wishlist-cards.png) |
| Wishlist / Deals | Saved baseline; further refinements required | [View mock](./proposals/wishlist-deals-proposal.png) |
| Analyze / Photos + Results | Approved Classic Red (A) | [View mock](./approved/analyze-classic-red.png) |
| Transactions / History | Approved with subsequent removal of internal tabs | [View mock](./approved/transactions-history.png) |
| Purchase details | Approved | [View mock](./approved/purchase-details.png) |
| New purchase / Per-card costs | Approved | [View mock](./approved/new-purchase-per-card.png) |
| New purchase / Total or lot | Approved | [View mock](./approved/new-purchase-lot.png) |
| New sale | Approved; confirmed in existing issue discussion | [View mock](./approved/new-sale.png) |
| Global catalog search | Approved full-screen sheet; supersedes prior search proposals | [View mock](./approved/catalog-search.png) |
| Catalog / Card details | Approved 2026-11-20 | [View mock](./approved/card-details.png) |

References now point to versioned images in the repository. See the [visual design index](./README.md). Older rejected Search/Settings proposals are not fallback specifications.

### Shared design system

- Adventure Blue is the approved main application direction: navy header/navigation, pale blue canvas, white surfaces, blue actions, compact lists and spacious summaries.
- Tailwind-first: prefer built-in utility classes and scales; define genuinely shared semantic roles through the existing Tailwind v4 theme. Use locally owned shadcn/ui components and the existing icon library, not another UI framework.
- Proposed font choices were accepted with the shared board: Inter for Latin and Noto Sans Hebrew, with sans-serif fallbacks.
- [Exact token / utility specification](./design-system.md) accompanies the board. Its original “proposed” header predates the owner's visual approval; later decisions in this issue override stale sections.
- English-first with Hebrew/RTL, >=16px mobile input text, visible keyboard focus, accessible contrast/targets, safe areas and reduced-motion support.
- Generated imagery is visual guidance; precise palette/font rendering must use actual theme/font values. Demo art, prices and dates are not production data.

### Navigation and modal behavior

- Bottom: **Collection · Wishlist · raised Poké Ball / Dashboard · Analyze · Transactions**. Dashboard remains the default route. Raised central ball does not imply selection on other routes.
- Top: **Search and Settings**. Settings remains a top action, but the owner explicitly deferred its screen-specific mock; previous rejected Settings designs are not approved.
- Collection internal tabs: **Overview · Cards · Binder**.
- Wishlist internal tabs: **Cards · Deals**. Replace the inner “Wishlist” label still visible in the approved list image. [Approval note](./decisions.md#wishlist-label-correction).
- **Remove the separate Shipments tab**, and the redundant History/Shipments tab strip from Transactions. Keep shipment status/unread updates in transaction rows and tracking history in transaction details. The stand-alone shipment mock was rejected as redundant and must not be implemented.
- An “In transit” transaction filter was suggested but has **not been separately approved**; do not silently add new filter behavior.
- Global catalog opens as a **full-screen modal sheet rising from below**, with no bottom navigation visible. Close X restores the originating screen and its scroll/filter state. Catalog results open card details within the sheet; back returns to search results; X closes the entire catalog.
- Collection/Wishlist local searches remain scoped to their own lists.

### Screen-specific decisions

**Dashboard**
- Order: Collection Value chart → Recent Acquisitions → This Month → Top Holdings.
- Chart time choices: **1M / 3M / 1Y / All**.
- Remove the “P/L on known-cost holdings” note.
- Keep This Month spacious, with clear header/metric/footer separation.

**Collection and Wishlist**
- Cards list groups catalog cards and expands to individual physical copies with condition, cost and market value distinguished.
- Preserve Binder 3×3 page layout, positions, reserved empty pockets, page movement, landscape/shared viewing behavior and Wishlist overlays; no behavioral redesign.
- Preserve custom Wishlist drag ordering; drag remains unavailable under alternate sorting.
- The approved card detail example includes owned-copy context and an unselected Add to Wishlist action; do not conflate ownership state with Wishlist button state.

**Analyze**
- Approved exception to the blue application body: **Classic Red / A**, inspired by a Pokédex, with blue lens, light display and shared navy navigation.
- Approved entry/results pair: photo inputs and results with front/back photographs, localized numbered defect markers, condition and confidence.
- Preserve Photos/eBay entry modes. Analysis is manual, never auto-triggered.
- Photo-based output remains an estimate; mock findings are illustrative, not actual analyzed user images.

**Transactions**
- Under each month heading, show only a **small plain signed net cash-flow amount**, e.g. −$227.00. No summary boxes, Spent/Received columns or extra label.
- Remove “Amounts shown in USD” copy.
- Monthly net is money received minus money spent, not realized profit or market performance. Final refund/fee/currency semantics belong to the approved financial model work.
- Ordinary purchases record per-copy costs. Purchase shipping splits equally across physical copies.
- Total/lot mode records the transaction subtotal while unknown individual card costs stay explicitly unassigned. Do not invent zero values or automatically allocate card subtotal equally. Known shipping shares remain separate.
- New sale selects specific owned copies; distinguishes sale prices, buyer shipping receipts, selling fees and shipping paid by the seller. Net proceeds is distinct from profit.
- Tracking details are optional when recording a purchase/sale; a missing tracking number must not prevent recording an otherwise valid transaction.

**Catalog / card details**
- Large inspectable image, explicit variant identity, condition-based per-copy market price, owned-copy context and purchase link.
- Wishlist / Find deals / Record purchase actions as shown; Record purchase opens the transaction workflow, not unrestricted one-tap inventory creation.
- Settings design is intentionally outside this mock round, not approved by omission.

### Remaining work and implementation boundary

- [x] Consolidate explicitly approved main-screen designs and latest product corrections.
- [ ] Resolve remaining Deals visual refinements; a later saved Deals image alone is not evidence of owner approval.
- [ ] During implementation of each approved screen, define/verify responsive layouts, keyboard/software-keyboard behavior, empty/loading/error states and Hebrew/RTL. Existing mocks do not independently prove those checks passed.
- [ ] Implement shared tokens, shared UI elements and approved navigation in focused PRs under #4 after inspecting current main/#3 status.
- [ ] Implement screen business behavior in the relevant roadmap issues, respecting transaction/inventory/data-model dependencies. Do not implement all future screens as one #4 rewrite.
- [ ] Run meaningful automated, accessibility and visual checks and fix CI before merging. No claim of tested/deployed UI is made here.
- [ ] Reconcile stale README/PROJECT_CONTEXT design/navigation descriptions as part of the appropriate documentation/implementation PR.

Settings mock deferral does not waive eventual Search/Settings functionality, accessibility or other existing acceptance checks. Keep the original engineering and data-safety guardrails above.

## Wishlist label correction

The page heading is Wishlist. Its internal tabs are **Cards** and **Deals**. The old inner Wishlist label in the image must be replaced with Cards.

## Transaction navigation correction

The History image predates the decision to remove the History/Shipments strip. Transactions is a single history view with tracking in details; the rejected standalone tracking screen is deliberately not included.

## Approved Transactions Overview — 2026-11-20

Supersedes the single-history layout above: Transactions has **Overview / History**. No Shipments tab. [Approved mock](approved/transactions-overview.png). Overview provides period selection, purchase spend, net sale receipts, net cash flow, a monthly comparison chart, physical-copy activity and month drilldown to History. Cash flow is distinct from profit. Preserve previously approved bottom-navigation icons; incidental generated icon differences are not a redesign approval.
