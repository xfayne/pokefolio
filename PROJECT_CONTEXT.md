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


## Issue #8 — approved Purchase Details and shared bold weight, 2026-11-20

Owner supplied the Purchase Details mock and authorized this screen after History.
Purchase rows open `/transactions/purchases/:transactionId` (sample query opt-in
required); direct links, reload and back retain the correct data mode. The focused
page retains primary navigation, hides section tabs and uses a back/title/actions
header. Editing actions remain unavailable pending the next approved form.

Reuse Card, PokemonArt, the shared TransactionStatus and the existing exact-copy
CardDetailsSheet (read-only when no save adapter is supplied). Cards retain
per-copy conditions and card prices; original purchase totals and stored shipping
allocations are separate. Do not divide missing costs or invent an average for
rounded allocations, fabricate payments, convert currency or infer tracking events.
The sample has card costs 52/46/32 USD, shipping 12 USD split 4 each and total 142.
Read-only owner-scoped tracking snapshots support chronological events, explicit
missing states and full-number clipboard copying. Sample Royal Mail data is fake;
no provider request, registration, Firestore write or real-data migration occurs.
Live persistence, copy/dashboard purchase links and shipment adapters remain #8/#11.

During implementation the owner explicitly requested one bold weight everywhere,
matching Collection → Cards names. `--font-weight-bold` is 700; Tailwind bold
aliases and component CSS resolve to it. This supersedes all older 800/900 notes.
Keep regular/medium metadata lighter, the approved palette centralized, and
Overview / History in that order. Continue screen by screen; request the next mock
before implementing creation/editing or another screen.


## Issue #8 — approved New Purchase form, 2026-11-20

Owner supplied the creation mock after approving Purchase Details. Implement
`/transactions/new` with Purchase/Sale selector (Sale unavailable), Date/Source/
Seller/Currency grid, per-copy or Total/lot pricing, removable copy rows, shared
16px native fields, deterministic shipping preview, totals, initially CLOSED
optional shipment details and fixed Save above the existing bottom navigation.
All emphasis uses the existing shared 700 weight and panel palette.

The pure purchase-draft planner validates required per-copy prices, dates, manual
seller, currency, copy identity and safe integer amounts; it delegates pending
copy construction and shipping allocation to planPurchase. Lot card costs stay
unallocated. Explicit shipment input creates only local records/memberships and
a pending read-only snapshot, without provider requests or fabricated events.
No payment date or settled cash movement is inferred; explicit payment evidence
remains a confirmation/persistence workflow requirement.

The opt-in sample form seeds 52/46/32 USD plus 12 shipping. A memory-only demo
provider owns new synthetic plans, idempotent receipts and their History/Details
projection. Sample/account draft UI state is separate in Zustand; no saved
portfolio record or auth token goes there. Drafts survive in-app back/navigation,
not a reload. New sample saves reset on reload. No Firestore writes, real account
data, Binder/Wishlist edits, migration or tracking registrations are performed.
Ordinary New Purchase is empty and account Save remains unavailable.

Add card has a callback contract but remains unavailable until the owner provides
the separate card-picker mock. Do not invent that screen, a confirmation screen,
a sale form or an edit flow. Continue #8 by requesting the next mock; authenticated
persistence, explicit payment confirmation, catalog selection/editions, optional
listing references and remaining acquisition/dashboard links are still pending.

## Shared catalog search and picker — 2026-11-21

The owner approved the full-screen search mock for Add card and requested the
same search for the global catalog. `features/catalog/` shares local catalog
search, set filter, result count, List/Grid, pagination, framed artwork and
selection callbacks. Catalog metadata is extracted from the retained offline
packs, including secret-card printed totals and the Ancient Mew asset. No legacy
controller is loaded. Unknown edition/finish stay explicit on new selections.
Global selection opens the existing read-only Card Details; Add card returns a
new, separately priced physical copy to the retained draft. Close/Escape cancels
selection without discarding the transaction. Account persistence, safe audited
transaction edits, copy/dashboard links and confirmation design remain #8 work;
this search increment alone does not close #8.

## Catalog density, prices and detail motion — 2026-11-21

