# Firestore security verification

These tests run only against the loopback emulator at `127.0.0.1:8080` with project `demo-pokefolio-isolation`. They use synthetic users, cards, binder pockets and Wishlist positions. They require no Google login, API key, service account or real collection export.

Two policies are tested:
- `../firestore.rules`: the currently deployed deny-all bootstrap. Anonymous clients and both synthetic users must be denied application reads, queries, creates, updates and deletes.
- `../firestore.owner-probe.rules`: an **undeployed prototype**, granting access only to a synthetic `stagingChecks/{uid}` document owned by the authenticated UID. Required fields, schema, length, server timestamps, immutable identity and createdAt are validated on creates and updates. All actual collection, binder, Wishlist, shipment, sharing and analysis paths remain denied.

The prototype checks the owner-access mechanism without choosing or migrating an application data model. It is not a complete application ruleset and is not referenced by the staging deployment wrapper. Deployment of it is not automated.

## Run

Node 24.12 or later and Java 21 are required for the isolated test toolchain. Existing application CI continues to use Node 22.

```sh
npm --prefix firebase/testing install
npx -y firebase-tools@latest emulators:exec --only firestore --project demo-pokefolio-isolation --config firebase/emulator.json "npm --prefix firebase/testing test"
```

The test aborts unless the CLI has provided the exact loopback emulator address. Never substitute a real Firebase project or a remote emulator host.

CI compiles both policies in the emulator, verifies denied access between users and schema/ownership attacks, and checks that synthetic binder/Wishlist fixtures are unchanged. This does not prove live owner-scoped access or enable the product frontend.

Top-level test dependencies are pinned and private to this directory. No production dependency, credential or cloud deployment is added.
