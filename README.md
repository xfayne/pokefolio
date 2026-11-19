# Pokefolio

A mobile-first Pokémon card portfolio manager, evolving from the production [Pokémon Vintage Binder](https://github.com/xfayne/pokemon-vintage-binder).

**Foundation status:** The legacy application was imported as an isolated baseline under [Issue #1](https://github.com/xfayne/pokefolio/issues/1). Separate `pokefolio-staging` Firebase Auth/Firestore now has tested, deployed private owner rules; both emulator tests and a live synthetic authorization check passed. The separate Cloudflare Worker remains undeployed, without public URLs, bindings or secrets. Main requires PRs and four passing Actions checks. The [staging frontend](https://xfayne.github.io/pokefolio/) is deployed with independent Firebase configuration; Google sign-in and the private Firestore collection load from that URL have been verified. External providers remain pending; [Issue #2](https://github.com/xfayne/pokefolio/issues/2) remains open. The original [Vintage Binder app](https://xfayne.github.io/pokemon-vintage-binder/) remains independent and unchanged.

## Architecture and roadmap

The imported baseline is a vanilla JavaScript app with a generated `index.html`, `js/`, `css/`, `deal-finder/`, Cloudflare `ebay-worker/`, and browser and Worker tests under `tests/`. It will be migrated incrementally to React, TypeScript and Vite under [Issue #3](https://github.com/xfayne/pokefolio/issues/3), **after** establishing isolated Firebase, Worker and Pages staging under [Issue #2](https://github.com/xfayne/pokefolio/issues/2).

[21 planned issues](https://github.com/xfayne/pokefolio/issues) cover infrastructure, transaction and inventory modeling, UX, analytics, localization, and safe release.

## Safe local development

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

The copied app can display the catalog and static UI, but **Firebase sign-in, Firestore writes, eBay Deals, shipping tracking and AI grading are intentionally disabled** until independent staging credentials/configuration exist. No production Firebase configuration or Worker endpoint is bundled. Never point `window.PokefolioRuntimeConfig` at the original Firebase project or Worker; the runtime safety gate rejects those values.

**Do not deploy `ebay-worker/`.** A private-Firebase Pages preview may be published only through the manual, protected-main workflow after owner/runtime/browser isolation and required CI checks pass. External providers remain disabled. See [Staging preview](docs/STAGING_PREVIEW.md). The copied `wrangler.toml` uses a different name, a disabled public workers.dev endpoint and a nonfunctional allowed origin.

Edit the HTML template, **not** generated `index.html`. Rebuild and verify:

```sh
node scripts/build-index.mjs
node scripts/build-index.mjs --check
node --test tests/*.test.mjs ebay-worker/*.test.mjs
```

Browser regressions run in GitHub Actions with Playwright. Existing CI does not read live Firestore, Google sign-in, eBay, or 17TRACK. See [Safe import checklist](docs/SAFE_IMPORT.md), [Project Context](PROJECT_CONTEXT.md), and [legacy README](docs/LEGACY_README.md).

## Data safety

No production user data is copied, modified, deleted, or migrated by this foundation import. Preserve physical-card data, 3×3 binder ordering and reserved empty pockets, Wishlist manual ordering and pending shipments; any migration of real data requires an independently verified backup, dry-run comparison, approval, and rollback plan.
