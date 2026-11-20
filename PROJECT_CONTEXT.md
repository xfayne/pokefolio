# Pokefolio — Project Context

_Last updated: 2026-11-19 — independent Production Firebase/API provisioned; staging Pages remains unchanged; production frontend release pending._

## Source of truth

- New repository: https://github.com/xfayne/pokefolio
- Legacy production repository: https://github.com/xfayne/pokemon-vintage-binder
- Roadmap: https://github.com/xfayne/pokefolio/issues
- Source snapshot pinned to legacy main commit `16b89318e77ebea3180461824a09711ae3f93782`.
- Original legacy README and project context are retained verbatim in `docs/LEGACY_README.md` and `docs/LEGACY_PROJECT_CONTEXT.md`. They describe the **legacy** implementation, not Pokefolio deployment status.

## Current state

The safe legacy baseline was imported in PRs #22–#23. The owner approved a fresh React foundation in #3. The new application is in `frontend/`; retained Vanilla JS source is reference only, with no compatibility bridge and no old screens loaded in the new app.

- **Firebase:** independent `pokefolio-staging`, project number `403637067452`, Spark plan; Standard `(default)` Firestore in `europe-west1`. Google sign-in and Web app `1:403637067452:web:ea6738aebf38f14c637ab9` are configured independently. Authorized domains are `localhost`, `pokefolio-staging.firebaseapp.com`, `pokefolio-staging.web.app` and `xfayne.github.io`.
- **Active Firestore policy:** `firebase/firestore.private.rules` from merged PR #36 (blob `4ab7d9b12274af9b631591dabb348d5504f3a03d`) was published only to staging after 24 emulator tests passed. Private roots/settings/analyses retain their owner-only policy. Public schema-v2 binder projections permit single-document gets only when the owner's settings enable that exact link; collection listing, foreign writes, ownership changes and extra/private fields remain denied. The public payload encodes only catalog references and pocket kinds, preserving ordering and empty pockets; private progress is unchanged. Publication atomically commits the snapshot and matching opt-in. Disabling/rotating owner settings revokes old reads without deleting data.
- **Live verification:** a temporary localhost diagnostic verified staging token issuer/audience, own missing collection read, rejected cross-user reads/writes and enumeration, one synthetic analysis create/read/update, rejected invalid update/root deletion/public access, and rejected private reads after sign-out. One explicitly synthetic analysis record remains in staging. The live public-sharing check additionally created one empty public binder projection and owner sharing settings; it did not create/edit the private collection root, Wishlist, binder order or shipments.
- **Rollback:** `firebase/firestore.rules` remains the deny-all bootstrap/rollback source. The pinned `scripts/firebase-staging.mjs` wrapper can deploy only that policy to the exact staging project. Its local validation is tested; remote CLI deployment remains unverified in this restricted terminal.
- **Cloudflare:** `pokefolio-api-staging` contains all five authorized provider secrets in its active API deployment. The older empty `pokefolio-ebay-deals-staging` service was verified to have no deployments/bindings/secrets and retired. Full Worker source is pinned to staging Firebase and has signed-token scenarios covering identity isolation. Merged PR #38 API source `1d55e3a3fe5e918ad59f738c6266e7942c496925` is deployed (version `c191f5cb-e28a-449a-8da2-752b928f7016`, deployment `6070c433-bbba-43e0-bbb5-88e436439a01`) with workers.dev enabled and preview URLs disabled. Live API health/search passed, including 24 eBay results with zero provider errors. The unchanged Gemini core returned a valid photo analysis; the configured model and 17TRACK read-only quota were verified. No KV binding is used by the imported Worker, so no unused namespace was created.
- **GitHub:** active main ruleset `27585981` requires a PR, up-to-date `staging-isolation`, `javascript-parity`, `style-parity` and `firestore-rules` checks from GitHub Actions, with zero manual approvals, no bypass actors and deletion/force pushes blocked. Settings were independently read back through the API.
- **Frontend:** cloud connections still default to disabled. The runtime gate accepts only `pokefolio-staging` and the exact independent Worker URL, drops alternate Firebase service endpoints, and never initializes the legacy project. Currency and postal preferences use Pokefolio-only browser keys; no legacy key is read, changed or deleted.
- **Hosting/providers:** the protected-main Pages workflow now packages a staging-only frontend after verifying the current main SHA and all four checks. It accepts only the registered staging public Web configuration from a repository Actions variable, excludes backend/docs/hidden files, injects runtime settings before the safety gate, marks the environment and emits a non-sensitive source manifest. The Pages workflow can opt into the exact registered API URL manually with `enable_api`, or automatically after successful current-main push CI. Both paths independently require all four current-main checks. Pages uses the Actions source and https://xfayne.github.io/pokefolio/ was deployed successfully by run `44466136119` from main `4dd48e00b60fdb21cb3c303fff5e3e78362d28b1`, after all four required checks passed. The `pokefolio-staging` deployment environment permits only the `main` branch (no tags). That historical deployment matched its SHA, staging Firebase and disabled Worker; the catalog loads with an empty collection and a visible staging marker. After explicit user authorization, a fresh Google sign-in from the deployed Pages URL succeeded on 2026-11-19; the app confirmed the private collection loaded successfully from Firestore. No collection changes, import or manual sync writes were performed. The earlier localhost synthetic owner/cross-user authorization checks also passed. Public binder publication and read-only viewing were verified live, including a reload after owner sign-out. The staging binder is empty; nonempty ordering/empty-pocket/full-capacity cases passed automated tests. The API is active. Pages activates it only through the protected-main deployment workflow; consult the live manifest and Issue #2 acceptance receipt for the deployed frontend SHA. Shipment registration is enabled with `TRACK17_MUTATIONS_ENABLED="true"` following explicit owner authorization on 2026-11-19 to use the shared 17TRACK account. Registration adds tracking numbers to the shared provider account and consumes its quota; it does not edit Vintage Binder Firestore or delete/unregister existing shipments. Tests use mocked upstream calls. The user authorized reuse of legacy provider keys on 2026-11-19; Cloudflare's existing secret-text bindings expose names but not values, and no local Worker key file was found. All five values were recovered through an authenticated expiring encrypted version URL and securely imported into `pokefolio-api-staging` after explicit user authorization. The temporary DPAPI credential checkpoint was removed after successful import; no local credential file is required. The legacy production deployment remained unchanged; original code was restored as the latest uploaded version. The transfer endpoint has expired. Provider authentication checks passed for eBay OAuth, Gemini model availability and 17TRACK read-only quota. The owner approved new shipment registration with the shared 17TRACK credentials; existing shipments must not be edited or removed. Issue #2 tracks the final frontend deployment acceptance receipt.
- **Production:** independent Firebase `pokefolio-production` (`671195488376`), Standard `(default)` Firestore in `europe-west1`, and Google Auth are configured. Private rules match the shared tested policy. Registered Web app: `1:671195488376:web:76efaed5b016e1a1a5cd8d`. Google sign-in and seven read-only authorization checks passed. API `pokefolio-api-production` runs checked source `d5b9d247c9c2442d295a47f63aafc87829f4308b`, version `c37ed705-e888-4412-bd07-e47b22781ebb`, deployment `c56e5919-4137-4cd6-8b1a-037aa0891fc5`. All five provider secrets were copied with owner authorization and are secret bindings; shipment registration is enabled. Health, eBay search and invalid-token rejection passed against the deployed API. Shared Gemini model lookup and 17TRACK read-only quota authentication passed. No Firestore documents or tracking records were created. The frontend runtime/build and production URL/release remain pending; Pages is still staging. See `docs/PRODUCTION_SETUP.md`.

