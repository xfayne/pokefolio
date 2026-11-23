# Wishlist Cards (#14, catalog handoff #115)

Wishlist Cards follows the owner's 2026-11-23 compact list mock, using existing
Pokefolio list surfaces, typography and 52px square catalog thumbnails.
The Wishlist/Deals internal navigation already exists; this PR implements **Cards**.

## Interactions

- Custom order is authoritative; grip drag on touch/mouse or keyboard arrows,
  Home and End change the persisted priority order. Dragging is disabled under
  name/price sorting or when searching to avoid non-obvious reorder results.
- Holding a card for 550ms, right-clicking it, pressing F2 on its detail
  button, or pressing Enter on its grip opens an in-page modal with a 1-based
  position. A normal tap opens existing Card Details.
- Search filters, sort-by-name, condition-specific price sorting (unknown last),
  and 80-row progressive rendering keep the list manageable.
- Market price uses the existing TCGTracking exact-printing USD source. The
  condition picker defaults to LP, consistent with Catalog Details. Quotes
  are estimates and never replace unknown values with zero. Conversion follows
  the app's display-currency preference.
- In Catalog and Collection Card Details the Wishlist action toggles **Add**
  and **Remove** based on current owner membership. There is no automatic
  wish removal on purchases, sales, imports or Binder moves.

## Owner data and safety

The sole private document is `users/{uid}/wishlists/main` in the separate
Pokefolio staging project. Schema v1 stores ownerUid, revision, serialized
semicolon-separated catalog card IDs and a server timestamp. No purchase,
copy, collection root or Binder path is touched.

Reads validate ownership, schema and duplicate IDs. Writes are revision-checked
Firestore transactions. The UI renders changes optimistically and rolls back
failed writes. Firestore rules prevent foreign access, invalid IDs, revisions
that skip a step, listing or deletion. The current binder's `wish` pockets
remain independent reservations: this phase does not add/remove/reorder binder
placements, and does not attempt to migrate legacy Wishlist data.

`#/wishlist/cards?wishlist=sample` is explicit, synthetic and session-only,
for visual verification. No account writes occur from reordering the sample.

## Rollout

Security rules must be published **to pokefolio-staging only** before testing
signed-in Wishlist writes. Publishing a Git commit does not deploy Firestore
rules. Verify readback and the first add/reorder/reload cycle; never deploy
to or import from the legacy production Firebase project.

Issue #14 retains other promised Wishlist experience items (spotlight, larger
scale/performance acceptance) and #115 retains its Deals action handoff.
