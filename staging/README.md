# Locked-down Cloudflare staging bootstrap

Issue #2 authorizes a separate Pokefolio staging Worker **without** changing the existing Vintage Binder Worker.

This folder contains a deliberately inert Worker version. Every HTTP method returns `503 STAGING_NOT_CONFIGURED`. It has no bindings, authentication, network calls or access to any production resource.

Cloudflare resource: `pokefolio-ebay-deals-staging`.
The first step is **version upload only**, not a production deployment. Keep workers.dev and preview subdomains disabled; do not add routes, production credentials, shared KV, or any integration until staging Firebase project identity, owner-only rules, and authentication are verified.

The full migrated Worker remains in `ebay-worker/`, with its separate `wrangler.toml` set to `workers_dev = false`. Do not deploy that code until the staging integration tests pass. No CI workflow in this repository deploys to Cloudflare.

## Verify

```sh
node --test tests/locked-worker.test.mjs tests/staging-isolation.test.mjs
```
