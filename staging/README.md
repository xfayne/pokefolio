# Locked-down Cloudflare staging bootstrap

Issue #2 authorizes a separate Pokefolio staging Worker **without** changing the existing Vintage Binder Worker.

This folder contains a deliberately inert Worker version. Every HTTP method returns `503 STAGING_NOT_CONFIGURED`. It has no bindings, authentication, network calls or access to any production resource.

Cloudflare resource: `pokefolio-ebay-deals-staging`.
The resource was created 2026-11-18 and version 1 was uploaded **without a deployment** (version ID `8baa6e12-8cb7-47a1-9082-dfcf3e1a0ecb`). Read-back confirmed zero deployments, zero bindings, and disabled workers.dev and preview URLs. Keep workers.dev and preview subdomains disabled; do not add routes, production credentials, shared KV, or any integration until staging Firebase project identity, owner-only rules, and authentication are verified.

The full migrated Worker remains in `ebay-worker/`, with its separate `wrangler.toml` set to `workers_dev = false`. Do not deploy that code until the staging integration tests pass. No CI workflow in this repository deploys to Cloudflare.

## Verify

```sh
node --test tests/locked-worker.test.mjs tests/staging-isolation.test.mjs
```
