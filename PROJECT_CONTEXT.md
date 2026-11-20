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

## Issue #5 — approved domain implementation, 2026-11-20

Owner approved [the domain model](docs/DOMAIN_MODEL_PROPOSAL.md), including the
initial restriction that only held, received physical copies can be sold. PR #52
records approval; #53 adds strict private schemas and #54 adds money/purchase plans.

`frontend/src/domain/` contains typed records, explicit evidence/cost coverage, integer
shipping and lot allocation, historical-only FX, copy receipt/sale/reversal commands,
shipping-refund corrections, cash-month grouping and owner-scoped commit contracts.
Synthetic tests cover identities, rounding, missing costs/dates/FX, sales, refunds,
Binder/Wishlist isolation, idempotent replay and competing optimistic revisions.
See the [domain implementation guide](frontend/src/domain/README.md).

This is a domain foundation, not a completed transaction UI or live database adapter.
No Firestore schema/rules deployment, live collection write or real-data migration is
performed. Future persistence must independently verify atomicity, auth, references,
complete write sets and idempotency as described in the guide. #6 handles safe import;
#7–#11 implement inventory/transaction/shipment workflows; #18–#19 extend analytics.

## Issue #6 — offline import work, 2026-11-20

Owner approved the migration plan in #56. #57 delivered offline backup envelopes,
explicit coverage, exclusive creation and independent read-back verification.
#58 adds read-only preview mapping, exact organization preservation, purchase
reconstruction drafts from legacy parcels and pure synthetic replay/rollback contracts.
#59 adds schema-validated opening/copy/shipment draft materialization. These are
local/synthetic tools, not live adapters or production migration. Check each PR for
current merge/CI status; #6 offline tooling is complete; live-data acceptance remains #21.

Owner clarified and authorized shipment-to-purchase conversion: recorded per-copy
prices 20 + 30 produce transaction total 50; no unrecorded shipping amount is added.
Imported purchase records preserve unknown dates/costs and coverage explicitly.
Parcel-linked copies use purchase acquisition links; cards without parcel evidence
remain opening inventory. No payment cash is inferred from a purchase date alone.
See [conversion policy](docs/IMPORTED_PURCHASE_PROPOSAL.md). No real-data migration
or Firestore adapter/rules deployment is performed by these offline tools.

## Issue #6 offline rehearsal pipeline — 2026-11-20

PR #59 merged purchase/line/copy/shipment conversion after all five required checks
passed. Prices 20 + 30 become total 50 with exact per-copy links; missing extra
charges add no amount and retain unknown coverage. Mapping v2 and
materializeLegacyImport are the current offline contracts. The filesystem rehearsal
adapter creates/read-verifies an inactive dataset before pointer publication,
checks content-bound approvals, supports exact replay and guarded rollback, and
never edits the source. Integration tests use synthetic JSON only.

See [the runbook](docs/LEGACY_IMPORT_RUNBOOK.md) for scope and release gates. No
live Firestore adapter/rules deployment, real export/migration or import UI is
claimed. Real capture completeness, destination auth/rules/atomicity, user preview
approval and cutover remain prerequisites for #21 and dependent persistence work.

## Issue #6 completion receipt — 2026-11-20

#56–#60 are merged. Offline conversion and synthetic isolated filesystem rehearsal
are complete; Issue #6 is closed. All five required checks passed on #60 head
ad536d211aa15facacea8e2d9318d123373b538e before merge to
6dcb042f31d8a2cca8c99019f82793f549f82a0c. The runbook details verification and
limitations. #21 explicitly retains real source capture/backup, exact owner approval,
authenticated Firestore adapter/rules/atomicity and live release acceptance. No real
export/migration, provider mutation or new product screen was performed.


## Issue #7 — physical copies and approved screens, 2026-11-20

PR #62 adds strict copy grouping, one-copy metadata edit plans and exact Binder-pocket references. The Collection Cards/Card Details implementation reuses the existing approved mocks: compact expandable catalog rows, separate conditions/editions/native card prices and landed cost, pending counts, partial market coverage, and a focused copy editor. A purchase reference view retains the exact transaction and line IDs until #8 connects the full transaction screen.

`CollectionCards` accepts owner-scoped inventory and an asynchronous save adapter. `#/collection/cards?inventory=sample` explicitly opts into synthetic data; demo edits and audit snapshots stay in memory and reset on leaving the screen/reload. The ordinary route reports that account storage is not connected. Never present demo copies as authenticated holdings. No real Firestore read/write or new pricing provider is added; real storage/atomic revision checks and full transaction navigation remain #8/#21, sale UI #9 and the existing Binder adapter/UI #13. Domain and UI regressions cover distinct copy edits/sales, unchanged siblings and Binder holes/indexes, coverage, retry/cancel, purchase references and mobile English/Hebrew accessibility.


## Approved mock alignment — 2026-11-20