Catalog result art/rows now match Collection Cards proportions; toolbar buttons
are compact. Only catalog-to-detail entry uses the optional subtle UtilitySheet
transition. Default slide entry remains unchanged for Collection and Transactions.
Catalog Details previously passed empty quotes. It now queries TCGTracking's
existing public set/cards/SKU endpoints with cancellation, bounded timeouts and
TanStack caching. Match exact name/printed number (or established promo IDs),
English, edition, finish and condition; ambiguous/missing matches remain unpriced.
USD catalog display defaults to Unlimited (Machamp deck exception); draft copy
edition/finish remain unknown. Loading/error/retry are explicit, and no quote is
converted or inferred. Tests stub public responses; no private data is sent.

## Promo prices and retained multi-set search — 2026-11-21

The owner reported missing WoTC promo prices and filters resetting after details.
Verified all 53 standard WoTC Promo product IDs and English SKU finishes against
provider data; explicitly exclude misprints, glossy, stamp-rally and NY printings.
Catalog display now uses their actual normal/holo/reverse finish, with exact ID
lookup for promo prices. Missing SKU prices still remain unavailable.
Search supports union-of-selected-set checkboxes combined with the existing text
query. Global Search and purchase picker each retain their own transient filter,
List/Grid and pagination state in their parent while results unmount for details.
No account state, Wishlist or Binder data is changed.

## Catalog mock controls and animated filters — 2026-11-21

Owner supplied the toolbar/badge crop again and permits slightly taller rows for
clean spacing. Catalog toolbar now uses a stable three-column baseline, funnel
icon, equal List/Grid segments and modest corner radii. Filter contents stay
mounted in shared DisclosureContent (inert/aria-hidden closed) with the existing
open/close animation. Set checkboxes fill two mobile columns, three on wider
screens, without a one-column internal scroll box.
Filters combine Energy/Trainer exclusion and Holo only (including Shining and
Reverse Holo) with existing text/multi-set choices; special vintage numbering,
trainer/energy exceptions and verified promo finishes retain their identities.
Result badges support Owned with copy count and Wishlist, using icon/chip shapes
from the mock. Callers must supply evidence: explicit sample global contexts show
received held counts, ordinary account context stays empty until persistence is
connected. Wishlist input is supported/tested, but no account wishlist adapter or
fake wishlist holdings are introduced. Rows have extra room for genuine badges.

## Issue #8 account integration — 2026-11-21

PR #85 connects owner-scoped purchase/copy/history persistence, immutable retry
receipts, revision-checked edits/audits, Google sign-in and Dashboard/copy links.
The owner clarified: Save is direct without confirmation; First Edition is a
checkbox and unchecked means Unlimited. Details prices match edition/condition
without fallback. Optional listing URL/order references use the existing form.

After owner sign-in, the tested policy was published only to pokefolio-staging at
06:24 UTC and verified byte-for-byte after trimming final whitespace. All five
required workflows passed and Pages deployed main 5cd2e12. The live synthetic
create -> reload -> edit -> reload journey passed: two copies, GBP 3.01 becoming
GBP 3.03 after a shipping-only edit, retained editions/costs/reference/tracking,
one history record, working Dashboard/copy links and eight immutable audits.
The parent user document remains nonexistent; no progress map, Binder, Wishlist,
legacy or production data was rewritten. Production frontend cutover is still #21.

See docs/PURCHASE_PERSISTENCE.md for activation evidence, storage paths and limits.
The follow-up freezes transaction/copy edit baselines against query refreshes,
keeps pending tracking references distinct from proven transit, and updates the
signed-out copy to point to Settings sign-in. Shipment provider integration is #11;
Transactions Overview remains a separate approved screen.

Owner refinements in the #8 follow-up: remove the standalone Purchase Details edit
button and open Edit purchase from the header ellipsis. Connect account Collection
rows to exact printing/condition quotes, including pending-copy row prices while
retaining received-only financial totals. Public set/SKU responses and printing
queries are shared/cached; no invented FX prices or provider account-data writes.

## Unified display currency and purchase refinements — 2026-11-21

The owner requires one account display currency throughout all read-only prices
and monthly totals. Only acquisition/sale entry/edit forms use original transaction
currency. Settings persists the preference under users/{uid}/preferences/display;
reference FX uses the retained legacy Frankfurter USD-base approach, with dated
rates, rounding for display and explicit unavailable conversions. Historical DTOs
and original costs remain untouched. Month headings render one converted total.
Transactions sort by purchase date descending and creation time descending on ties.
Tracking/carrier fields can be edited, added and cleared through audited commits.
Purchase Details omits per-copy shipping/payment-state notes. Header actions use an
edit icon only where editing works; unsupported delete actions are not shown.

