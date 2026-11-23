# Automatic Firebase Rules release — Pokefolio Staging

## Purpose and boundaries

Security rules are tracked in `firebase/firestore.private.rules` on protected
`main`. After PR checks pass and a merge completes, the existing
`Pokefolio Staging Preview` GitHub Actions workflow now:

1. Verifies the current protected `main` commit and the five required CI checks.
2. Obtains a short-lived Google OAuth access token via **GitHub OIDC** and a
   dedicated staging-only Google service account.
3. Reads the live `projects/pokefolio-staging/releases/cloud.firestore` rules.
   If they match Git, the deploy is a no-op.
4. If different, verifies they are exactly the previous reviewed `main` rules
   or one of the two explicitly pinned, previously audited first-release
   baselines (pre-Binder/pre-Wishlist). Unexpected drift blocks deployment.
5. Publishes a new immutable Ruleset via Firebase Rules REST, sets the
   staging `cloud.firestore` release and independently reads back its source.
6. **Only after this rules job succeeds**, builds/uploads the Pages artifact
   and deploys the frontend.

The API is scoped to Firestore rules: no Firestore documents are modified.
The legacy Vintage Binder and independent `pokefolio-production` projects
are never used. No service-account key, long-lived secret or Google API key
is committed to GitHub. Production releases remain a separately approved task.

## One-time owner bootstrap (required before merging the workflow PR)

This ChatGPT session can edit GitHub but cannot administer Google Cloud IAM.
To allow future GitHub runs to publish rules, an authorized owner must use
Google Cloud Shell or a Google Cloud CLI login for **pokefolio-staging**:

```bash
curl -fsSL https://raw.githubusercontent.com/xfayne/pokefolio/f9c569043f5199fab117ced187a3012623b91518/scripts/setup_firebase_rules_oidc.sh -o /tmp/pokefolio-oidc.sh
bash /tmp/pokefolio-oidc.sh --check
bash /tmp/pokefolio-oidc.sh --apply
```

The first command downloads the immutable, reviewed script at a specific
Git commit. The second validates project ID and number **without changes**.
The third creates these IAM resources **in pokefolio-staging only**:

- Google service account:
  `pokefolio-rules-ci@pokefolio-staging.iam.gserviceaccount.com`
- Workload Identity pool:
  `projects/403637067452/locations/global/workloadIdentityPools/pokefolio-github`
- OIDC provider:
  `projects/403637067452/locations/global/workloadIdentityPools/pokefolio-github/providers/github`
- Scoped provider condition: immutable GitHub repository ID `1461040061`,
  ref `refs/heads/main`, and exact workflow reference
  `xfayne/pokefolio/.github/workflows/staging-preview.yml@refs/heads/main`
- Service account project role: `roles/firebaserules.admin` **staging only**
- WIF trust: `roles/iam.workloadIdentityUser` **only for repository ID
  1461040061** in that pool

The bootstrap enables Google IAM, IAM Credentials, STS and Firebase Rules
APIs for this one project if needed. IAM changes require suitable owner
permission. No private data, card records or keys are read or copied.
Workload identity permissions may take several minutes to propagate.

The GitHub workflow hardcodes these nonsecret identifiers; the user does
**not** have to configure GitHub secrets or variables.

After completing the bootstrap, merge the CI PR. Its first successful main
Staging Preview run should reconcile the missing Binder/Wishlist policy and
unblock the existing Wishlist page, subject to the usual propagation delay.
Verify Add to Wishlist, reload, priority change and reload. Do not claim
a live fix from emulator checks or a GitHub merge alone.

## Drift, rollback and failure safety

- A manual rules edit made directly in Firebase will cause later rules
  promotion to fail closed unless it is already identical to the current Git
  source. Fix drift through a reviewed PR, not an unconditional overwrite.
- The previous active Firebase Ruleset name is printed in the Actions log;
  it remains available for rollback by updating the **staging** release back
  to that identifier after verifying the project and identity.
- GitHub Pages build depends on rules promotion; if OAuth, validation or
  readback fails, no new Pages artifact is published. The previously
  deployed Pages site remains available.
- The first-release compatibility allowance is pinned to exactly the Git
  blob `c5fdbdde4d7b96b026a9e4f015cb9306e27cafff`. Changes to the
  rules file remove that allowance automatically; all subsequent releases
  require the live policy to match the previous reviewed main revision.
- Synthetic emulator tests exercise owner isolation and reject unsafe rules.
  Python tests cover baseline comparisons and workflow identity boundaries.
- The prior `scripts/firebase_rules_rest.py` manual Cloud Shell path remains
  available as an emergency fallback, not the routine publication mechanism.

## Required observation

After merging, verify: five current-main checks green, Rules job succeeded
with an exact source hash and current Ruleset readback, Pages deployment
succeeded, and a signed-in staging user can actually read/update Wishlist.
Record this verified result in GitHub issue #14. A Firebase rules publish
does not itself prove application-level authenticated acceptance.
