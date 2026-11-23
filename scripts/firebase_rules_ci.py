#!/usr/bin/env python3
"""Promote Firestore Security Rules to the isolated Pokefolio staging release.

Runs after protected-main CI, with a short-lived GitHub OIDC-derived access
token. Never reads service account keys or writes Firestore user documents.
"""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import time

from firebase_rules_rest import (
    RELEASE, PROJECT, http_json, normalized, release_ruleset,
    source_from_ruleset, without_binder_and_wishlist, without_wishlist,
)

ROOT = Path(__file__).resolve().parent.parent
RULES = ROOT / "firebase" / "firestore.private.rules"
# Immutable reviewed policy from #124. Only this exact source can bootstrap
# staging if its rules are still from before the Binder or Wishlist addition.
INITIAL_GIT_BLOB = "c5fdbdde4d7b96b026a9e4f015cb9306e27cafff"


def git_blob_hash(source):
    data = source.encode("utf-8")
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def promotion_plan(active, previous, target):
    if normalized(active) == normalized(target):
        return "already-current"
    if normalized(active) == normalized(previous) and normalized(previous) != normalized(target):
        return "reviewed-main-change"
    if git_blob_hash(target) == INITIAL_GIT_BLOB:
        if normalized(active) == normalized(without_wishlist(target)):
            return "initial-wishlist-activation"
        if normalized(active) == normalized(without_binder_and_wishlist(target)):
            return "initial-binder-and-wishlist-activation"
    raise RuntimeError(
        "Staging rules do not match the approved preceding Git revision. "
        "Refusing to overwrite an unknown remote policy. Investigate drift manually."
    )


def previous_git_rules():
    result = subprocess.run(
        ["git", "show", "HEAD^:firebase/firestore.private.rules"],
        cwd=ROOT, text=True, capture_output=True, check=False, timeout=15,
    )
    if result.returncode != 0 or not result.stdout:
        raise RuntimeError("Cannot inspect the parent main revision; checkout requires fetch-depth: 2.")
    return result.stdout


def run(deploy=False, token=None):
    if not token:
        raise RuntimeError("Missing short-lived Firebase Rules OAuth token from GitHub OIDC.")
    if os.environ.get("GITHUB_REPOSITORY") != "xfayne/pokefolio":
        raise RuntimeError("This publisher can only run inside the Pokefolio repository.")
    if os.environ.get("GITHUB_REF") != "refs/heads/main":
        raise RuntimeError("Only protected main can publish staging rules.")
    if os.environ.get("GITHUB_EVENT_NAME") not in ("workflow_run", "workflow_dispatch"):
        raise RuntimeError("Untrusted workflow event; refusing publication.")
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT,
                          text=True, capture_output=True, check=True, timeout=15).stdout.strip()
    if head != os.environ.get("GITHUB_SHA"):
        raise RuntimeError("Checkout does not match the triggering protected-main SHA.")
    target = RULES.read_text(encoding="utf-8")
    previous = previous_git_rules()
    sha256 = hashlib.sha256(target.encode("utf-8")).hexdigest()
    print(f"Release target: {PROJECT} / cloud.firestore (default) · Git SHA {head}")
    print(f"Current reviewed rules SHA-256: {sha256}")
    currently_active = release_ruleset(token)
    remote = source_from_ruleset(currently_active, token)
    plan = promotion_plan(remote, previous, target)
    print(f"Current active Ruleset: {currently_active}. Decision: {plan}")
    if plan == "already-current":
        print("SUCCESS: active staging rules match Git exactly (no publish needed).")
        return
    if not deploy:
        print("DRY RUN passed; no remote changes made.")
        return

    # Previous Rulesets remain in Firebase for version-based rollback. Never
    # store access tokens, documents or backup credentials in artifacts.
    if release_ruleset(token) != currently_active:
        raise RuntimeError("Rules release changed concurrently; refusing overwrite.")
    created = http_json(
        "POST", f"https://firebaserules.googleapis.com/v1/projects/{PROJECT}/rulesets",
        token=token, payload={"source": {"files": [{"name": "firestore.rules", "content": target}]}},
    )
    new_name = created.get("name")
    if not isinstance(new_name, str) or not new_name.startswith(f"projects/{PROJECT}/rulesets/"):
        raise RuntimeError("Invalid new staging Ruleset name; no release updated.")
    http_json(
        "PATCH", f"https://firebaserules.googleapis.com/v1/{RELEASE}?updateMask=rulesetName",
        token=token, payload={"name": RELEASE, "rulesetName": new_name},
    )
    for attempt in range(8):
        published = release_ruleset(token)
        if published == new_name and normalized(source_from_ruleset(published, token)) == normalized(target):
            print(f"SUCCESS: rules deployed to {PROJECT} and exact content read back.")
            print(f"Rollback Ruleset: {currently_active}")
            print(f"Current Ruleset: {new_name}")
            return
        if attempt < 7:
            time.sleep(2)
    raise RuntimeError("Firebase Rules readback disagrees with the intended policy; manual investigation required.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deploy", action="store_true", help="Publish after strict baseline and identity checks")
    args = parser.parse_args()
    try:
        run(deploy=args.deploy, token=os.environ.get("FIREBASE_RULES_ACCESS_TOKEN"))
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print("STAGING RULES FAILED CLOSED: " + str(error), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
