# Pokefolio production provisioning

## Status: Firebase and API provisioned; production frontend pending

The owner authorized creating an independent empty Production environment and copying the five existing provider secrets on 2026-11-19. Authenticated browser access was restored and the backend/data-plane provisioning below was completed and independently read back on that date. The production frontend has not been packaged or published; the existing public Pages URL continues to use staging.

## Provisioned resources

| Resource | Production target | Verified status |
| --- | --- | --- |
| Firebase project | `pokefolio-production`, number `671195488376` | Exists in the owner's account, Spark plan |
| Firestore | Standard `(default)`, `europe-west1` | Created empty; shared private policy published |
| Firebase Web app | `1:671195488376:web:76efaed5b016e1a1a5cd8d` | Registered as Pokefolio Production Web |
| Firebase Auth | Independent Google provider | Enabled; fresh sign-in succeeded |
| Authorized domains | `localhost`, `pokefolio-production.firebaseapp.com`, `pokefolio-production.web.app`, `xfayne.github.io` | Console read-back verified |
| Cloudflare API | `pokefolio-api-production` | Deployed; workers.dev enabled, preview URLs disabled |
| Provider secrets | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `GEMINI_API_KEY`, `TRACK17_API_KEY`, `TRACK17_OWNER_EMAIL` | Five secret-text bindings independently listed |
| Frontend | Same application with validated production runtime | Not packaged or deployed |

The registered public Firebase Web configuration was read from the owner's console. Its auth domain is `pokefolio-production.firebaseapp.com`; provider credentials are never frontend configuration. Firebase Storage is not provisioned: the current application does not use that service, and the console requires a billing upgrade for it. No billing plan was upgraded.

## Deployment and acceptance receipt — 2026-11-19

- Checked source: merged PR #42, commit `d5b9d247c9c2442d295a47f63aafc87829f4308b`. All five PR workflows passed for its source head `2cf30bb2c8a9512f990585c097528b677db514d8`: isolation, JavaScript parity, style parity, Firestore emulator security, and Worker tests.
- Production API: https://pokefolio-api-production.xfayne.workers.dev
- Deployed version: `c37ed705-e888-4412-bd07-e47b22781ebb`, deployment `c56e5919-4137-4cd6-8b1a-037aa0891fc5`, 100%.
- The active deployment binds only `POKEFOLIO_FIREBASE_PROJECT_ID="pokefolio-production"`, `ALLOWED_ORIGIN="https://xfayne.github.io"`, owner-approved `TRACK17_MUTATIONS_ENABLED="true"`, and the five secret-text bindings.
- A private expiring diagnostic called the **deployed production service** through a temporary service binding: health returned 200, environment `production`, eBay ready and AI configured; shipment health returned 200 with registration enabled; live Pikachu Base Set search returned 200, two listings, and zero provider errors; an invalid owner bearer returned 403 `TRACKING_AUTH_REQUIRED`. Direct navigation without the approved Origin was also rejected. No tracking registrations were submitted.
- The copied shared Gemini key authenticated model lookup for `gemini-3.8-flash` (HTTP 200); the shared 17TRACK key authenticated read-only `getquota` (HTTP 200, code 0). This verifies provider authentication, not a new production photo-analysis or shipment mutation.
- Fresh Google sign-in from an isolated localhost probe verified token audience `pokefolio-production` and issuer `https://securetoken.google.com/pokefolio-production`.
- Seven read-only live Firestore checks passed: owner collection and owner settings reads returned missing documents; foreign-user reads, user enumeration, public-binder enumeration, unknown paths, and private reads after sign-out returned `permission-denied`. No Firestore documents were created.
- Published Firestore source is the same `firebase/firestore.private.rules` policy already exercised by the emulator suite. This includes opt-in public projections; live publication of a production binder was not tested because Production remains empty.
- Signed-token production/staging cross-rejection and foreign-owner cases passed the PR #42 Worker suite. A real signed cross-environment API request was not part of the live read-only check.
- Secret copy used a nonce-protected, expiring RSA-OAEP/AES-GCM envelope. No plaintext provider values were printed, committed, stored in a local credential file or injected into a browser. Diagnostic versions received no deployed traffic. Exact application source was restored as the latest upload; both Pokefolio services now have preview URLs disabled.
- Active staging deployment remains `c712ebc8-b9c5-4b82-b024-07efb5cab0dc`, version `a3851b2a-e988-4f83-8163-147ef3fa0dcf`. Active Vintage Binder deployment remains `f2af7082-0e14-49d4-bfd6-1b68cd792001`, version `75954b38-e777-4de8-aaa6-4df173b723b3`. No legacy Worker code, bindings, deployment, Firestore documents, or shipment records were changed in this session.

## Remaining frontend release work

Infrastructure is available for the React/TypeScript migration without repeating project setup or provider-key copying. This does not mean a production application release is complete.

1. Add a tested production runtime/build configuration using the registered exact project/app/API pairing. The current frontend gate and staging builder still intentionally accept only staging.
2. Provide the production frontend URL and deployment target while retaining the staging preview. Verify origin-specific browser storage and authentication isolation before hosting two environments.
3. Verify Google sign-in, private sync, opt-in sharing and the source/config manifest from that deployed production URL. Do not replace the existing Pages staging artifact as part of resource provisioning.
4. Import real data only through the independently verified backup, approved migration, dry-run comparison and rollback process under #21.

## Rollback and migration

Use `ebay-worker/wrangler.production.toml` for explicit production changes; the default Wrangler config remains staging. A Worker version rollback does not restore provider state or Firestore data. Roll back only Pokefolio resources; the deployed version above is the known baseline for this new service. The deny-all `firebase/firestore.rules` remains available as a deliberate emergency rollback policy; deploying it would deny application reads/writes.

17TRACK credentials intentionally share the existing provider account and quota. Registration is owner-authorized, but testing must not modify/delete existing tracking records. Production Firestore remains empty until approved onboarding/migration. Infrastructure approval does not authorize data cutover.
