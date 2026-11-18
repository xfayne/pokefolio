# Firebase staging bootstrap

Target: `pokefolio-staging` (project number `403637067452`).
Database: `(default)`, Standard edition, `europe-west1`, no-cost Spark plan.

The live bootstrap denies every client read and write. Google sign-in is independently enabled, but the frontend remains disconnected until owner-scoped rules and sign-in are tested. Do not reuse legacy credentials, data, or project aliases.

## Read-only verification

```sh
node scripts/firebase-staging.mjs --check
node --test tests/firebase-staging.test.mjs
```

These commands require no Firebase login or network. CI runs them without cloud credentials.

## Explicit deny-all rollback

After authenticating the Firebase CLI to an account authorized for the independent staging project:

```sh
node scripts/firebase-staging.mjs --deploy-bootstrap
```

The wrapper pins the project, database, configuration and rules. It rejects every project override, extra CLI argument, additional Firebase service or rule that grants client access. It deploys **only Firestore deny-all rules** to Pokefolio staging; it does not create projects, enable Auth, deploy hosting, or read/write/delete documents.

This rollback disables staging client access without overwriting documents. It never rolls back by modifying Vintage Binder. This wrapper's local validation is tested; remote CLI execution remains unverified in the current restricted terminal.

Do not use the bootstrap wrapper to deploy future owner-scoped rules. Those require a separate validated rollout. No real collection import is authorized by this setup.
