# Collection Binder (#13)

The owner approved the supplied 3×3 mock on 2026-11-22 with three corrections:
no redundant My Binder heading; card taps must not open Card Details; and the
book fills the space between section tabs and bottom navigation without document
or internal scrolling. Card artwork scales with both available width and height.

## Organization and gestures

The book keeps nine pockets per page, explicit unique empty-pocket tokens,
exact physical-copy pointers, pending overlays and Wishlist placeholders.
Touch hold (300ms) starts a drag; a quick horizontal gesture turns the page.
Mouse drag and page arrows are supported. While dragging, hold over a pager arrow
to turn a page before dropping. Taps never navigate to card details.
An accessible Options → Add / move card sheet provides explicit page/pocket
placement and removal without drag. Options also moves whole pages, preserving
partial-page trailing holes, toggles Wishlist artwork, and opens a read-only
viewer. That viewer shows paired interior pages in landscape at >=600px; first and last pages are always single, centered leaves. An unpaired interior page remains single rather than generating a phantom leaf. The same navigation applies to the shared reader. Section navigation
and the last page remain on this device; collection contents are never saved in
browser storage.

Pure transforms are compared against the retained legacy controller. Moving into
a reserved hole swaps it into the source location; other moves insert in order.
Removing a card only changes Binder layout, never inventory, cost, purchase,
shipment or Wishlist records. A missing/sold copy retains its original pointer
and slot, rendered unavailable; no sibling copy silently replaces it. New copies
are placed explicitly through Options. A Wishlist pocket reserves a catalog card
inside Binder; it does not create or reorder records in the future Wishlist UI
(#14). Existing Wishlist integration remains part of that issue.

## Persistence and sharing

`users/{uid}/binders/main` stores schemaVersion, ownerUid, revision, JSON-serialized
ordered pockets, includeWish and server updatedAt. Owner-only rules accept only
this document, restrict fields/size/revisions and deny listing/deletion. Writes
compare the full expected layout inside a Firestore transaction. Failed or stale
writes leave the displayed confirmed layout intact; no auto-overwrite or migration
occurs. The existing private progress root is never written by this feature.

Sharing reuses the existing schema-v2 public projection and atomic owner settings
opt-in. Only catalog IDs, pocket kinds and empty positions cross that boundary.
No copy IDs, prices, conditions, notes or transactions are published. A link is an
explicit snapshot: Create / update link republishes the current layout. Disabling
the link revokes future server reads. The standalone hash route is
`#/binder/share/{uuid}`. No private portfolio reader is mounted on that route.
Existing public-sharing rules remain unchanged. Production rules/data and legacy
production remain untouched. Staging activation requires publication of the exact
reviewed private policy; source changes alone do not activate a policy.

The opt-in `#/collection/binder?inventory=sample` has synthetic session-only data.
It never writes Firestore, publishes a link or calls providers.

## Verification

Unit checks cover legacy move parity, explicit/implicit holes, partial page moves,
duplicate identity rejection, owner validation and safe public projection.
Firestore emulator checks cover owner/foreign/anonymous clients, revisions,
unknown fields, oversize records, listing/deletion and unchanged legacy progress.
Mobile E2E covers hold-to-drag, no tap navigation, fixed viewport sizing, English/
Hebrew, 320px, remembered page, explicit placement and landscape reader. These are
Chromium checks; they do not claim physical iPhone verification.

## Owner refinement — 2026-11-22

The book now has no toolbar/pager/hint flow rows. Navigation arrows are translucent
and positioned at the book's vertical midpoint; its fraction is printed in the
lower frame and its overflow menu overlays the upper corner. Sharing lives in
that menu. Tapping an empty pocket opens the existing CatalogSearch with a locked
eligible-ID constraint. Pending copies are allowed; disposed, foreign and already
placed copies are excluded. One eligible copy is selected automatically; duplicates
require choosing condition/edition/receipt status using existing UI components.
Placement into that empty pocket never shifts other cards. Explicit moving and
Wishlist reservations also reuse CatalogSearch instead of a bespoke result list.

Dragging starts directly after a small movement on an occupied pocket. Swipes on
empty pockets/background turn pages; taps on cards do not navigate. A defect that
clamped trailing implicit targets to the final occupied index was removed: moving
the only card to pocket nine now materializes gaps and retains that exact target.
Keyboard empty-pocket activation and explicit move tools remain available.

## Empty page insertion — 2026-11-22

The approved overflow menu includes **Add empty page**. The action inserts a full
nine-pocket blank page immediately after the current page, navigates to that page
only after a confirmed save, and leaves every other page's cards and reserved
pockets in their original relative order. If the current last page is partial,
its trailing implicit pockets are first materialized as distinct empty slots.
All new gaps receive unique stable tokens; additions beyond the existing binder
capacity are disabled and rejected. Account saves use the existing owner-only,
revision-checked transaction; sample changes remain in memory. No inventory,
Wishlist, transaction or legacy production data is modified.

## Drag-to-remove and compact visual follow-up — 2026-11-22

Dragging an occupied Binder pocket beyond the physical book and releasing there
removes only its Binder placement. The original slot becomes a unique reserved
empty pocket; all other page positions and copies remain unchanged. The exact
physical copy becomes eligible in the Binder picker again, including when another
copy of the same catalog card is still placed. A release over an arrow/control
is not a removal, and cancelling a drag leaves the layout untouched.

During save, the screen displays the proposed pocket layout immediately, retaining
it until the owner-only, revision-checked write confirms the new revision. Failure
restores the last confirmed layout and displays the existing error message. No
optimistic Firestore write, inventory deletion, or Wishlist mutation is performed.

The options trigger has no painted background, and book spacing is tightened so
the raised navigation Poké Ball slightly overlaps the bottom Binder frame while
the card grid remains usable. No document scroll or horizontal overflow is added.
