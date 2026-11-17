# Issue #1 — Safe baseline import checklist

## Provenance and scope

Source: [xfayne/pokemon-vintage-binder](https://github.com/xfayne/pokemon-vintage-binder) `main` at `16b89318e77ebea3180461824a09711ae3f93782` (2026-11-17). The import copied all **64 tracked files** including the JPEG asset, 1,252-card static catalog, generated index, templates, JS, CSS, Workers, CI and tests. Every imported file blob was checked for the same Git blob SHA before applying Pokefolio-only safety changes. The original source repo was not modified.

The GitHub integration could copy individual source blobs, but not transplant another repository's full historical commit graph. Pokefolio therefore begins with a documented **attributable snapshot**, not historical source commit ancestry. The original repository retains the complete prior history. At the snapshot, legacy PRs #58 and #59 were open and are not included in this baseline until independently integrated later.

## Production boundary — enforced now

- No production Firestore snapshots, JSON backups, keys or secrets were copied.
- `js/pokefolio-environment.js` is loaded before all browser controllers. With no runtime configuration, cloud and Worker URLs are blank; Google sign-in and shared Firestore readers cannot initialize. The legacy `pokemon-vintage-binder` project ID and `pokemon-vintage-ebay-deals.xfayne.workers.dev` host are expressly rejected.
- The old app and Pokefolio use the same website *origin* when eventually hosted on GitHub Pages, despite differing paths. Do **not** delete, overwrite or import the original app's localStorage. The legacy cleanup routine is deliberately no-op in Pokefolio, and new Deals postal storage uses a distinct key.
- `ebay-worker/wrangler.toml` names a **new** staging Worker, sets `workers_dev=false` and sets a nonfunctional `ALLOWED_ORIGIN`. The Worker defaults to that nonfunctional origin and requires `POKEFOLIO_FIREBASE_PROJECT_ID` distinct from the legacy Firebase project for authenticated routes.
- Never copy production Cloudflare secrets, KV namespaces, deployment settings or credentials into Pokefolio; avoid running `wrangler deploy` until Issue #2 is complete.
- GitHub Actions copy only parity/test workflows; there are no automatic production deployments in this import.

## Verification

- `node scripts/build-index.mjs --check` verifies the generated HTML equals template + offline catalog exactly.
- `node --test tests/*.test.mjs ebay-worker/*.test.mjs` exercises deterministic Node tests.
- `tests/import-safety.test.mjs` checks runtime fail-closed behavior, disallows legacy cloud endpoints and unsafe Worker deployment settings.
- Existing Playwright regressions continue with fake Firebase and mocked Pokefolio test Worker endpoints; no live external credentials or production documents are used.
- Confirm GitHub Actions on the import PR before merge. Check no pages/Worker deployment has been enabled. If a test fails, fix it before merging.

## Next milestone — Issue #2 (approval for architecture/security)

Provision entirely separate Firebase/Auth/Firestore, Cloudflare Workers and KV, separate secrets, custom origin policies, protected CI and staging deployment. Require explicit staging configuration; add end-to-end proof that writes in Pokefolio cannot affect the original app. Only later, after independent verified backup and user approval, consider exporting real collection data for the onboarding/migration issues.

**Do not enable cloud integrations or migrate production records as part of Issue #1.**
