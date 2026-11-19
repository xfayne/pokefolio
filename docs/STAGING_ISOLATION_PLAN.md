# Issue #2 — Isolated staging status

The owner approved a distinct Firebase project and distinct Worker. No production Vintage Binder data may be copied or modified. The owner explicitly authorized reuse of existing provider credentials; those values stay server-side.

## Verified infrastructure

- **Firebase:** `pokefolio-staging` (`403637067452`), Spark plan, Standard Firestore `(default)` in `europe-west1`. Independent Google sign-in and Web app are configured. Authorized domains: `localhost`, `pokefolio-staging.firebaseapp.com`, `pokefolio-staging.web.app`.
- **Private rules:** merged `firebase/firestore.private.rules` (blob `0286137cee6c768ac325fbb6897fa27c0b7700f5`) is now active in staging. The console first confirmed the database was empty. Eighteen demo-only emulator tests passed. The retained private progress map is opaque; infrastructure does not normalize binder positions, empty pockets, Wishlist order, snapshots or shipments. Root deletion, cross-user access, enumeration, public shared binders and unknown paths are denied.
- **Live authorization:** staging Google issuer/audience, own missing collection read, cross-user read/write denial, enumeration denial, synthetic analysis create/read/update, schema rejection, deletion/public-access rejection and signed-out denial were checked through a temporary localhost diagnostic. One explicitly synthetic analysis record remains; no collection data was created or imported.
- **Worker:** `pokefolio-api-staging` remains undeployed, with one deny-only uploaded version, no bindings/secrets, disabled public/preview URLs and no routes. No production Worker was changed. The full source accepts only staging Firebase identity and has 30 signed-token scenarios before any mocked shipment mutation.
- **Storage:** the imported Worker references no KV binding and the connected account lists no namespaces. No unused namespace was provisioned.
- **Main protection:** active ruleset `27585981` targets only `refs/heads/main`, has no bypasses, blocks deletion and force pushes, requires a PR with zero manual approvals, and requires up-to-date `staging-isolation`, `javascript-parity`, `style-parity`, `firestore-rules` checks from GitHub Actions (`15368`). API read-back confirms protection.
- **Browser boundary:** runtime configuration is pinned to the exact staging project/Worker. Currency and postal browser keys are Pokefolio-specific. No service worker or other browser persistence was found in the imported frontend. The product frontend remains disconnected until its staging configuration/hosting is verified.

## Remaining acceptance work

- [x] Independent Firebase project, Google sign-in and private security policy.
- [x] Emulator and live synthetic owner-isolation checks.
- [x] Independent locked Worker and verified absence of production bindings.
- [x] Protected main with required PR checks and a deny-all rollback source.
- [ ] Wire and verify the product frontend and a safe Pages staging preview.
- [ ] Configure independent eBay, grading and shipping integrations; keep all disabled until their resources and credentials are verified.
- [ ] Complete frontend/browser-storage and deployment acceptance checks, and document the final preview rollback.

`/pokemon-vintage-binder/` and `/pokefolio/` share the origin `https://xfayne.github.io`; CORS is not an isolation boundary. Enforce identity on private backend operations, separate Firebase projects and application identities, and never inherit the original app's settings.

A new 17TRACK key in the same account may still share upstream shipment state. Verify account/application isolation before enabling `register`; never use the legacy account's mutable shipment state for tests. eBay and AI credentials must also be independently configured, and secret values must never appear in Git, browser configuration or logs.

## Rollback and real-data boundary

`firebase/firestore.rules` is the deny-all rollback policy. `node scripts/firebase-staging.mjs --check` validates the exact project/configuration without cloud access; `--deploy-bootstrap` explicitly publishes only deny-all rules to staging after CLI authentication. Local validation is tested; this restricted terminal cannot verify remote CLI execution. The console's previous deny-all rules version is also retained. Neither route rewrites documents.

Keep the Worker unexposed and the frontend disconnected until their verification is complete. Rollback must disable Pokefolio access or restore a previously verified staging artifact, never overwrite Vintage Binder.

Before any real collection import: obtain explicit migration approval, independently verify a complete private backup, dry-run the import, compare copies/orders/pending shipments/binder pockets/pages/Wishlist order, and maintain a tested rollback. No real-data migration is authorized by this infrastructure work. Issue #2 remains open.

## Provider activation update — 2026-11-19

All five provider credentials were recovered and imported into `pokefolio-api-staging` with explicit owner authorization. Legacy production deployment remains unchanged. Provider authentication checks passed (eBay OAuth, Gemini model lookup and 17TRACK read-only quota). Full API activation is pending required CI. Shipment registration requires explicit `TRACK17_MUTATIONS_ENABLED="true"`; deployed staging keeps it false so the shared upstream account cannot be mutated. No namespace is used. Pages can enable only the exact staging API via a manual workflow input. Production Pokefolio resources remain a release-stage task, not a second codebase.
