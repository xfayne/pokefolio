# Issue #2 — Staging isolation and approval checklist

Status: **audit complete, cloud provisioning not started** (2026-11-17). This document is a proposed security architecture, **not** permission to touch production infrastructure.

## Read-only inventory

GitHub: `xfayne/pokefolio` main contains the safe Vintage Binder snapshot from #1; three existing CI workflows have passed. No Pokefolio Pages deployment was enabled at the time of the audit. The GitHub repository returned **no rulesets** in the accessible endpoint; verify actual branch-protection and required status checks separately.

Cloudflare (connected account, read-only inspection): one Worker named `pokemon-vintage-ebay-deals` exists and is enabled. Its binding *names/types* include `ALLOWED_ORIGIN`, eBay credentials, Gemini, and 17TRACK credentials. There is **no** `pokefolio-` Worker, KV namespace, or Cloudflare Pages project visible in this account. Values of bindings/secrets were **not** accessed, copied or changed. The original Worker is off limits.

Firebase: `pokemon-vintage-binder` is the legacy production project ID, found in the original source. The separate Pokefolio project, Firestore database, Auth, security rules and authorized domains are **not yet provisioned or independently verified**. Never point a new client at the legacy project.

## Proposed staging architecture (requires approval before provisioning)

1. Use a **distinct Firebase project** for Pokefolio staging, not a second database within the production Vintage Binder project. Give it independent Auth, Firestore, Rules and service identities. Start with synthetic users and synthetic cards only. No import of real records.
2. Start Firestore with the committed `firebase/firestore.rules` **deny-all** bootstrap; after confirming the staging project identity, replace this with reviewed owner-scoped `users/{uid}` rules, and separately review any public read-only sharing behavior. Auth and Firestore grants require real staging-only tests.
3. Create a **separate staging Worker**, keeping the current `workers_dev=false` until its routing and access policy are approved. Configure new, scoped secrets and independent resource bindings; do not reference production KV, secret values or the old Worker name. The staging Worker must validate the **staging Firebase project ID** and owner identity for authenticated APIs. Test with synthetic requests.
4. Keep GitHub Pages disabled until a safe preview has been checked. On GitHub Pages, `/pokemon-vintage-binder/` and `/pokefolio/` share the **same browser origin** (`https://xfayne.github.io`), so CORS or hostname-based OAuth restrictions **cannot** isolate the two applications. Project-specific Firestore rules and server JWT validation are mandatory. Verify no inherited localStorage keys, service workers or runtime config.
5. Require `staging-isolation`, `javascript-parity`, `style-parity` and Worker CI checks on PRs before main merges. No automated deploy scripts until staging resource IDs, runtime config, protected environments and rollback policies have been verified.

## Guardrails added in this first PR

- `firebase/firestore.rules` is a **non-deployed, deny-all bootstrap**.
- `tests/staging-isolation.test.mjs` verifies deny-all rules, Worker staging identity/disabled public endpoint and absence of deployment commands in GitHub Actions.
- `.github/workflows/staging-isolation.yml` makes those checks repeat on PRs and pushes to main. It has read-only GitHub permissions and does **not** deploy.
- The runtime gate and production URL rejections from #1 remain active.

## Deployment readiness / explicit approvals

**Before any cloud provisioning:** approve using a separate Firebase project and a separate Cloudflare Worker in the existing Cloudflare account; agree on staging preview exposure and owner-only access. Creation of resources may have costs.

**Before cloud connections are enabled:** verify Firebase project ID, OAuth authorized domains, Firestore security rules, Worker secrets and bindings, token issuer/audience, CORS, and read/write isolation with synthetic fixtures. Inspect both production and staging inventories before/after without performing any production mutations.

**Before any real data:** obtain user approval, independently verify a complete backup, run import into isolated staging using a read-only export and compare inventory, pending shipments, binder 3×3 positions/empty pockets/page moves and Wishlist ordering. Rollback means disabling Pokefolio, never restoring over the old project.

The above decisions are deliberately not implemented in the connected cloud accounts by this PR.
