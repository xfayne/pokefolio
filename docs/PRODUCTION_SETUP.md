# Pokefolio production provisioning

## Status: prepared, not provisioned

The owner approved creating a separate empty Production environment and copying all five existing provider secrets on 2026-11-19. Provisioning is currently blocked by unavailable Firebase management/browser tools and a local authentication-file access denial. CLI repair also failed because a dependency download returned HTTP 403. No production project, API service, secret copy or production frontend deployment has been completed.

## Resource plan

| Resource | Production target | Status |
| --- | --- | --- |
| Firebase project | `pokefolio-production` (verify availability and ownership first) | Not created |
| Firestore | Independent default database, europe-west1 | Not created |
| Firebase Auth | Independent Google sign-in | Not configured |
| Cloudflare | `pokefolio-api-production` | Not created |
| Provider secrets | EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, GEMINI_API_KEY, TRACK17_API_KEY, TRACK17_OWNER_EMAIL | Copy authorized, pending |
| Frontend | Same application, independently validated production runtime | Not deployed |

The public Pokefolio Pages URL currently remains staging. Do not replace it as part of infrastructure provisioning. A production runtime/build configuration must validate the registered production Web app ID and pair it only with the production API. Keep the existing staging gate and workflow unchanged until that configuration is tested. Hosting the two artifacts and choosing a production URL does not require duplicating the application.

## Resume sequence

1. Restore authenticated Firebase management access. Inspect existing projects; create the new project only if its planned ID is available. Never reuse an unrelated project.
2. Create the independent Firestore and Web app; configure Google Auth and authorized hosting domains. Deploy the exact shared `firebase/firestore.private.rules` policy already exercised by the emulator suite. Do not import real user documents.
3. Record the registered public Web configuration and project number. Add a tested production artifact configuration using the same frontend sources, with exact project/app/API pairing; keep staging artifacts pinned to staging.
4. Copy all five authorized provider credentials server-to-server or through an authenticated, expiring encrypted transfer. Never commit, log, or inject provider keys into the browser. Verify all five destination secret names and provider authentication. Shared 17TRACK registrations and quota are owner-authorized; do not modify/delete existing tracking records during testing.
5. Deploy the same API modules with `ebay-worker/wrangler.production.toml` only after verifying project ownership and current CI. The default Wrangler config still targets staging. Private API tokens must match that deployment's exact Firebase project; staging and production tokens are rejected across environments.
6. Independently verify health, sign-in, owner-only data access, cross-environment token rejection, public share policy and the source/config manifest. Do not register synthetic tracking numbers in the real provider account.
7. Record actual resource identifiers, versions, deployments and test receipts here and in PROJECT_CONTEXT.md. Only then mark provisioning complete.

## Rollback and migration

A Worker version rollback does not restore provider state or Firestore data. Roll back only Pokefolio resources. Keep Vintage Binder's active Worker and database unchanged. Production stays empty until an independently verified backup and approved migration/dry run under #21. Infrastructure approval does not authorize data cutover.
