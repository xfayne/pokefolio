# Purchase receipt and tracking

## Approved scope

Owner approved on 2026-11-21: at most one optional shipment per purchase,
containing all its copies. Keep existing purchase tracking/carrier inputs and
Purchase Details timeline. No split/combine, parcel editor, copy-linking picker,
new screen or migration. #10 is deferred independently.

Mark received is an icon action beside Edit in the existing header. It remains
visible and disabled once the copies are received. Tracking is optional and no
external event is required. The same acquired copy IDs change pending -> received;
financial fields and organization records are not rewritten. Actual receipt is
manual even when the provider says Delivered.

## Storage and concurrency

`receivePurchase` produces immutable delivery audits and expected-copy updates.
The adapter validates that receipt cannot change copy cost, disposition or
acquisition. Existing idempotent receipts and exact snapshot checks prevent stale
or competing commands from rewriting inventory. Large receipts use sequential
batches of at most 20 copy updates, the existing audit policy capacity. A failed
later batch leaves already received copies intact; after reload a retry processes
only pending copies. No duplicate inventory is created. Unknown possession requires
an explicit correction rather than silently changing imported evidence.

Shipment `tracking` is optional and backward compatible. It stores registration,
provider carrier/status/events and seen IDs in the existing private shipment
record with revision/audit checks. Edits that retain the number/carrier retain
tracking and notes; changing or clearing them resets tracking. Old deliveredOn
and all copy possession states survive purchase edits. Raw legacy histories and
organization snapshots remain in the offline import artifacts; #21 retains real
source capture, approval and release verification. No import runs here.

## Provider integration

The shell performs owner-scoped sync every two minutes while open. Registration
uses the existing authenticated `/api/shipments/register`; already registered is a
successful response. Tracking uses batches of at most 12 numbers. Human carrier
names are retained for display; only numeric codes are sent to the provider,
otherwise its automatic carrier detection applies. Shared numbers share a lookup,
not private metadata. Partial provider errors retain cached successful timelines;
retry is available in Purchase Details. Tracking errors do not block purchases,
manual receipt or sales.

Provider events never produce copy writes. Initial history is a read baseline;
later unseen IDs count on the Transactions navigation badge. Opening Purchase
Details acknowledges its displayed events through a separate audited update.
Read failures retain unread state. Cached events remain available on reload.

The existing Worker and policy do not need deployment. All IO uses the validated
isolated staging origin and authenticated owner; sample routes never register
tracking and sample receipt is session-only. No keys, quotas, legacy Firestore,
provider unregister operation, Binder or Wishlist writes are introduced.

## Verification

Focused tests cover manual receipt with/without tracking, costs/identity, replay,
stale snapshots, batch recovery, provider delivery vs manual receipt, initial/read
markers, tracking metadata retention/reset, carrier detection and provider batches.
The emulator checks twenty-copy audited receipt capacity. Mobile CI covers the
manual receive -> disabled -> History -> available-for-sale journey and compact
First Edition layout. CI/deployment receipts are tracked on Issue #11.
