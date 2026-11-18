# Pokefolio

A mobile-first Pokémon card portfolio manager, evolving from the production [Pokémon Vintage Binder](https://github.com/xfayne/pokemon-vintage-binder).

**Foundation status:** The original application was imported as an isolated baseline under [Issue #1](https://github.com/xfayne/pokefolio/issues/1). A separate Cloudflare staging Worker now exists with one **undeployed, deny-only version**, no public subdomain/routes, and no bindings or secrets. A separate `pokefolio-staging` Firebase project now has an empty Standard Firestore database in `europe-west1` with deny-all rules and an independent Google sign-in provider. Owner-scoped authorization tests, frontend sign-in verification, hosting and real integrations are still pending under [Issue #2](https://github.com/xfayne/pokefolio/issues/2). This is **not** a live replacement, and there is no Pokefolio production deployment or frontend-connected database yet. The original [Vintage Binder app](https://xfayne.github.io/pokemon-vintage-binder/) remains operational and independent.

## Architecture and roadmap

The imported baseline is a vanilla JavaScript app with a generated `index.html`, `js/`, `css/`, `deal-finder/`, Cloudflare `ebay-worker/`, and browser and Worker tests under `tests/`. It will be migrated incrementally to React, TypeScript and Vite under [Issue #3](https://github.com/xfayne/pokefolio/issues/3), **after** establishing isolated Firebase, Worker and Pages staging under [Issue #2](https://github.com/xfayne/pokefolio/issues/2).

[21 planned issues](https://github.com/xfayne/pokefolio/issues) cover infrastructure, transaction and inventory modeling, UX, analytics, localization, and safe release.

## Safe local development

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

The copied app can display the catalog and static UI, but **Firebase sign-in, Firestore writes, eBay Deals, shipping tracking and AI grading are intentionally disabled** until independent staging credentials/configuration exist. No production Firebase configuration or Worker endpoint is bundled. Never point `window.PokefolioRuntimeConfig` at the original Firebase project or Worker; the runtime safety gate rejects those values.

**Do not deploy `ebay-worker/` or enable GitHub Pages for Pokefolio until Issue #2 is completed and independently checked.** The copied `wrangler.toml` uses a different name, a disabled public workers.dev endpoint and a nonfunctional allowed origin.

Edit the HTML template, **not** generated `index.html`. Rebuild and verify:

```sh
node scripts/build-index.mjs
node scripts/build-index.mjs --check
node --test tests/*.test.mjs ebay-worker/*.test.mjs
```

Browser regressions run in GitHub Actions with Playwright. Existing CI does not read live Firestore, Google sign-in, eBay, or 17TRACK. See [Safe import checklist](docs/SAFE_IMPORT.md), [Project Context](PROJECT_CONTEXT.md), and [legacy README](docs/LEGACY_README.md).

## Data safety

No production user data is copied, modified, deleted, or migrated by this foundation import. Preserve physical-card data, 3×3 binder ordering and reserved empty pockets, Wishlist manual ordering and pending shipments; any migration of real data requires an independently verified backup, dry-run comparison, approval, and rollback plan.
