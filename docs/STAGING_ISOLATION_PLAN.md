# Issue #2 — Isolated staging infrastructure

Pokefolio uses a separate Firebase project and backend service. The owner authorized reuse of existing provider keys on 2026-11-19; this does not authorize changes to Vintage Binder collection data or shared shipment state.

## Configured and verified

- Firebase `pokefolio-staging`, independent Google sign-in, Firestore in `europe-west1`; authorized domains include `xfayne.github.io`. Live Pages sign-in and private collection load passed.
- Active private/public-projection rules from PR #36 passed 24 emulator tests. Owners alone access private progress/settings/analyses; public single-link reads require opt-in, enumeration/foreign writes/private fields are denied. Public viewing passed after owner sign-out. No real collection, Wishlist, binder ordering or shipment data was imported.
- Backend `pokefolio-api-staging` serves shared eBay, Gemini and shipment APIs. Its five secrets were imported with explicit authorization. eBay OAuth and live search (24 results, no errors), the configured Gemini model and actual image analysis, and read-only 17TRACK quota authentication passed. Legacy production deployment stayed on `75954b38-e777-4de8-aaa6-4df173b723b3`.
- The empty old staging Worker was retired after confirming it had zero bindings, deployments and secrets. No KV binding is referenced or needed.
- `TRACK17_MUTATIONS_ENABLED="false"` blocks staging registration even with a valid owner token; tests exercise enabled registration only against mocked upstream calls. Sharing provider keys does not isolate upstream account state. Keep this guard until an explicitly isolated test account or approved release configuration exists. Read-only tracking queries remain available.
- Main ruleset `27585981` requires PRs plus four up-to-date successful Actions checks, with no bypass actors; force pushes/deletion are blocked.
- Pages publishes from checked main through manual dispatch or a trusted successful main-push CI callback. The callback must originate in the same repository and match the current SHA; the source guard independently verifies all four checks. No PR artifacts or callback-supplied code are consumed. The registered staging Firebase and API are the only accepted runtime endpoints.
- Currency/postal browser keys are Pokefolio-specific. No legacy browser key is read, modified or deleted.

## Acceptance and remaining release work

The live `pokefolio-staging-manifest.json` and Issue #2 acceptance receipt record the deployed frontend source and backend activation. Positive authenticated browser AI/shipment workflows are covered further during product regression; private-route identity is covered by signed-token tests and live invalid-token rejection.

There is no Pokefolio production environment yet. Provision it near release under Issue #21 from the same application/API code, policies and tests, with separate Firebase data/auth, backend service and deployment configuration. Do not duplicate implementation. Do not point staging at production. Any actual collection transfer requires explicit approval, an independently verified private backup, dry-run comparisons and rollback.

## Rollback

- Disable only Pokefolio's API workers.dev route and/or Pages site, or redeploy a previously verified source through protected main.
- Apply `firebase/firestore.rules` for staging deny-all rollback; prior private-only rules can revoke public sharing without changing private documents.
- Never overwrite Vintage Binder to roll back Pokefolio. Legacy production remains the fallback.

The two Pages paths share `https://xfayne.github.io`; CORS is not an isolation boundary. Private backend operations require staging Firebase signatures and owner identity, and shared-account mutations remain disabled.
