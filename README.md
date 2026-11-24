# Pokefolio

Mobile-first Pokémon card portfolio application built with React, TypeScript and Vite. The new application lives in `frontend/`. Legacy Vanilla JS files remain as reference only and are not bundled or loaded by the React entrypoint.

## Development

Use Node 24 LTS (24.11 or newer).

```sh
cd frontend
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Open http://localhost:5173/pokefolio/. The Adventure Blue shell defaults to Dashboard, supports hash routes and nested section navigation, and switches English/Hebrew with RTL through Settings. Search opens a full-screen catalog shell, preserving its background route; catalog results remain future work. Routes are placeholders for future screen-specific approved designs, not completed product screens. Binder and Wishlist implementation must retain the reference behavior and ordering requirements.

## Architecture

- React Router for hash navigation on GitHub Pages.
- Tailwind and locally owned shadcn/ui components; add only needed components.
- Named `react-icons/lu` imports for shared icons, with self-hosted Nunito Sans and Noto Sans Hebrew.
- Axios for API transport and TanStack Query for remote API state.
- Firebase SDK for Auth/Firestore, with typed services and auth subscriptions.
- Zustand for transient UI state only; never duplicate collection data or tokens in it.
- React Hook Form + Zod for forms/boundary validation; i18next for localization.
- Vitest, Testing Library, Playwright and ESLint for verification.

Local development is disconnected unless supplied the exact validated staging configuration. The frontend rejects foreign/production Firebase projects and alternate API origins. It performs no collection migration. Signed-in purchases and copy edits use isolated owner subcollections; the legacy progress root is untouched. The approved inventory/transaction domain is defined under `frontend/src/domain/`; live persistence adapters remain separate roadmap work.

## Environments and release

[Staging](https://xfayne.github.io/pokefolio/) publishes from protected main after five current-main checks: staging isolation, JavaScript parity, style parity, Firestore rules and React foundation. The build uses the registered `pokefolio-staging` Web configuration and independent `pokefolio-api-staging`; only the new Vite artifact is shipped. The manifest records its exact source SHA and application. No legacy controllers or backend source are packaged.

Production Firebase/API are already provisioned with authorized provider secrets. Production frontend cutover and any approved real-data import remain #21. The independent [Vintage Binder production app](https://xfayne.github.io/pokemon-vintage-binder/) is unchanged.

## Reference and data safety

Reference source remains in root `index.html`, `templates/`, `js/`, `css/` and `deal-finder/`. Reference index regeneration uses `node scripts/build-index.mjs`; retained regression/security checks continue to run. There is no compatibility bridge or requirement to operate those old screens in Pokefolio.

Never modify legacy production Firestore data. Real data transfer needs an independently verified backup, approved migration, dry-run integrity checks and rollback. Preserve binder positions, empty pockets, page ordering and manual Wishlist ordering.

See [Project context](PROJECT_CONTEXT.md), [React foundation](frontend/README.md), [Production setup](docs/PRODUCTION_SETUP.md), and [safe import](docs/SAFE_IMPORT.md).

Issue #5 starts with the [transaction/inventory domain proposal](docs/DOMAIN_MODEL_PROPOSAL.md).
Its schema and financial policies were owner-approved on 2026-11-20. Typed records,
allocation/lifecycle primitives and persistence contracts live in the [domain module](frontend/src/domain/README.md); live database adapters and screen workflows remain separate roadmap work.

## Safe legacy import tooling

Offline backup, read-only mapping, schema-validated purchase/copy conversion and
isolated filesystem apply/replay/rollback are described in the
[import runbook](docs/LEGACY_IMPORT_RUNBOOK.md). These tools use supplied JSON and
synthetic tests; they do not migrate live Firestore data or expose a new app screen.
Real-data transfer remains a separately approved release step under #21.


Physical-copy inventory (#7) is available under Collection → Cards. The explicitly
labelled [sample collection](https://xfayne.github.io/pokefolio/#/collection/cards?inventory=sample)
uses the approved compact Cards/Card Details layout and lets you expand copies and edit one copy in memory; it contains no real holdings.
Live account persistence and full purchase navigation follow in #8/#21.
See [physical-copy rules](docs/COPY_INVENTORY.md).

Reusable approved presentation primitives are documented in the [shared UI guide](frontend/src/components/ui/README.md). Reuse these for future screens rather than duplicating styles or copy-specific disclosure defaults.

## Transaction history (#8, first screen)

Transactions opens Overview, with History as its second tab. History follows the
2026-11-20 approved mock, including the monthly net transaction total beside the
month. Search, purchase/sale filters and collapsed currency/status filters operate
on original transaction records. Monthly totals keep currencies separate and
identify missing amounts; they are not cash flow or profit.

The [sample history](https://xfayne.github.io/pokefolio/#/transactions/history?transactions=sample)
is explicitly opt-in and synthetic. The ordinary route reports that account
storage is not connected. Sale recording and sale details remain unavailable until their separately
approved screens are implemented. Purchase rows open the approved Purchase Details screen. Overview remains a placeholder until its screen is
implemented; the former Transactions Shipments URL redirects to Overview. This step does not finish #8 or write to Firestore.

Purchase Details follows the approved 2026-11-20 mock: acquisition summary,
individual physical-copy card costs, original-currency cost breakdown and
read-only shipment timeline. The sample purchase reconciles 52 + 46 + 32 + 12 =
142 USD, including 4 USD shipping per copy. Card rows inspect the exact copy
through the existing card sheet; tracking copy uses the full sample number.
Shipment snapshots are synthetic; live tracking and persistence remain pending.
The shared bold weight is 700 throughout the UI, matching Collection card names.

New Purchase follows the approved creation mock at `#/transactions/new`. The
explicit [sample form](https://xfayne.github.io/pokefolio/#/transactions/new?transactions=sample)
starts with the three example copies and can save a new pending demo purchase,
then open it in Purchase Details and History. Demo records live only for this
app session; ordinary routes never load them or save account records.

Unsaved form drafts are transient UI state, separated by sample/account mode.
Per-copy prices are required; lot totals leave individual costs unallocated.
Shipping uses deterministic integer-cent allocation. Changing currency clears
amounts with immediate undo, without pretending to convert. Shipment fields
default closed and create no tracking registrations or invented events.
Payment is unknown until explicitly confirmed; this form does not invent a cash
movement. Account persistence remains pending. Add card awaits the separately
approved card-picker mock; Sale remains #9.

The global Search and New Purchase → Add card share the approved full-screen
catalog search: text/set search, List/Grid, bounded result rendering and existing
Card Details. Each picker selection adds one independent copy with a required
price; selecting the same card again adds another copy. Catalog data is local
and includes the retained vintage sets, secret numbering and Ancient Mew. New
selection edition/finish stay unknown until explicitly chosen. This increment
does not enable account persistence or finish Issue #8.

Catalog Card Details loads condition-specific USD market quotes through the
existing TCGTracking source with exact printing matching, loading/error/retry and
no invented prices. Catalog entry alone uses a subtle transition; other Card
Details entry points retain the original slide animation.

Catalog filters accept multiple sets and retain selection when returning from
Card Details. WoTC Promo price matching uses verified standard product IDs and
actual SKU finishes, keeping alternate printings separate.

Catalog filters animate with the shared disclosure, lay sets out in a mobile grid,
and combine Energy/Trainer exclusions with Holo-only and multi-set/text search.
Owned/Wishlist row badges render only from caller-supplied data. Real account
holdings/Wishlist remain disconnected; explicit sample contexts provide demo counts.

## Purchase account integration (#8)

The account integration supersedes the earlier disconnected-preview notes above.
Sign in with Google through Settings to save purchases, read History/Cards/Details
and open purchases from Dashboard or an exact copy. Saving is direct; editing uses
the same form, immutable audit records and expected revisions. First Edition
checkboxes select copy editions and exact printing prices. Listing URL/order
references are optional. No legacy import, destructive migration or production
cutover is included. See [persistence and staging acceptance](docs/PURCHASE_PERSISTENCE.md)
for the verified live journey, paths, safeguards and atomic edit limits.
Imported purchase corrections use the same form and require known card prices.
Explicitly entered shipping is split across physical copies, with card totals and
owner-confirmed purchase totals reconciled without inventing historical FX or
payment evidence. Grouped immutable audit snapshots allow 20+ corrections in one
owner-scoped atomic Firestore transaction; original acquisition dates and import
provenance are retained.

Display currency is selected in Settings and saved per owner. Read-only market
prices, copy costs, purchase details, recent purchases and History share the same
reference-rate conversion; History has one converted total per month. Purchase/sale
forms always retain their original currency. Reference FX does not rewrite costs,
payments or historical analytics. Missing conversions are shown as unavailable.

## Sale transactions (#9)

The Sale option in New transaction selects specific received, unsold copies from
account inventory. Each selected copy has its own sale price; buyer shipping,
fees, seller shipping and taxes reconcile to net proceeds. Sale Details links the
original acquisitions and displays known/estimated/unavailable realized P/L.
Read-only amounts use display currency; entry/edit retains transaction currency.
Sales support audited fixed-membership editing and explicit reversal that restores
the same copies. Reversed transactions remain visible without affecting monthly
totals. Pending receipt remains #11; Binder/Wishlist ordering is untouched.
See [sale contracts and verification](docs/SALE_TRANSACTIONS.md).
The [sample sale form](https://xfayne.github.io/pokefolio/#/transactions/new-sale?transactions=sample)
is synthetic and memory-only; sample sale changes reset on reload.

## Purchase receipt and tracking (#11)

One purchase has at most one optional shipment, entered through the existing
purchase form. Purchase Details uses the existing 17TRACK Worker for registration,
refresh and events. The Transactions badge counts unread events; viewing the
purchase marks them read. Initial provider history is a read baseline.
The header Received action manually receives the same physical copies, with or
without tracking. It stays visible and disabled after receipt. Provider delivery
never confirms receipt automatically. Costs, Binder and Wishlist are untouched.
See [receipt and tracking contracts](docs/PURCHASE_TRACKING.md).

## Card condition analyzer (#16)

Analyze now has the approved Classic Red Pokédex frame, tactile controls, scoped
pixel typography and request-driven lens/indicator animations. Upload/capture up
to eight photos or load an eBay listing, then explicitly start analysis. Results
are unified in one numbered photo gallery with linked defect markers,
grade distribution and limitations. The existing Worker grader is reused;
eBay evidence caches are owner-scoped, uploaded photos remain in memory, and
save-only retry does not call AI again. See [analyzer contracts](docs/ANALYZER.md).

## Collection Binder (#13)

Collection → Binder implements the approved fixed 3×3 book with touch drag,
page arrows/swipe, exact-copy placement, reserved gaps, page movement and a
read-only landscape viewer. Card taps do not open details. The account layout
has isolated owner-only, revision-checked persistence. Sharing explicitly
publishes a catalog-only snapshot through the existing revocable link policy.
See [Binder behavior and persistence](docs/BINDER.md). The
[sample binder](https://xfayne.github.io/pokefolio/#/collection/binder?inventory=sample)
is synthetic and session-only; no legacy data is imported.

## Wishlist Cards (#14, #115)

Wishlist → Cards uses the approved compact mobile list with owner-specific
manual priority order, search, name/price sorting, per-condition market quotes
and a numeric position modal on long press. The drag grip supports touch and
keyboard reordering only in Custom order. Catalog and Collection Card Details
now offer Add/Remove Wishlist actions rather than a disabled stub.

The data is stored independently under `users/{uid}/wishlists/main` with
revision-checked Firestore transactions. It never removes acquired wishes or
changes Binder pockets. [Sample Wishlist](https://xfayne.github.io/pokefolio/#/wishlist/cards?wishlist=sample)
is synthetic and session-only. The private Wishlist rules were deployed and independently read back from
**Pokefolio staging** on 2026-11-23. Authenticated live Add/Remove/reorder/reload acceptance remains unverified (owner waived this extra smoke test for #14 closure). Frontend merges now require successful
staging Rules promotion before Pages deployment. See [Wishlist contracts](docs/WISHLIST.md).

## Automatic staging Firestore Rules deployment

After the one-time Google Cloud keyless OIDC trust setup, the protected-main
Staging Preview workflow publishes only changed `firebase/firestore.private.rules`
to `pokefolio-staging` and reads the live release back **before** publishing
GitHub Pages. Unexpected policy drift stops the deployment; no separate
automatic production workflow exists. The one-time Google Cloud IAM bootstrap is complete and the gate is active;
the first staged Rules release and Pages deployment both succeeded on 2026-11-23.

See [Staging Rules CI/CD](docs/FIRESTORE_RULES_CICD.md) for exact fixed project
identifiers, the no-key setup, acceptance tests and rollback.

## Wishlist and Binder navigation (2026-11-23)

Binder's empty-pocket picker now accepts unplaced cards from the account Wishlist
as **wish** pockets (not owned copies), alongside eligible physical copies.
A sole eligible physical copy keeps its one-tap selection; multiple copies
and Wishlist reservations offer a choice. Wishlist membership and priority order are
never mutated by binder placement. Collection/Wishlist/Transactions use shared
sticky section navigation; Card Details uses a compact Wishlist removal action.
See [Wishlist behavior and verification](docs/WISHLIST.md).

## Wishlist experience scope closed (#14, 2026-11-23)

The owner accepted the compact Wishlist Cards implementation and explicitly
removed the proposed 3–5-card Spotlight from scope. Issue #14 is closed by owner
acceptance; #115 still owns the Deals handoff. Existing automated unit, security
emulator and mobile E2E checks passed. A separately authenticated staging
Add/Remove/reorder/reload round-trip and a measured several-hundred-card
performance benchmark **were not independently run** and must not be presented
as verified. If a practical issue appears, track it in a focused regression.
The Binder bottom-bar round-corner regression was fixed separately by #132.

Catalog and Wishlist Card Details reuse the signed-in inventory selector and the
existing Your copies panel, including pending acquisitions, exact purchase links
and audited copy edits. Explicit sample views do not expose account copies.
