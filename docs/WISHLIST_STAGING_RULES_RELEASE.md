# Wishlist Cards — staging Firestore rules release

## Incident

On 2026-11-23, Wishlist Cards (#124) was deployed on GitHub Pages before
the accompanying `firebase/firestore.private.rules` was published to
`pokefolio-staging`. A signed-in owner can reach `#/wishlist/cards` but
the Firestore server rejects the new `users/{uid}/wishlists/main` read.
The UI correctly reports "Could not load Wishlist"; refreshing alone
cannot grant the missing server permission. Emulated rules tests passing
does not mean those rules are active in the Firebase project.

Do **not** solve this by switching to cached/local Wishlist state, creating
the document with Admin SDK or allowing broad access. Do **not** touch the
legacy Vintage Binder or Pokefolio production project.

## Staging-only, non-destructive release procedure

1. Verify the active account and project are **pokefolio-staging**
   (project number `403637067452`; default Firestore database). Do not
   select the separate `pokefolio-production` or legacy project.
2. Make sure all five checks passed for the current merged `main` (including
   Firestore Emulator Security), and inspect the full committed
   [private Firestore rules](../firebase/firestore.private.rules).
3. With an authenticated Firebase CLI account authorized for that exact
   staging project, run from repository root:

   ```sh
   node scripts/firebase-private-staging.mjs --check
   POKEFOLIO_STAGING_RULES_ACK=pokefolio-staging node scripts/firebase-private-staging.mjs --deploy-private
   ```

   On Windows PowerShell, set `$env:POKEFOLIO_STAGING_RULES_ACK = 'pokefolio-staging'`
   before invoking the second command.

   Alternatively in the **Firebase console** under the exact staging
   project, open Firestore Database → Rules, paste the **entire** current
   `firebase/firestore.private.rules` file from merged main and Publish.
   The whole source is required because Firestore Rules publication replaces
   the previous policy; never paste only the Wishlist block.
4. Independently verify that an authenticated owner can read a missing
   `users/{uid}/wishlists/main` document (initially empty), then add
   one desired card from Catalog Details, reload Wishlist, move it and
   verify the order persists after another reload. The test uses the
   owner's intended test data only; **no historical collection migration**.
5. Check that anonymous/other-user access and listing remain denied,
   and that Collection/Transactions/Binder still read normally.
6. Record the exact deployed policy hash and live verification outcome
   under #14. Only then mark the owner-visible incident resolved.

The new staging-only CLI wrapper is intentionally **manual** and never runs
from GitHub Pages CI. It refuses custom projects, databases or services,
and it never writes Firestore documents. It does not authenticate itself:
a legitimate staging-authorized Firebase session is needed for publication.
The existing deny-all bootstrap wrapper remains an explicit emergency
rollback mechanism, not the standard feature-promotion method.

## Single-command Google Cloud Shell alternative (REST API)

For the signed-in staging project owner who has access to Google Cloud Shell,
the API-based deploy script uses **the Cloud Shell user's existing OAuth token**.
It does not require a service-account key, Firebase CLI login, or a Work session.

Open https://shell.cloud.google.com/?show=terminal (the standard personal Cloud
Shell; do not use an untrusted/repository-cloned temporary Cloud Shell).
After authorizing the Cloud Shell session, paste the single command below:

```sh
curl -fsSL https://raw.githubusercontent.com/xfayne/pokefolio/main/scripts/firebase_rules_rest.py -o /tmp/pokefolio-wishlist-rules.py && python3 /tmp/pokefolio-wishlist-rules.py --deploy
```

The pinned source is the audited full private Firestore rules at commit
\`ac2dcae853f11738ecefbc326c514ff3d76ba42d\`. Before deploying, the
script reads the currently active live staging release and refuses to replace
it unless adding the reviewed Binder and/or Wishlist rules are the **only** changes. It saves a
local backup and prints the previous ruleset ID for rollback. It then creates
a ruleset, updates only \`cloud.firestore\` on \`pokefolio-staging\`, and
checks the published release and complete contents. It does not mutate user
documents or alter any production Firebase project.

The script intentionally stops on a mismatched active policy, missing OAuth
permission, or API error. In that case do **not** blindly override with
a whole-file manual publish: first reconcile the unexpected rules difference.

Google Cloud Shell is not controlled by ChatGPT. The command must be run
by an authenticated principal with Firebase Rules publishing permissions.