## Product decisions that must be preserved

- Transactions are the primary purchase/sale record; physical copies and eBay lots are distinct, with unknown cost represented explicitly, not invented.
- Preserve all existing binder pocket positions, reserved empty pockets, 3×3 page grouping, page relocation and shared read-only view.
- Preserve manual Wishlist drag ordering, including its behavior when sorted by price.
- Dashboard is the default home. Bottom nav: Collection, Wishlist, Dashboard, Analyze and Transactions; top nav: Search and Settings. Deals is an internal Wishlist tab.
- Collection includes Overview, Cards and Binder. Mobile-first, compact lists and premium investment-like analytics.
- English default and full Hebrew RTL support.
- No migrations of real data or changes to the legacy production app without an independently verified backup, explicit approval and tested rollback.

## Engineering workflow

- Many focused PRs, all verified with CI before merging; no unapproved architectural or UI redesign.
- `index.html` is generated with `node scripts/build-index.mjs`. Keep generated file identical to its template and catalog sources.
- No secrets or production snapshots in Git. Use fake cloud fixtures in automated tests.
- See `docs/SAFE_IMPORT.md` for the import checklist, history limitation and staging prerequisites.

## Production provisioning update — 2026-11-19

Separate Production Firebase (`pokefolio-production`) and API (`pokefolio-api-production`) are provisioned and verified. The owner-authorized five provider secrets are installed; Google sign-in, private read isolation, live eBay search, Gemini model authentication and read-only 17TRACK quota checks passed. The public Pages URL remains staging; the production frontend runtime and release are pending. See [Production setup](docs/PRODUCTION_SETUP.md) for identifiers, acceptance evidence and rollback. Real-data migration remains separate under #21.

