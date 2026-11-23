import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location("firebase_rules_ci", ROOT / "scripts" / "firebase_rules_ci.py")
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


class RulesPromotionTests(unittest.TestCase):
    def setUp(self):
        self.target = (ROOT / "firebase" / "firestore.private.rules").read_text()
        self.before_wishlist = mod.without_wishlist(self.target)
        self.before_binder = mod.without_binder_and_wishlist(self.target)

    def test_no_change_is_idempotent(self):
        self.assertEqual(mod.promotion_plan(self.target, self.target, self.target), "already-current")

    def test_normal_main_promotion_and_refuses_drift(self):
        next_rules = self.target.replace("&& request.resource.data.ids.size() <= 40000", "&& request.resource.data.ids.size() <= 39000")
        self.assertEqual(mod.promotion_plan(self.target, self.target, next_rules), "reviewed-main-change")
        with self.assertRaisesRegex(RuntimeError, "Refusing"):
            mod.promotion_plan(self.target + "\n// unexpected drift", self.target, next_rules)

    def test_first_ever_activation_is_limited_to_pinned_revision(self):
        self.assertEqual(mod.git_blob_hash(self.target), mod.INITIAL_GIT_BLOB)
        self.assertEqual(mod.promotion_plan(self.before_wishlist, self.target, self.target), "initial-wishlist-activation")
        self.assertEqual(mod.promotion_plan(self.before_binder, self.target, self.target), "initial-binder-and-wishlist-activation")
        modified = self.target + "\n// Future rule change"
        for active in [self.before_wishlist, self.before_binder]:
            with self.assertRaisesRegex(RuntimeError, "Refusing"):
                mod.promotion_plan(active, modified, modified)

    def test_never_accepts_unknown_remote_rules(self):
        for active in ["rules_version = '2';", "", self.target.replace("if false", "if true", 1)]:
            with self.assertRaisesRegex(RuntimeError, "Refusing"):
                mod.promotion_plan(active, self.target, self.target)


if __name__ == "__main__":
    unittest.main()