## Issue #9 — sale implementation, 2026-11-21

Owner authorized direct implementation without further mocks and explicitly requires
reuse of existing components, sizes, colors, spacing and motion. New Sale uses the
existing purchase-form classes and shared fields/cards/art/buttons; the owned-copy
selector uses UtilitySheet and received/held copies only. No manual delivery action
is added: receipt remains #11, as the owner clarified.

`sale.ts` plans per-copy sales, reconciled estimated shipping/expense allocations,
immutable four-component acquisition-basis snapshots, membership-preserving edits
and audit-backed reversal. The adapter validates complete sale write sets before
atomic expected-snapshot checks and immutable retry receipts. Account sale lines
now reach History/Details. Reversal restores original copy IDs without acquisition,
Binder/Wishlist or shipment writes; reversed History contribution is zero. The
header has functional icon-only edit and reverse actions; reversal requires an
explicit confirmation. Entry/edit uses original transaction currency; read-only
amounts use the account display preference. Missing historical FX/costs gives
unavailable P/L, estimated costs stay estimated. No new FX provider is introduced.

The synthetic sample adapter is memory-only and owner-isolated. Ordinary account
routes never load sample holdings. Existing Firestore policy envelopes support
these writes without a rules deployment. See docs/SALE_TRANSACTIONS.md for the
nine-copy atomic edit limit, test scope and remaining live acceptance boundary.
This entry describes implementation; consult PR/CI and deployment receipts for
verified release status. No legacy/production data or real-data migration changed.

## Transaction header refinements — 2026-11-21

Owner requested fixed Purchase/Sale tabs and replacement of the bottom Save bar
with an icon-only Save action at the end of the New transaction header. The shell
now hosts both through TransactionFormHeader, using the existing form controls,
canvas, header action sizing and unchanged submit/validation/retry handlers.
Creation and purchase/sale editing share the behavior; tabs disable during saves.
The tab backing is opaque and part of the sticky header, preserving the rounded
content boundary without scroll bleed. No financial, storage or lifecycle change.

## Issue #11 — owner-approved simplified receipt/tracking, 2026-11-21

At most one optional shipment per purchase, containing all copies. Reuse the
existing tracking/carrier fields and Purchase Details; no split/combine, parcel
editor or new lists/screens. The owner approved direct implementation and deferred
#10. Received is an icon next to Edit and remains visible/disabled once received;
manual receipt works without tracking or provider events. Exact copy IDs/costs and
Binder/Wishlist remain intact. Large receipts respect the existing 20-audit commit
limit and resume only pending copies after interruption.

