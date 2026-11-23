#!/usr/bin/env python3
"""Publish only the reviewed Wishlist rules to pokefolio-staging through the REST API.

Uses the caller's gcloud OAuth access token in Google Cloud Shell. Never
requests, stores, displays or uploads a service account key or token.
"""
import argparse
import difflib
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

PROJECT = "pokefolio-staging"
PINNED_COMMIT = "ac2dcae853f11738ecefbc326c514ff3d76ba42d"
RULES_URL = (
    "https://raw.githubusercontent.com/xfayne/pokefolio/"
    + PINNED_COMMIT + "/firebase/firestore.private.rules"
)
API = "https://firebaserules.googleapis.com/v1/"
RELEASE = f"projects/{PROJECT}/releases/cloud.firestore"
START = "      // Independent owner-only Wishlist priorities; never mutate binder/legacy progress.\n"
BINDER_START = "      // Layout only: no copy, transaction, legacy progress or Wishlist writes.\n"
END = "      match /preferences/{id} {\n"


def without_wishlist(source):
    if source.count(START) != 1 or source.count(END) != 1:
        raise RuntimeError("Reviewed Wishlist rule markers are missing or ambiguous")
    a = source.index(START)
    b = source.index(END)
    if b <= a:
        raise RuntimeError("Unexpected rule section order")
    wish_block = source[a:b]
    required = ("match /wishlists/{id}", "allow get: if isOwner(uid)",
                "allow list, delete: if false", "request.resource.data.ids")
    if not all(part in wish_block for part in required):
        raise RuntimeError("Wishlist rule section failed validation")
    return source[:a] + source[b:]


def without_binder_and_wishlist(source):
    if source.count(BINDER_START) != 1:
        raise RuntimeError("Reviewed Binder rule marker is missing or ambiguous")
    a = source.index(BINDER_START)
    b = source.index(START)
    c = source.index(END)
    if not a < b < c or "match /binders/{id}" not in source[a:b] or "allow list, delete: if false;" not in source[a:b]:
        raise RuntimeError("Unexpected Binder rule section order or contents")
    return source[:a] + source[c:]


def normalized(content):
    return content.replace("\r\n", "\n").strip()


def ensure_only_wishlist_added(active, target):
    expected_previous = without_wishlist(target)
    expected_pre_binder = without_binder_and_wishlist(target)
    if normalized(active) == normalized(target):
        return "already"
    # The actual staging release may predate the independently tested Binder
    # rule as well as Wishlist. These are the ONLY two authorized additions.
    if normalized(active) not in [normalized(expected_previous), normalized(expected_pre_binder)]:
        diff = list(difflib.unified_diff(
            normalized(active).splitlines(),
            normalized(expected_pre_binder).splitlines(),
            fromfile="currently-published-staging-policy",
            tofile="expected-previous-policy", lineterm=""
        ))
        detail = "\n".join(diff[:35])
        raise RuntimeError(
            "Published staging policy differs from both reviewed bases. "
            "Refusing to replace unrelated permissions.\n" + detail
        )
    return "update"


def http_json(method, url, token=None, payload=None):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        # Never print authorization headers or access tokens.
        details = error.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError(f"Rules API rejected {method} ({error.code}): {details}") from None


def get_access_token():
    result = subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True, text=True, check=False, timeout=20,
    )
    if result.returncode or not result.stdout.strip():
        raise RuntimeError(
            "Cloud Shell Google authorization is required. "
            "No cloud changes were made."
        )
    return result.stdout.strip()


def release_patch_payload(release_name, ruleset_name):
    """Firebase Rules REST projects.releases.patch requires a Release wrapper."""
    if not release_name.startswith(f"projects/{PROJECT}/releases/"):
        raise RuntimeError("Unexpected staging release")
    if not ruleset_name.startswith(f"projects/{PROJECT}/rulesets/"):
        raise RuntimeError("Unexpected staging ruleset")
    return {
        "release": {"name": release_name, "rulesetName": ruleset_name},
        "updateMask": "rulesetName",
    }


def source_from_ruleset(resource, token):
    data = http_json("GET", API + resource, token=token)
    files = data.get("source", {}).get("files", [])
    if len(files) != 1 or not isinstance(files[0].get("content"), str):
        raise RuntimeError("Unexpected active ruleset layout; refusing deployment")
    return files[0]["content"]


def release_ruleset(token):
    info = http_json("GET", API + RELEASE, token=token)
    name = info.get("rulesetName")
    if not isinstance(name, str) or not name.startswith(f"projects/{PROJECT}/rulesets/"):
        raise RuntimeError("Active release does not reference a staging ruleset")
    return name


def run(*, deploy=False):
    target_bytes = urllib.request.urlopen(RULES_URL, timeout=20).read()
    if len(target_bytes) >= 256 * 1024:
        raise RuntimeError("Rules exceed Firestore's size limit")
    target = target_bytes.decode("utf-8")
    without_wishlist(target)  # Confirm source includes the expected reviewed rule.
    sha = hashlib.sha256(target_bytes).hexdigest()
    print(f"Reviewed source: {PINNED_COMMIT} / firestore.private.rules")
    print(f"Target: {PROJECT} / (default) / cloud.firestore")
    print(f"Source SHA-256: {sha}")

    token = get_access_token()
    original_ruleset = release_ruleset(token)
    original = source_from_ruleset(original_ruleset, token)
    state = ensure_only_wishlist_added(original, target)

    if state == "already":
        print("SUCCESS: the expected Wishlist rules are already published.")
        return

    print(f"Validated current staging ruleset: {original_ruleset}")
    if not deploy:
        print("DRY RUN passed. No changes were made. Use --deploy to publish.")
        return

    backup_file = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", prefix="pokefolio-staging-rules-backup-",
        suffix=".rules", delete=False,
    )
    try:
        backup_file.write(original)
    finally:
        backup_file.close()
    print(f"Backup of previous source saved locally: {backup_file.name}")
    print(f"Previous release ruleset for rollback: {original_ruleset}")

    # Re-check the active release immediately before publication.
    if release_ruleset(token) != original_ruleset:
        raise RuntimeError("Active release changed during preflight; aborting.")

    created = http_json(
        "POST", API + f"projects/{PROJECT}/rulesets", token=token,
        payload={"source": {"files": [
            {"name": "firestore.rules", "content": target}
        ]}},
    )
    new_name = created.get("name")
    if not isinstance(new_name, str) or not new_name.startswith(f"projects/{PROJECT}/rulesets/"):
        raise RuntimeError("Unexpected Rules API create response; release unchanged")

    http_json(
        "PATCH", API + RELEASE, token=token,
        payload=release_patch_payload(RELEASE, new_name),
    )
    confirmed = release_ruleset(token)
    if confirmed != new_name or normalized(source_from_ruleset(confirmed, token)) != normalized(target):
        raise RuntimeError(
            "Rules API release readback did not match the requested policy. "
            "Inspect Firebase staging before making further changes."
        )
    print("SUCCESS: deployed and independently read back the new staging release.")
    print("The policy can take several minutes to propagate. Verify a signed-in owner read.")
    print(f"New active ruleset: {confirmed}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deploy", action="store_true", help="Publish after safe read-only validation")
    args = parser.parse_args()
    try:
        run(deploy=args.deploy)
    except (RuntimeError, OSError, UnicodeDecodeError, ValueError, urllib.error.URLError) as error:
        print("NOT DEPLOYED / UNVERIFIED: " + str(error), file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
