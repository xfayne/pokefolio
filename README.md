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

Local development is disconnected unless supplied the exact validated staging configuration. The frontend rejects foreign/production Firebase projects and alternate API origins. It performs no collection migration or Firestore writes. The approved inventory/transaction domain is defined under `frontend/src/domain/`; live persistence adapters remain separate roadmap work.

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
