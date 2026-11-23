from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent.parent


class OidcWiringTests(unittest.TestCase):
    def setUp(self):
        self.workflow = (ROOT / ".github/workflows/staging-preview.yml").read_text()
        self.bootstrap = (ROOT / "scripts/setup_firebase_rules_oidc.sh").read_text()

    def test_rules_job_precedes_frontend_and_uses_keyless_oidc(self):
        wf = self.workflow
        self.assertIn("id-token: write", wf)
        self.assertIn("google-github-actions/auth@v3", wf)
        self.assertIn("fetch-depth: 2", wf)
        self.assertIn("access_token_scopes: https://www.googleapis.com/auth/firebase", wf)
        self.assertIn("needs: rules", wf)
        self.assertLess(wf.index("  rules:"), wf.index("  build:"))
        self.assertIn("python3 scripts/firebase_rules_ci.py --deploy", wf)
        self.assertIn("scripts/verify-staging-source.mjs", wf)
        self.assertNotIn("credentials_json", wf)
        self.assertNotIn("pokefolio-production", wf)
        self.assertNotIn("pokemon-vintage-binder", wf)

    def test_bootstrap_is_project_pinned_and_restricts_repository_workflow(self):
        script = self.bootstrap
        for value in [
            'PROJECT="pokefolio-staging"', 'NUMBER="403637067452"',
            'REPO_ID="1461040061"',
            'roles/iam.workloadIdentityUser', 'roles/firebaserules.admin',
            "refs/heads/main", 'staging-preview.yml@refs/heads/main',
            "--attribute-condition=", 'sts.googleapis.com', "--check", "--apply",
        ]:
            self.assertIn(value, script)
        self.assertNotIn("service-accounts keys create", script)
        self.assertNotIn("pokefolio-production", script)
        self.assertNotIn("pokemon-vintage-binder", script)


if __name__ == "__main__":
    unittest.main()