The React shell connects the existing authenticated 17TRACK endpoints, persists
optional shipment tracking/read state with audits, shares lookups, polls every two
minutes and exposes refresh/retry in the existing timeline. Provider Delivered
never automatically receives inventory. Transactions shows an unread badge;
opening Purchase Details marks displayed events read. Initial history is a read
baseline. Purchase edits preserve tracking unless number/carrier changes, and
preserve receipt/notes. Samples are synthetic/session-only without provider IO.
Market First Edition now occupies the right column beneath condition, removing
the standalone bottom row (PR #100). See docs/PURCHASE_TRACKING.md. Check PR/CI
and deployment receipts for verified release state. No real-data migration,
legacy/production changes, Worker deployment or rules deployment is included.

## Tracking error scope correction — 2026-11-21

Tracking registration failures are isolated per number, including transport errors;
a failed parcel no longer raises a misleading error on unrelated purchases.
Purchase Details renders plain Tracking error text inside the affected Shipment
status area, without the top-page alert. Header action siblings now have distinct
React keys to prevent duplicate Received controls during reconciliation.

## Pending purchase additions and receipt edit lock — 2026-11-21

Owner requested that Edit remains visible but disabled whenever manual receipt is
unavailable, including after receipt and while saving receipt. Direct edit routes
and the purchase command reject non-pending/disposed purchases. Pending purchases
can append copies through the existing catalog picker; complete costs/totals and
equal shipping shares are recalculated, existing copy IDs retained, and new copies
join the same optional shipment. Removal remains unchanged. The atomic adapter
validates the combined created/updated purchase, lines and copy allocation before
writing new copies, avoiding orphan records or unverified cost allocations.

## Issue #18 — on-demand market data foundation, 2026-11-21

Owner selected JustTCG after live Free-key checks returned one-year histories for
Fossil Gengar #5, Neo Discovery Umbreon #13 and WoTC Promo Mew #9. The agreed scope
is provider-supplied history with a shared, replaceable response cache: no daily
price collector, permanent archive, per-user daily snapshots or tracked-card scan.
Current use is personal. Preserve provider neutrality for future paid alternatives.

`ebay-worker/market-prices.js` defines normalized exact-variant observations and the
owner-authenticated `/api/market/prices` endpoint. Staging `worker-entry.js` exports
the existing API and a SQLite PriceCoordinator. KV gives 24-hour freshness with
seven-day bounded stale retention; only misses reach the quota coordinator. It
reserves durable per-minute/day/rolling-31-day budgets, deduplicates overlapping
misses and keeps a short-lived mirror to bridge KV propagation. A cleanup alarm
expires that mirror and never collects prices. All keys/data are public market
identities; no collection, transaction or user IDs enter shared cache records.

`services/market-history.ts` supplies Worker calls, React Query reuse, explicit
stale/unavailable states and strict condition/edition/finish/language selection.
Catalog matching is reused through `resolveMarketProduct`. Existing screen quotes
remain on their current adapter; finance selectors and Dashboard wiring follow in
separate increments. No new UI, finance engine, historical FX service or Firestore
writes are included. The shared cache does not itself grant multi-user access;
the existing verified owner allowlist is intentionally retained. Any later Worker
using the same JustTCG key must share the account coordinator instead of starting
an independent quota counter.

See `docs/MARKET_PRICE_CACHE.md` for contracts, bounded retention, provider terms,
local/runtime tests and release configuration. Consult PR/CI/deployment receipts
for activation status; this context entry is implementation scope, not a claim of
completed rollout. No production/legacy data, rules or migration were changed.

## Issue #16 — React analyzer, 2026-11-22

Owner approved the actual Classic Red SVG frame prototype, unified output without
Front/Back result sections, pixel headings/status and analyzer-specific tactile
Pokédex controls. `features/analyze/` adapts the existing upload/eBay endpoints
and private condition-analysis cache to React with strict response validation,
manual-only requests, preserved 1-based evidence geometry, numbered gallery/zoom,
cache reuse, explicit reanalysis, save-only retry and owner/unmount cancellation.
The existing rubric/model, Worker, rules and legacy production remain unchanged.
Local uploads are reduced and held in memory only, with object URL cleanup.
The frame retains lens/end-cap proportions while sidewalls fit variable content;
request lights respect reduced motion. Pixelify Sans is self-hosted/scoped, with
existing Hebrew/body fonts for legibility. See docs/ANALYZER.md and PR/CI receipts
for validation/deployment status. This does not complete other catalog/Wishlist
acceptance items in #16 or change collection/transaction data.

## Analyzer fixed frame refinement — 2026-11-22

Owner requires the Pokédex frame flush to the app viewport between header and
bottom navigation, stationary while only the light display scrolls. Analyze
uses a viewport-height flex shell, real header/nav flow heights (including safe
areas/RTL), zero outer padding and a bounded internal scroll region. Other
routes retain document scrolling. Removed separate Take photo and Add close-up
controls; Choose photos retains the native camera/library picker and multiple
image selection. No grading, auth, cache or portfolio behavior changes.

## Analyzer result feedback — 2026-11-22

Owner requested a white main-lens on/off blink during analysis, alternating
green/yellow small lamps, and completed-result lens colors from NM green through
LP lime, MP yellow, HP orange to DMG red. Only the glass animates, preserving the
metal rim and honoring reduced motion. Detected wear precedes photos. Removed
the estimate chip and standalone disclaimer; breakdown/limitations is always
open with a pixel heading, descending probabilities and bars >=5% only, without
renormalization. No model, API, cache, auth or portfolio behavior changes.

## Analyzer optical/UI correction — 2026-11-22

Owner clarified busy must keep blue glass with a fast white flash inside it,
not recolor/dim the lens gray. A bounded radial white light uses opacity at
0.7s; small fixed-color LEDs alternate opacity over dark backings at 0.9s with
a half-cycle offset, replacing brightness-filter animation. Reduced motion
remains supported. Square outer corners/trimmed end-cap margins fill all edges;
the inner screen remains rounded. Removed confidence/photo-count copy, renamed
Grade breakdown and styled its accessible meters as segmented LCD readouts.
Original probabilities, >=5% filtering, descending order, limitations and the
analysis engine/cache data are unchanged.

## Correct square molded perimeter — 2026-11-22

Owner rejected the prior base-only squaring because the visible plaque and
highlights remained rounded and the right rail stepped out of alignment. The
actual SVG header contour, right seam termination, outer highlight and lower lip
now have square outer turns. A continuous right highlight replaces conflicting
inset strokes. Original gradients, optics, inner screen and fixed viewport
behavior remain unchanged. Validate full-resolution top/right/bottom captures;
container bounds alone do not prove correct geometry.

## Issue #13 — Collection Binder, 2026-11-22

Owner approved the supplied Binder mock with no My Binder heading, no tap-to-card
navigation, and no document/internal scrolling. The viewport-sized nine-pocket
book uses shared Adventure Blue surfaces and full-card artwork. Hold-to-drag,
swipe/arrows, explicit placement/removal and whole-page movement preserve legacy
gap behavior; partial pages moved into the middle retain their trailing holes.
Copies keep exact IDs through receipt, edits, missing records and sales.

The new owner-only users/{uid}/binders/main document stores ordered typed pockets
as JSON with expected-layout transactional concurrency. It never rewrites the
retained progress root or financial records. Wishlist pockets are layout-only
catalog reservations pending #14 integration, with no Wishlist order changes.
Explicit snapshot sharing reuses the schema-v2 public payload/settings policy;
the standalone public reader mounts no private portfolio hook. Read-only viewer
supports two pages in landscape. Sample mode is session-only and never publishes.
See docs/BINDER.md and PR/CI receipts for verified activation/deployment status.
This increment does not complete Overview/export or real migration acceptance.

### Binder compact refinement — 2026-11-22

Owner approved middle-height translucent arrow overlays, fraction printed on the
book frame, overflow menu on the book and sharing inside it. Remove all previous
flow toolbar/pager/hint rows. Empty pockets open shared CatalogSearch constrained
to eligible received/pending copies; auto-pick one, choose exact copy for duplicates.
Fix direct touch dragging and implicit trailing-pocket placement without compaction.
Rendered preview approval is required before merging/deploying this refinement.

### Binder empty page action — 2026-11-22

After owner approval of the compact Binder rendering, the Binder options menu gains
Add empty page. It inserts exactly nine stable empty pockets immediately after the
current page, materializing the old trailing implicit gaps if needed, and switches
pages only on confirmed save. All original copy/wish pointers keep their order,
with capacity and revision checks unchanged. Unit and mobile E2E coverage added.
PR #117 remains the review/delivery unit; its new CI result and merge/deployment
must be verified before claiming staging availability.

## Dashboard contextual metric display — 2026-11-23

After the chart footer removal and native SVG entrance animation (#120), the owner
approved two mode-sensitive secondary metrics with an intentionally stable top
card layout. Collection Value retains the dynamic priced-coverage chip and shows
Known Cost / Held Copies. Market Change shows Unrealized P/L / matched-holdings
Unrealized ROI. The owner later requested a visible "Price History" badge
rather than the transparent placeholder; the badge retains the same slot and
spacing as other modes (PR #122).
Realized P/L shows completed-sales count and reconciled Net Sale Proceeds /
Sold Cost Basis. Sale values exclude reversals and use audited frozen per-copy
costs and dated conversion; missing cost remains unavailable. Only the two
secondary labels/values fade between modes; no navigation or portfolio mutation
is involved. See Dashboard E2E/regression tests and PR #121 for delivery status.

## Realized P/L chart refinement — 2026-11-23

Owner approved replacing the Realized P/L status placeholder with an animated
sale-profit chart, without the word "Cumulative" in the title. Sales are
filtered by 1M/3M/1Y/All, and the headline, completed-sales count, net proceeds,
sold cost basis and chart all use the same period. The daily series starts at
zero, stays flat between sales, steps up on gains and down on losses; reversed
sales are excluded. It uses the existing audited frozen acquisition costs
and dated FX, never imputes missing amounts, and shows incomplete-data status
in the existing chart slot. This is read-only, no staging/legacy writes and no
changes to card-market provider data. Validation includes domain tests and
Dashboard mobile E2E checks; source of truth is PR/CI/deployment verification.
