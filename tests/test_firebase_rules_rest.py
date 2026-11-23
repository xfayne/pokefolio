import importlib.util
from pathlib import Path
import unittest

source_path = Path(__file__).resolve().parent.parent / "scripts" / "firebase_rules_rest.py"
spec = importlib.util.spec_from_file_location("firebase_rules_rest", source_path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class WishlistRulesPreflightTests(unittest.TestCase):
    def setUp(self):
        self.target = (Path(__file__).parent.parent / "firebase" / "firestore.private.rules").read_text()

    def test_expected_rule_is_insert_only(self):
        parent = mod.without_wishlist(self.target)
        self.assertIn("match /binders/{id}", parent)
        self.assertIn("match /preferences/{id}", parent)
        self.assertNotIn("match /wishlists/{id}", parent)
        self.assertEqual(mod.ensure_only_wishlist_added(parent, self.target), "update")
        self.assertEqual(mod.ensure_only_wishlist_added(self.target, self.target), "already")

    def test_pre_binder_release_is_safe_and_any_other_diff_fails(self):
        # The latest staging console publication predates the Binder rules,
        # so the reviewed delta can contain exactly Binder plus Wishlist.
        pre_binder = mod.without_binder_and_wishlist(self.target)
        self.assertNotIn("match /binders/{id}", pre_binder)
        self.assertNotIn("match /wishlists/{id}", pre_binder)
        self.assertIn("match /preferences/{id}", pre_binder)
        self.assertEqual(mod.ensure_only_wishlist_added(pre_binder, self.target), "update")
        with self.assertRaisesRegex(RuntimeError, "Refusing"):
            mod.ensure_only_wishlist_added(
                pre_binder.replace("allow read, write: if false;", "allow read, write: if true;"),
                self.target,
            )

    def test_rejects_other_policy_edits(self):
        parent = mod.without_wishlist(self.target)
        with self.assertRaisesRegex(RuntimeError, "Refusing"):
            mod.ensure_only_wishlist_added(
                parent.replace("allow delete: if false;", "allow delete: if true;", 1),
                self.target,
            )
        with self.assertRaisesRegex(RuntimeError, "Refusing"):
            mod.ensure_only_wishlist_added(parent + " ", self.target + "\n// stray")

    def test_refuses_unexpected_wishlist_block(self):
        with self.assertRaisesRegex(RuntimeError, "markers"):
            mod.without_wishlist(self.target.replace(mod.START, ""))
        with self.assertRaisesRegex(RuntimeError, "markers"):
            mod.without_wishlist(self.target + mod.START)

    def test_target_pinned_to_staging(self):
        self.assertEqual(mod.PROJECT, "pokefolio-staging")
        self.assertIn("ac2dcae853f11738", mod.RULES_URL)
        self.assertTrue(mod.RELEASE.endswith("releases/cloud.firestore"))

if __name__ == "__main__":
    unittest.main()
