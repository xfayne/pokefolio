# Firestore security verification

These tests run only against the loopback emulator at `127.0.0.1:8080` with project `demo-pokefolio-isolation`. They use synthetic users, cards, binder pockets and Wishlist positions. They require no Google login, API key, service account or real collection export.

Three policies are tested:
- `../firestore.rules`: the deny-all bootstrap/rollback policy. Anonymous clients and both synthetic users must be denied application reads, queries, creates, updates and deletes.
- `../firestore.owner-probe.rules`: an **undeployed prototype**, granting access only to a synthetic `stagingChecks/{uid}` document owned by the authenticated UID. Required fields, schema, length, server timestamps, immutable identity and createdAt are validated on creates and updates. All actual collection, binder, Wishlist, shipment, sharing and analysis paths remain denied.

- `../firestore.private.rules`: the **active staging policy** for private application access using the existing `users/{uid}` document and private sharing/analysis subcollections. It validates top-level metadata, preserves the legacy progress map as an opaque payload, denies root deletion and public binder access, and does not introduce the future transaction schema.

The prototype checks the owner-access mechanism without choosing or migrating an application data model. It is not a complete application ruleset and is not referenced by the staging deployment wrapper. Deployment of the probe is not automated. The private application policy was published separately to staging after CI and checked with a live synthetic diagnostic.

## Run

Node 24.12 or later and Java 21 are required for the isolated test toolchain. Existing application CI continues to use Node 22.

```sh
npm --prefix firebase/testing install
npx -y firebase-tools@latest emulators:exec --only firestore --project demo-pokefolio-isolation --config firebase/emulator.json "npm --prefix firebase/testing test"
```

The test aborts unless the CLI has provided the exact loopback emulator address. Never substitute a real Firebase project or a remote emulator host.

CI compiles all three policies in the emulator, verifies denied access between users and schema/ownership attacks, and checks that synthetic binder/Wishlist fixtures are unchanged. This does not prove live owner-scoped access or enable the product frontend.

Top-level test dependencies are pinned and private to this directory. No production dependency, credential or cloud deployment is added.
