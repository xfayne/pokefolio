# Pokefolio — Project Context

_Last updated: 2026-11-18 · Separate Firebase project, deny-all Firestore and Google Auth provisioned; owner authorization and Pages staging pending._

## Source of truth

- New repository: https://github.com/xfayne/pokefolio
- Legacy production repository: https://github.com/xfayne/pokemon-vintage-binder
- Roadmap: https://github.com/xfayne/pokefolio/issues
- Source snapshot pinned to legacy main commit `16b89318e77ebea3180461824a09711ae3f93782`.
- Original legacy README and project context are retained verbatim in `docs/LEGACY_README.md` and `docs/LEGACY_PROJECT_CONTEXT.md`. They describe the **legacy** implementation, not Pokefolio deployment status.

## Current state

Issue #1 imported the baseline and safety bootstrap in [PR #22](https://github.com/xfayne/pokefolio/pull/22); [PR #23](https://github.com/xfayne/pokefolio/pull/23) clarifies legacy-only deployment documentation. The source remains vanilla JavaScript, static generated HTML and Cloudflare Worker code until the incremental React/TypeScript migration in #3. An isolated Cloudflare Worker `pokefolio-ebay-deals-staging` has been created and verified with **one undeployed deny-only version, no public routes/subdomains, no bindings/secrets, and zero deployments** ([PR #25](https://github.com/xfayne/pokefolio/pull/25)). The separate `pokefolio-staging` Firebase project now exists (project number `403637067452`, Spark plan). Its empty Standard Firestore `(default)` database is in `europe-west1` and its active rules deny all client reads and writes. Independent Google sign-in is enabled with public name `Pokefolio Staging`; authorized domains currently contain only `localhost`, `pokefolio-staging.firebaseapp.com` and `pokefolio-staging.web.app`. No frontend Firebase configuration, public Pages site or production deployment has been enabled. Authentication has been provisioned but actual frontend sign-in and owner authorization have not yet been verified. Issue #2 remains the blocking prerequisite for any writable staging integration.

The runtime safety gate in `js/pokefolio-environment.js` defaults Firebase and Workers to disabled. It refuses the legacy Firebase project and legacy Worker endpoint; client modules only read validated staging settings. The Firebase bootstrap configuration and `scripts/firebase-staging.mjs` pin deployment to `pokefolio-staging`, permit only deny-all Firestore rules, and reject project/configuration overrides. CI runs the preflight without cloud access. In addition, the cloned Worker uses a new staging name with `workers_dev=false` and a denied-by-default origin, and its token validator refuses legacy Firebase projects. Pokefolio does **not** delete Vintage Binder localStorage on the shared `xfayne.github.io` origin.

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
