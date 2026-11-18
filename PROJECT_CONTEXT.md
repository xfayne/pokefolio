# Pokefolio — Project Context

_Last updated: 2026-11-18 · Separate Firebase project, deny-all Firestore and Google Auth provisioned; main protection enforced; Firestore owner authorization and Pages staging pending._

## Source of truth

- New repository: https://github.com/xfayne/pokefolio
- Legacy production repository: https://github.com/xfayne/pokemon-vintage-binder
- Roadmap: https://github.com/xfayne/pokefolio/issues
- Source snapshot pinned to legacy main commit `16b89318e77ebea3180461824a09711ae3f93782`.
- Original legacy README and project context are retained verbatim in `docs/LEGACY_README.md` and `docs/LEGACY_PROJECT_CONTEXT.md`. They describe the **legacy** implementation, not Pokefolio deployment status.

## Current state

Issue #1 imported the baseline and safety bootstrap in [PR #22](https://github.com/xfayne/pokefolio/pull/22); [PR #23](https://github.com/xfayne/pokefolio/pull/23) clarifies legacy-only deployment documentation. The source remains vanilla JavaScript, static generated HTML and Cloudflare Worker code until the incremental React/TypeScript migration in #3. An isolated Cloudflare Worker `pokefolio-ebay-deals-staging` has been created and verified with **one undeployed deny-only version, no public routes/subdomains, no bindings/secrets, and zero deployments** ([PR #25](https://github.com/xfayne/pokefolio/pull/25)). The separate `pokefolio-staging` Firebase project now exists (project number `403637067452`, Spark plan). Its empty Standard Firestore `(default)` database is in `europe-west1` and its active rules deny all client reads and writes. Independent Google sign-in is enabled with public name `Pokefolio Staging`; authorized domains currently contain only `localhost`, `pokefolio-staging.firebaseapp.com` and `pokefolio-staging.web.app`. No frontend Firebase configuration, public Pages site or production deployment has been enabled. Web app `Pokefolio Staging Web` is registered (`1:403637067452:web:ea6738aebf38f14c637ab9`), without enabling Firebase Hosting. A temporary localhost diagnostic using Firebase Web SDK 13.1.0 successfully signed in with Google and verified token audience `pokefolio-staging` and issuer `https://securetoken.google.com/pokefolio-staging`. Real Firestore reads and synthetic writes returned `permission-denied` both before and after sign-in; no test document was created. One staging Auth identity was created by this verification. The product frontend remains disconnected; owner-scoped read/write authorization is not yet implemented or tested. Issue #2 remains the blocking prerequisite for any writable staging integration.

The runtime safety gate in `js/pokefolio-environment.js` defaults Firebase and Workers to disabled. It refuses the legacy Firebase project and legacy Worker endpoint; client modules only read validated staging settings. The Firebase bootstrap configuration and `scripts/firebase-staging.mjs` pin deployment to `pokefolio-staging`, permit only deny-all Firestore rules, and reject project/configuration overrides. CI runs the preflight without cloud access. [PR #27](https://github.com/xfayne/pokefolio/pull/27) merged with all three checks passing and six additional local bootstrap tests passing. In addition, the cloned Worker uses a new staging name with `workers_dev=false` and a denied-by-default origin. Its token validator is pinned to `pokefolio-staging` and validates UID and timestamp claim types; synthetic signed-token tests cover other projects, users and malformed tokens without contacting providers. This full Worker source is not deployed. The imported Worker currently uses no KV binding, and the account has no KV namespaces; no unused storage was created.

Main is protected by active GitHub ruleset `27585981`: PR required, no manual approval required, up-to-date `staging-isolation`, `javascript-parity` and `style-parity` checks from GitHub Actions required, no bypass actors, deletion and force pushes blocked. Protection was configured through the authenticated GitHub browser and independently read back via API. Pokefolio does **not** delete Vintage Binder localStorage on the shared `xfayne.github.io` origin.

An isolated Firestore emulator suite now covers the active deny-all bootstrap and an **undeployed**, schema-validated owner-probe prototype limited to `stagingChecks/{uid}`. The probe is infrastructure test scaffolding; every application data path stays denied. Tests require the exact loopback emulator address and a `demo-` project, and use synthetic users and binder/Wishlist fixtures only. No live rule deployment or product data model change is included. See `firebase/testing/README.md`.

## Product decisions that must be preserved

- Transactions are the primary purchase/sale record; physical copies and eBay lots are distinct, with unknown cost represented explicitly, not invented.
- Preserve all existing binder pocket positions, reserved empty pockets, 3×3 page grouping, page relocation and shared read-only view.
- Preserve manual Wishlist drag ordering, including its behavior when sorted by price.
- Dashboard is the default home. Bottom nav: Collection, Wishlist, Dashboard, Deals and Transactions; top nav: Search, Analyze and Settings.
- Collection includes Overview, Cards and Binder. Mobile-first, compact lists and premium investment-like analytics.
- English default and full Hebrew RTL support.
- No migrations of real data or changes to the legacy production app without an independently verified backup, explicit approval and tested rollback.

## Engineering workflow

- Many focused PRs, all verified with CI before merging; no unapproved architectural or UI redesign.
- `index.html` is generated with `node scripts/build-index.mjs`. Keep generated file identical to its template and catalog sources.
- No secrets or production snapshots in Git. Use fake cloud fixtures in automated tests.
- See `docs/SAFE_IMPORT.md` for the import checklist, history limitation and staging prerequisites.
