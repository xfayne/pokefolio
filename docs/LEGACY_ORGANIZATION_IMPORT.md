# Mapping legacy Binder and Wishlist data

`materializeLegacyOrganization(report, copies, ownerUid)` is a pure converter
for the **read-only mapping version 3** preview. It reuses exactly the same
copy IDs as the validated financial import; it never creates ownership.

- `owned` and `pendingPurchase` Binder tokens both become a reference to
  the one corresponding physical copy (receipt does not change its placement).
- Active `wish` tokens become Wishlist pockets.
- Preserve original hole identities and physical locations. The legacy input order is mirrored horizontally within each three-pocket row, so normalize each row once at the legacy-to-Pokefolio boundary (left/right swap; center fixed). A partial final row materializes missing positions without compacting; reject overflow. Raw source and preview remain unchanged.
- `wishOrder` remains the exact list and order; no automatic sort or dedupe.
- An inconsistent reference or a missing Wishlist item **blocks** import.
- `binderExcluded`, removed Wishlist tombstones and analytics remain only
  in the immutable source archive; they have no equivalent active layout
  semantics. Sharing/public publication is never performed by this converter. Already-normalized Pokefolio staging-to-production transfers must copy pocket order as-is, never reapply this conversion.

This returns owner-scoped Binder and Wishlist records at revision 1 for a
**future create-only staging adapter**. It does not write to Firestore,
touch legacy data, or replace existing staging documents. The actual live
destination must check for existing documents before any activation.
