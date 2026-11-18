# Issue #2 — Staging isolation and approval checklist

Status: **architecture approved 2026-11-18; separate Cloudflare staging Worker and Firebase deny-all bootstrap created and verified; owner authorization, frontend sign-in and hosting still pending**. The approved design uses distinct Firebase projects and Workers for Pokefolio and Vintage Binder.

## Read-only inventory

GitHub: `xfayne/pokefolio` main contains the safe Vintage Binder snapshot from #1. Three CI workflows passed. No Pokefolio Pages deployment was enabled at the last audit. GitHub API read-back on 2026-11-18 confirms active ruleset `27585981` (`Pokefolio main CI protection`) targets only `refs/heads/main`, has no bypass actors, blocks deletion and force pushes, requires a pull request with zero manual approvals, and requires up-to-date `staging-isolation`, `javascript-parity`, `style-parity`, and `firestore-rules` checks from GitHub Actions (`integration_id=15368`). Branch read-back reports `protected=true`.

Cloudflare: the account initially contained only production Worker `pokemon-vintage-ebay-deals`. Its existing secrets and bindings must never be read, copied, edited or attached to Pokefolio. There were no Pokefolio Workers, KV namespaces or Pages projects at the initial audit.

**Cloudflare verification (2026-11-18):** Worker `pokefolio-ebay-deals-staging` was created via the Worker resource API with `subdomain.enabled=false`, `previews_enabled=false`. Version 1 (`8baa6e12-8cb7-47a1-9082-dfcf3e1a0ecb`) was uploaded from the merged deny-only source in PR #25 and has **no bindings or secrets**. Read-back confirmed `deployed_on=null`, zero deployments, and disabled public/preview subdomains. The original Worker remained listed, and no production resource was modified. No routes or custom domains were created.

Firebase: `pokemon-vintage-binder` is legacy production and remains off limits. On 2026-11-18, the Firebase Console created and displayed the independent `pokefolio-staging` project (number `403637067452`, no-cost Spark plan). Standard Firestore `(default)` was provisioned in `europe-west1`; its data screen showed no collections, and the rules editor confirmed `allow read, write: if false`. Google sign-in was enabled independently, without reusing an external OAuth client. Authorized domains were read back as `localhost`, `pokefolio-staging.firebaseapp.com`, and `pokefolio-staging.web.app`. No user data was copied, no test documents were written, and no frontend connection was enabled. A separate Web app `Pokefolio Staging Web` was registered without Firebase Hosting. A temporary localhost diagnostic signed in with Google using Firebase Web SDK 13.1.0 and verified the returned token audience and issuer identify `pokefolio-staging`. Live reads and attempted synthetic writes were denied with `permission-denied` both without authentication and after sign-in. No Firestore document was created; the sign-in created one staging Auth identity. These checks verify the deny-all bootstrap, **not owner-only access**. The actual product frontend remains disconnected; owner-scoped rule tests and application integration remain pending.

The installed Firebase plugin still exposes no callable administration tools in this session. The terminal cannot reach GitHub/npm, and its cached Firebase CLI is incomplete. Provisioning was performed through the authenticated Firebase Console; this does not constitute verification of a working local deployment CLI.

The current imported Worker does not reference a KV binding; the connected account also reports zero KV namespaces. No unused namespace was provisioned. The deny-only staging Worker was independently rechecked: public and preview URLs remain disabled and deployments remain empty.

The full Worker source now accepts Firebase tokens only for `pokefolio-staging`, including strict numeric time claims and a string UID. Signed synthetic tests verify legacy/foreign projects, other users, unverified email, malformed timestamps, invalid signatures and origins cannot reach the mocked 17TRACK mutation endpoint. No credentials or real provider calls are used by these tests. This source has not been deployed.

An isolated CI emulator suite tests both the deployed deny-all policy and an undeployed owner-probe prototype under `stagingChecks/{uid}`. It checks two-user and anonymous isolation, schema/timestamp/ownership attacks and unchanged synthetic binder/Wishlist fixtures. This does **not** authorize application data or deploy rules. Owner-scoped application integration is still pending.

## Approved staging architecture

1. Distinct Firebase **project**, not a second database in Vintage Binder. Independent Auth, Firestore Rules and service identities. Synthetic users/cards only.
2. Bootstrap Firestore rules in `firebase/firestore.rules` deny all; do not deploy them to any production project. Replace with independently tested owner-scoped rules only after staging identity and authorization are configured.
3. Create a separate Cloudflare Worker named `pokefolio-ebay-deals-staging`. Start by uploading `staging/locked-worker.mjs` as an **undeployed version** with no bindings/secrets. Disable workers.dev and preview subdomains and leave routes empty. The only response in the locked bootstrap is HTTP 503. See `staging/README.md`.
4. Eventually enable the full Worker only after independent eBay/AI/shipping credentials and token validation for the **staging Firebase project** are verified. The original Worker is off limits.
5. Keep public GitHub Pages staging disabled until a safe preview has been checked. `/pokemon-vintage-binder/` and `/pokefolio/` share browser origin `https://xfayne.github.io`; CORS and browser origins alone **do not** provide isolation. Enforce security server-side and check localStorage/service-worker behavior.
6. Require CI for staging isolation and the application's behavior. No automated cloud deploy until staged resource IDs, secrets and rollback process are verified.

## Acceptance and verification remaining

- [x] Verify the staging Worker exists, has no production-resource bindings, has no public route/subdomain, and has no active deployment (verified against Cloudflare API 2026-11-18).
- [x] Create separate Firebase staging project, empty Firestore with deny-all bootstrap, independent Google provider, and read back authorized domains (2026-11-18).
- [x] Verify staging Google sign-in through localhost diagnostic and validate token issuer/audience; verify unauthenticated and authenticated Firestore requests both deny access (2026-11-18).
- [ ] Implement and test owner-scoped rules, two-user synthetic read/write isolation, and product frontend integration.
- [ ] Configure separate staging secrets and any KV namespace with no reuse of production values/resources, then test token issuer/audience and owner isolation.
- [x] Enforce PRs and all four current CI checks on main, with no bypass actors; independently verify via GitHub API (2026-11-18).
- [ ] Enable a safe staging preview only after above tests; document preview rollback.
- [ ] Verify new frontend cannot mutate old Firestore, Worker, shipments or browser storage.

**Before any real user data:** receive explicit migration approval, verify complete backup independently, dry-run data import and compare cards, copies, orders, pending shipments, 3×3 binder pages/pockets and Wishlist order. Roll back by disabling Pokefolio, never by overwriting Vintage Binder.

Issue #2 stays **open** until all acceptance criteria pass.


The private application candidate in `firebase/firestore.private.rules` retains the existing `users/{uid}` progress format and private sharing/analysis paths. The progress payload remains opaque so security setup does not normalize or migrate binder positions, empty pockets, Wishlist order, snapshots or shipments. Ownership and top-level metadata are validated; full per-card business-schema validation belongs to the approved later data-model work. User-document deletion and public shared-binder access remain denied. The default deployed/rollback policy is still deny-all; the private candidate must pass emulator tests and a separate verified staging rollout before frontend wiring.