## React foundation — 2026-11-19

Owner approved replacing the old staging UI with a fresh minimal React shell. Toolchain/dependencies are locked under `frontend/`; navigation is hash-based with Dashboard home. English/Hebrew RTL, Tailwind/shadcn Button, transient Zustand UI state, Query defaults, typed catalog/price contracts, isolated Axios transport and Firebase auth boundaries are included. Routes remain placeholders; screen designs require separate mocks and approval. The foundation defines no transaction/physical-copy persistence schema and performs no Firestore writes.

The React staging pipeline replaces the legacy artifact packaging. The prior frontend, runtime injection and build descriptions above are historical infrastructure receipts. The current publisher compiles only `frontend/`, validates registered staging config, preserves `/pokefolio/`, excludes all legacy/backend files, and emits a source manifest. Five successful current-main checks are required, including `react-foundation`. Synthetic-config packaging and mobile Playwright checks cover route reload, RTL and absence of legacy controller/Firestore requests. Real production cutover remains #21. For rollback, revert the staging activation PR through protected main after checks; the retained legacy source/build remains available. Never restore or modify user data as part of a frontend rollback.

## Issue #4 design/navigation implementation — 2026-11-20

Adventure Blue tokens, local Inter/ Hebrew fonts, shared surfaces/fields/states and five-destination fixed navigation replace the technical shell styling. Collection has Overview/Cards/Binder, Wishlist Cards/Deals and Transactions Overview/History. Utility search is a native full-screen dialog with background-route preservation, focus containment, Escape/back support and hidden primary navigation. Settings currently contains only the existing language switch; its full product design is deferred. Catalog results, analyzer behavior and financial screens remain their dedicated roadmap work. No live-data operations were added.

User requested react-icons in the same PR. Shared navigation/actions use named Lucide-set imports from react-icons/lu; unused lucide-react was removed. Do not mix icon families without a design reason. Fonts are self-hosted Latin/Hebrew subsets.

## Issue #5 domain planning — 2026-11-20

[Transaction/inventory domain proposal](docs/DOMAIN_MODEL_PROPOSAL.md) records the
proposed copy/transaction/lot identities, money and allocation semantics, sale/refund
lifecycle, owner-scoped persistence boundaries, synthetic scenarios and read-only
legacy mapping. **Owner approved the proposal on 2026-11-20, including sales restricted to held, received copies initially.**
The proposal adds no runtime types, Firestore writes/rules, migrations or screen behavior.
Issue #5 remains open; implementation proceeds through focused PRs.

First implementation: `frontend/src/domain/schema.ts` adds strict private DTO schemas
and inferred types for copies, purchases/lines, sales, lots, cash, refunds, acquisitions,
shipments, revisions and historical FX evidence. Boundary tests use synthetic data.
Runtime adapters, allocation/lifecycle commands and migration are separate work; no
live writes or rules changes are enabled by these contracts.

Pure money/purchase modules add safe integer parsing, deterministic equal-share
shipping, explicit lot/tax/fee allocations, per-copy purchase plans and initial payment
reconciliation. FX conversion requires historical evidence; missing/estimated costs
retain coverage labels. No UI or live persistence is wired to these primitives.
