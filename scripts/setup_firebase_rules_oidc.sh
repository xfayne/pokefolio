#!/usr/bin/env bash
# One-time, staging-only Google Cloud IAM trust setup for protected Pokefolio main.
# No JSON credentials, service-account keys or personal data are created.
set -euo pipefail

PROJECT="pokefolio-staging"
NUMBER="403637067452"
REPO_ID="1461040061"
POOL="pokefolio-github"
PROVIDER="github"
ACCOUNT="pokefolio-rules-ci"
EMAIL="${ACCOUNT}@${PROJECT}.iam.gserviceaccount.com"
WORKFLOW="xfayne/pokefolio/.github/workflows/staging-preview.yml@refs/heads/main"
MAPPING="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref,attribute.workflow_ref=assertion.workflow_ref"
CONDITION="assertion.repository_id == '${REPO_ID}' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '${WORKFLOW}'"
POOL_RESOURCE="projects/${NUMBER}/locations/global/workloadIdentityPools/${POOL}"
MEMBER="principalSet://iam.googleapis.com/${POOL_RESOURCE}/attribute.repository_id/${REPO_ID}"

if [[ "${#}" != "1" || ( "${1}" != "--check" && "${1}" != "--apply" ) ]]; then
  echo "Usage: bash scripts/setup_firebase_rules_oidc.sh --check|--apply" >&2
  exit 2
fi

command -v gcloud >/dev/null || { echo "Google Cloud Shell / gcloud is required." >&2; exit 1; }
ACTIVE="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n 1)"
[[ -n "${ACTIVE}" ]] || { echo "No authorized Google Cloud session is active." >&2; exit 1; }
NUMBER_ACTUAL="$(gcloud projects describe "${PROJECT}" --format='value(projectNumber)')"
[[ "${NUMBER_ACTUAL}" == "${NUMBER}" ]] || { echo "Unexpected Firebase/GCP project number. Aborting." >&2; exit 1; }
echo "Verified project: ${PROJECT} (${NUMBER}). Google account: ${ACTIVE}"
echo "Only GitHub repo ID ${REPO_ID}, protected main and staging-preview.yml are trusted."

if [[ "${1}" == "--check" ]]; then
  echo "Read-only preflight passed. Run with --apply once to configure workload identity."
  exit 0
fi

# APIs needed by Google Cloud IAM/Workload Identity/Firebase Rules.
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com firebaserules.googleapis.com \
  --project="${PROJECT}" --quiet

if gcloud iam service-accounts describe "${EMAIL}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Service account already exists: ${EMAIL}"
else
  gcloud iam service-accounts create "${ACCOUNT}" --project="${PROJECT}" \
    --display-name="Pokefolio staging Firestore rules publisher" --quiet
fi

if gcloud iam workload-identity-pools describe "${POOL}" --project="${PROJECT}" --location=global >/dev/null 2>&1; then
  echo "Workload identity pool already exists: ${POOL}"
else
  gcloud iam workload-identity-pools create "${POOL}" --project="${PROJECT}" --location=global \
    --display-name="Pokefolio GitHub staging" --quiet
fi

PROVIDER_JSON="$(gcloud iam workload-identity-pools providers describe "${PROVIDER}" \
  --project="${PROJECT}" --location=global --workload-identity-pool="${POOL}" \
  --format=json 2>/dev/null || true)"
if [[ -n "${PROVIDER_JSON}" ]]; then
  printf '%s' "${PROVIDER_JSON}" | python3 -c '
import json, sys
v=json.load(sys.stdin)
assert v.get("oidc",{}).get("issuerUri") == "https://token.actions.githubusercontent.com"
assert v.get("attributeMapping",{}) == {
 "google.subject":"assertion.sub",
 "attribute.repository_id":"assertion.repository_id",
 "attribute.ref":"assertion.ref",
 "attribute.workflow_ref":"assertion.workflow_ref",
}
expected = ("assertion.repository_id == '\''1461040061'\'' && "
 "assertion.ref == '\''refs/heads/main'\'' && "
 "assertion.workflow_ref == '\''xfayne/pokefolio/.github/workflows/staging-preview.yml@refs/heads/main'\''")
assert v.get("attributeCondition") == expected
assert not v.get("disabled",False)
'
  echo "Existing OIDC provider is verified as staging-only and tightly scoped."
else
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER}" \
    --project="${PROJECT}" --location=global --workload-identity-pool="${POOL}" \
    --display-name="Pokefolio main rules deployer" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="${MAPPING}" --attribute-condition="${CONDITION}" --quiet
fi

# The service account can administer Firebase Rules in this *staging project
# only*. The federated GitHub identity may impersonate only this account.
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${EMAIL}" --role="roles/firebaserules.admin" \
  --condition=None --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "${EMAIL}" \
  --project="${PROJECT}" --member="${MEMBER}" \
  --role="roles/iam.workloadIdentityUser" --quiet >/dev/null

echo "SUCCESS: keyless GitHub OIDC configured for ${PROJECT} only."
echo "Provider: ${POOL_RESOURCE}/providers/${PROVIDER}"
echo "Service account: ${EMAIL}"
echo "No keys created. The deployment workflow can now mint temporary staging-only tokens."
