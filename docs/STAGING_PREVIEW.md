# Pokefolio staging deployment

## Active resources

- Frontend: https://xfayne.github.io/pokefolio/
- API: https://pokefolio-api-staging.xfayne.workers.dev
- Firebase: `pokefolio-staging`, registered Web app `1:403637067452:web:ea6738aebf38f14c637ab9`.
- API code comes from merged PR #38 (`1d55e3a3fe5e918ad59f738c6266e7942c496925`), version `c191f5cb-e28a-449a-8da2-752b928f7016`, deployment `6070c433-bbba-43e0-bbb5-88e436439a01`.
- The empty old staging service was retired. Vintage Binder's production deployment remains unchanged.

## Frontend publishing

The workflow accepts manual dispatch from main, or completion of a successful main-push `Main UI JavaScript Parity` run. Automatic callbacks must be pushes from the same repository on main and their SHA must equal the deployment context. No PR artifacts or callback-supplied code are consumed. Before packaging, `verify-staging-source.mjs` independently checks the current main SHA and all four successful GitHub Actions checks for that exact commit. A stale or unchecked commit is rejected.

The builder copies only frontend code/styles/images/fonts into a new output directory; backend/docs/hidden files, links, reused outputs and credentials are excluded. Runtime configuration loads before the safety gate. The visible staging marker and public `pokefolio-staging-manifest.json` identify the deployed SHA, Firebase project and enabled API capability. The Firebase Web configuration is public browser configuration, not an Admin/provider credential.

Repository variable `POKEFOLIO_FIREBASE_WEB_CONFIG` contains only the exact registered public `apiKey`, `projectId`, `authDomain` and `appId`. Automatic CI deployments enable the registered API; manual dispatch can choose `enable_api: false` for a disconnected preview. Any other API/Firebase endpoint is rejected. Pages uses Actions publishing, environment `pokefolio-staging` allows only branch main, and only the deploy job gets Pages/OIDC write permission.

First automatic API-enabled preview: https://github.com/xfayne/pokefolio/actions/runs/44471785519 , source `3e5eec14ce0ac1a2628d23addf6893fec1620cf5`. Its live manifest and runtime settings were read back and matched staging Firebase plus the exact API URL. The live manifest is authoritative for subsequent deployments; the final acceptance receipt is on Issue #2.

## Provider and authorization verification

All five owner-authorized provider credentials are encrypted Worker secrets. They never enter Git, Pages runtime configuration or artifacts. The temporary encrypted local transfer checkpoint was removed after import. Live eBay OAuth/search passed (24 search results, no provider errors); the configured Gemini model lookup and unchanged grading core returned a valid image analysis; 17TRACK read-only quota authentication passed. The API identifies itself as Pokefolio API. Private endpoints reject invalid bearer tokens; signed owner/cross-user/legacy-project tests run against mocked services. Positive authenticated browser AI/shipment workflows remain part of later product regression testing.

Shipment registration defaults to disabled through `TRACK17_MUTATIONS_ENABLED="false"`, even for a valid staging owner, because the reused key shares upstream account state with Vintage Binder. Read-only queries remain available. Do not enable registration to test real legacy shipments. No namespace is used or required.

Firebase private/public-projection rules from PR #36 (blob `4ab7d9b12274af9b631591dabb348d5504f3a03d`) passed 24 emulator tests. Private progress stays owner-only; opt-in public snapshots contain only bounded catalog IDs/kinds and preserve empty pockets. Live empty-binder publication and viewing after sign-out passed; automated tests cover nonempty/full-capacity order, atomic opt-in, schema rejection and link revocation. No real collection migration occurred.

## Rollback and release

Disable only Pokefolio API workers.dev and/or its Pages site, or revert source through a tested PR and redeploy checked main. Republish the prior private-only staging rules from PR #31 to revoke public sharing, or `firebase/firestore.rules` for full deny-all rollback; neither rewrites documents. Never overwrite Vintage Binder to roll back Pokefolio.

No Pokefolio production environment exists yet. Provision separate production resources near Issue #21 release from the same code/policies/tests. Any real data transfer requires explicit approval, a verified private backup, dry-run comparisons and rollback. Do not duplicate the application or point staging at production.
