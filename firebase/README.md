# Firebase staging

Target: `pokefolio-staging` (`403637067452`). Standard Firestore `(default)`, `europe-west1`, Spark plan.

The active policy is `firestore.private.rules` from PR #31, deployed only after 18 emulator checks passed and the console confirmed an empty staging database. A live synthetic diagnostic verified owner reads/writes, cross-user and anonymous denials, schema checks and denied root deletion/public access. One marked synthetic analysis record remains; no collection, binder, Wishlist or shipment data was imported.

The retained progress map is opaque so infrastructure cannot normalize or migrate it. This is ownership/top-level validation, not the future transaction schema or complete nested business-data validation. Public sharing remains closed. The product frontend is still disconnected.

## Verification

```sh
node scripts/firebase-staging.mjs --check
node --test tests/firebase-staging.test.mjs
```

These validate the exact deny-all rollback target/configuration, not the currently deployed policy, and need no credentials/network. See `testing/README.md` for all emulator policies and two-user tests.

## Explicit deny-all rollback

```sh
node scripts/firebase-staging.mjs --deploy-bootstrap
```

After authenticating the Firebase CLI for staging, the wrapper publishes only `firestore.rules` to `pokefolio-staging`. It rejects project overrides, extra arguments, additional services and access-granting rules. It does not read, replace or delete documents. Remote CLI execution remains unverified in this restricted terminal; the console also retains the previous deny-all version.

The wrapper deliberately cannot deploy the private policy. That rollout was performed through the console from verified merged source, followed by live synthetic checks. No public Firebase Hosting, production credentials or real-data migration is enabled by this setup.
