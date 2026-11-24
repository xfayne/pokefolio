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

## Binder pocket picker and shared section navigation (2026-11-23)

- The empty-pocket picker searches eligible physical copies **and** cards currently
  on the owner's Wishlist. Selecting a Wishlist-only entry reserves a `wish`
  pocket, not a physical copy. When there is one eligible owned copy it is
  selected immediately, as before; cards with multiple physical copies and a
  Wishlist reservation offer an explicit choice.
- Existing Wishlist placements are excluded to maintain unique pocket identities.
  No Wishlist membership, order, physical copy, or transaction is changed when
  reserving a wish pocket. Sample binder uses only synthetic sample wishes.
- Collection/Wishlist/Transactions use the same sticky section-tabs component;
  the Cards/Wishlist sticky toolbars stack underneath it. Transaction form
  Purchase/Sale controls remain inside their existing fixed header.
- The two explanatory notes beneath Wishlist cards/count are omitted by design;
  Wishlist removal in Card Details uses a compact label with a full accessible name.

## Rollout

Security rules must be published **to pokefolio-staging only** before testing
signed-in Wishlist writes. Publishing a Git commit does not deploy Firestore
rules. Verify readback and the first add/reorder/reload cycle; never deploy
to or import from the legacy production Firebase project.

Issue #14 was closed on 2026-11-23 per owner approval. The Spotlight was
explicitly removed from scope, and the owner waived additional authenticated
staging Add/Remove/reorder/reload and measured hundreds-of-cards performance
tests. Existing unit, emulator authorization, and mobile E2E regression checks
passed, but the waived checks are not claimed as verified. New regressions should
be tracked as separate focused issues. #115 still owns the Deals action handoff.

## Optional purchase fulfillment (2026-11-24)

Settings → Auto-fulfill Wishlist is owner-scoped and defaults off when no preference exists. Only creation of a new ordinary purchase reads the preference; edits, receipt, sale, imports, and receipt replays never fulfill wishes. With the option on, purchased catalog IDs are removed from the current Wishlist without reordering the remaining entries, and matching wish pockets are replaced in place with the first new physical copy (pending receipt). Existing copy pockets, explicit gaps, page order and includeWish are preserved. Purchase, Wishlist, Binder and receipt writes commit in a single Firestore transaction; no partial commit or automatic replay on old purchases. Existing shared links remain explicit snapshots. No legacy or production writes, migrations, or changes to currency preferences.