The owner explicitly clarified that the approved Collection Cards and Card Details
mocks are authoritative. Earlier density, summary-removal, trailing-count and
hidden-sort comments addressed the previous divergent implementation and are
superseded; do not reapply them. Cards uses a visible card/copy count and value
sort/filter row, square thumbnails, a copy badge beneath the catalog identity,
a separated dark Market value column and expandable condition/cost/value rows.
Card Details uses Holo/edition chips, a single-condition price panel and an
integrated Your copies panel with an owned count and compact paid/purchase rows.
The navy bars frame a rounded light content surface; do not round the exterior
header as if the website were a phone bezel. A small Demo badge identifies the
synthetic sample route. Search remains sticky and all financial/copy identities
remain unchanged. Explicit copy inspection/editing stays available.

Wishlist/Deals/Record Purchase controls remain disabled and identified as coming
soon until their workflows are connected. No live collection migration/storage
or provider integration is added by this presentation work.


## Mock proportion follow-up — 2026-11-20

Use tinted blue-gray surfaces rather than white panels. The approved compact
control/row proportions and rounded typography are implemented with self-hosted
Nunito Sans and Noto Sans Hebrew; the generated reference does not identify its
original font. Keep the accepted main-screen boundary geometry unchanged. Card
Details rounds the top of the sheet and the light content boundary, without
rounding the exterior bottom. Native dialog entry animation starts on `[open]`,
with reduced-motion support. Artwork uses centered cover cropping without
distortion; image enlargement still exposes the full original card.


## Cards owner refinements — 2026-11-20

Cards use light-blue rows with a matching subtle border, regular search placeholder,
700-weight card labels and 800-weight counts. Both artwork sizes magnify and crop
the upper illustration region inside a yellow frame; enlargement preserves the
full original. A singleton's copies expand by default; multiple copies default to
closed, and explicit toggles persist while filtering. The condition selector is
800-weight. Sheet entry animates its inner frame after two animation frames, so
native dialog display promotion cannot consume the entry animation before paint.
Reduced motion remains respected. Accepted main-screen corners are unchanged.


## Accordion/header correction — 2026-11-20

The requested expansion animation belongs to the Cards list accordion. Keep its
content mounted in an animated 0fr/1fr grid, with inert/aria-hidden when closed;
singletons default open and duplicates default closed in Cards only. Card Details
keeps a static copy list. Remove the dialog focus outline responsible for blue
corner artifacts and square its exterior header corners. Keep keyboard outlines
on interactive controls. Rows use a lighter #edf5ff surface. Reduce artwork
magnification to 1.1 so the full width inside the original yellow edges is visible.


## Authoritative copy defaults and palette — 2026-11-20

All Cards-list accordions default CLOSED, including singletons. ONLY Card Details
Your copies defaults open for exactly one copy, otherwise closed. Both disclosures
animate and preserve explicit user toggles. This supersedes previous singleton
default notes. Shared Card surfaces and inventory rows use --surface-panel and
--surface-border, defined once in styles.css from the approved Card Details palette;
fields retain the shared --surface-field token. Do not add screen-specific colors.


## Shared UI extraction — 2026-11-20

Approved surfaces, search/select controls, framed PokemonArt, ListCard, controlled
Disclosure parts and UtilitySheet live in frontend/src/components/ui/. Inventory
and app utilities consume them directly. The shared guide defines palette, motion,
RTL, focus and form sizing contracts. UI components have no inventory/domain or
persistence dependencies and no copy-count defaults. Cards list defaults closed;
Your copies defaults open only for exactly one copy, in feature code. No visual
redesign or real-data behavior is part of this refactor.


## Issue #8 — approved History screen, 2026-11-20

Owner approved the supplied Transactions/History mock, with one explicit change:
the monthly net amount (sample −$227) stays on the SAME LINE as the month. The
Transactions tabs are Overview / History, with Overview first and the default,
following the owner correction after reviewing History. This supersedes the
History / Shipments tabs in the supplied mock. Overview remains a placeholder;
the former /transactions/shipments URL redirects to Overview. Shipment work
remains #11.

`features/transactions/` reuses the approved shared UI/palette/fonts and adds the
compact history rows, up to three distinct art previews with physical-copy counts,
source/date, transaction total and evidenced delivery status. Search/type filters
and initially closed currency/status filters combine; totals reflect visible rows.
`domain/transaction-history.ts` validates owner identity/uniqueness, preserves
missing imported dates/amounts, separates original currencies and computes signed
transaction totals (sale gross buyer amount minus purchase payable), NOT cash flow
or profit. Pending copies require explicit tracking evidence for In transit.

Only `?transactions=sample` exposes synthetic fixtures; ordinary history contains
no fake account holdings. Creation/detail callback contracts are ready but not
wired; those buttons are aria-disabled with an explanatory status until their
individual mocks/screens are approved. No new transaction forms, detail design,
Firestore persistence, migration or provider mutation is included. Continue #8
screen by screen; ask the owner for the next screen's mock before implementing it.
