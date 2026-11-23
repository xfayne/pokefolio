# Production Firebase Rules — advance IAM setup only

The owner asked on 2026-11-23 whether the same keyless CI trust could
be prepared for **Pokefolio Production** now. It can. The independent project
already exists: `pokefolio-production` (project number `671195488376`),
with an empty Firestore database and no production frontend release.

This PR adds **only** a separate, strictly pinned one-time setup script.
It does not add or enable a production publishing workflow, modify
Firestore Rules, deploy any frontend, create or alter documents, or connect
to the legacy Pokémon Vintage Binder project.

## Security model

- Staging: `pokefolio-staging` / `403637067452`. Existing PR #127 is
  dedicated to automatic releases after protected-main CI.
- Production: `pokefolio-production` / `671195488376`. This script creates
  a separate `pokefolio-rules-prod-ci` service account, a separate
  workload identity pool and provider, and a production-project-only
  `roles/firebaserules.admin` binding.
- The Google provider accepts GitHub OIDC only when the immutable GitHub
  repository ID is `1461040061`, the ref is protected `main`, the workflow
  reference is **exactly** `xfayne/pokefolio/.github/workflows/production-firestore-rules.yml@refs/heads/main`,
  and the job runs with GitHub environment `pokefolio-production`.
- That production workflow **does not exist** in this PR and will require
  separate owner approval, explicit manual invocation and a protected
  GitHub Production environment with required reviewers before creation.
  Merely configuring WIF cannot publish anything on its own.

## One-time setup, when owner accepts persistent IAM trust

With the Google account authorized for the **production** Google Cloud
project, in Cloud Shell run these separately:

```bash
curl -fsSL https://raw.githubusercontent.com/xfayne/pokefolio/main/scripts/setup_firebase_rules_oidc_production.sh -o /tmp/pokefolio-prod-oidc.sh
bash /tmp/pokefolio-prod-oidc.sh --check
```

Review the printed project identity **before** running:

```bash
bash /tmp/pokefolio-prod-oidc.sh --apply
```

This modifies IAM, enables IAM/STS/Firebase Rules APIs if needed, and may
create service account and WIF resources in the production project.
It does not save long-lived keys. It may require Google Cloud owner/admin
permissions; propagation can be delayed.

**Risks**: `roles/firebaserules.admin` allows publishing Firebase Rules
within the production project. This is a standing delegated capability
even though the workflow is not yet in place. A compromised or malicious
future authorized workflow could weaken Firestore protection. The
Google project boundaries and narrow repository/ref/workflow/environment
conditions limit that exposure but do not eliminate it. IAM/STS services
may affect future project usage/billing; check organization policies
before enabling them. Do not paste access tokens or service account
private keys into ChatGPT or GitHub.

**Revocation**: revoke `roles/firebaserules.admin` on the production
project for the above service account, revoke its
`roles/iam.workloadIdentityUser` binding for the production WIF pool,
and disable its WIF provider. Revoking IAM does not roll back previously
published Rulesets; release rollback is separately controlled.

## Before the future production rules release

Obtain a fresh, approved real-data migration/production release plan (#21),
verify the deployed production Ruleset vs the desired rules, create a
manual-only approval-gated workflow and configure its GitHub environment
protection. Do not copy staging's automatically triggered workflow to
production or assume production is ready to host real portfolio data.
