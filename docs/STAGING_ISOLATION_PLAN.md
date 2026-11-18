# Issue #2 — Staging isolation and approval checklist

Status: **architecture approved 2026-11-18; cloud staging being provisioned incrementally**. The approved design uses distinct Firebase projects and Workers for Pokefolio and Vintage Binder.

## Read-only inventory

GitHub: `xfayne/pokefolio` main contains the safe Vintage Binder snapshot from #1. Three CI workflows passed. No Pokefolio Pages deployment was enabled at the last audit. No rulesets returned in accessible GitHub API; branch protection cannot be independently read with the current connector.

Cloudflare: the account initially contained only production Worker `pokemon-vintage-ebay-deals`. Its existing secrets and bindings must never be read, copied, edited or attached to Pokefolio. There were no Pokefolio Workers, KV namespaces or Pages projects at the initial audit.

Firebase: `pokemon-vintage-binder` is legacy production. A separate Pokefolio staging Firebase project and Auth/Firestore **are not yet provisioned or verified**. The Firebase plugin shows as installed, but this chat session exposes no callable Firebase administration action. Do not fall back to the production project.

## Approved staging architecture

1. Distinct Firebase **project**, not a second database in Vintage Binder. Independent Auth, Firestore Rules and service identities. Synthetic users/cards only.
2. Bootstrap Firestore rules in `firebase/firestore.rules` deny all; do not deploy them to any production project. Replace with independently tested owner-scoped rules only after staging identity and authorization are configured.
3. Create a separate Cloudflare Worker named `pokefolio-ebay-deals-staging`. Start by uploading `staging/locked-worker.mjs` as an **undeployed version** with no bindings/secrets. Disable workers.dev and preview subdomains and leave routes empty. The only response in the locked bootstrap is HTTP 503. See `staging/README.md`.
4. Eventually enable the full Worker only after independent eBay/AI/shipping credentials and token validation for the **staging Firebase project** are verified. The original Worker is off limits.
5. Keep public GitHub Pages staging disabled until a safe preview has been checked. `/pokemon-vintage-binder/` and `/pokefolio/` share browser origin `https://xfayne.github.io`; CORS and browser origins alone **do not** provide isolation. Enforce security server-side and check localStorage/service-worker behavior.
6. Require CI for staging isolation and the application's behavior. No automated cloud deploy until staged resource IDs, secrets and rollback process are verified.

## Acceptance and verification remaining

- [ ] Verify the staging Worker exists, has no production-resource bindings, has no public route/subdomain, and has no active deployment.
- [ ] Create a separate Firebase staging project and confirm independent Authentication, authorized domains, security rules and synthetic read/write tests.
- [ ] Configure separate staging secrets and any KV namespace with no reuse of production values/resources, then test token issuer/audience and owner isolation.
- [ ] Enable a safe staging preview only after above tests; set protected CI and documented rollback.
- [ ] Verify new frontend cannot mutate old Firestore, Worker, shipments or browser storage.

**Before any real user data:** receive explicit migration approval, verify complete backup independently, dry-run data import and compare cards, copies, orders, pending shipments, 3×3 binder pages/pockets and Wishlist order. Roll back by disabling Pokefolio, never by overwriting Vintage Binder.

Issue #2 stays **open** until all acceptance criteria pass.
