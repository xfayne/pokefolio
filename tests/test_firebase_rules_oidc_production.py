import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "setup_firebase_rules_oidc_production.sh"

class ProductionBootstrapTests(unittest.TestCase):
    def setUp(self):
        self.src = SCRIPT.read_text()

    def test_exact_independent_production_scope(self):
        for required in [
            'PROJECT="pokefolio-production"', 'NUMBER="671195488376"',
            'REPO_ID="1461040061"', 'ACCOUNT="pokefolio-rules-prod-ci"',
            'PROVIDER="github-production"',
            '.github/workflows/production-firestore-rules.yml@refs/heads/main',
            "assertion.environment == 'pokefolio-production'",
            'attribute.environment=assertion.environment',
            'roles/firebaserules.admin', 'roles/iam.workloadIdentityUser',
            'gcloud projects describe', 'gcloud services enable',
            '--check', '--apply'
        ]:
            self.assertIn(required, self.src)

    def test_no_rules_publishing_or_key_export_and_no_staging_target(self):
        for forbidden in [
            'pokefolio-staging', 'pokemon-vintage-binder',
            'staging-preview.yml', 'firebase deploy', 'firebaserules.googleapis.com/v1/',
            'service-accounts keys create', 'credentials_json',
            'git clone', 'firebase/firestore.private.rules'
        ]:
            self.assertNotIn(forbidden, self.src)
