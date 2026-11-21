# Sale transactions (#9)

Sales reuse the existing transaction, physical-copy and immutable-audit contracts.
No import, legacy data change, provider registration or production migration is involved.

## Financial and lifecycle rules

- Only explicitly selected, owner-held, received copies can be sold. Pending and
  unknown possession are ineligible. A sale never creates or deletes a copy.
- Enter a price for each selected copy. Buyer shipping is a receipt; fees, seller
  shipping and selling taxes are expenses. Net proceeds subtract all expenses.
- The existing source counterparty field (`source.seller`) stores the buyer for
  sale records; the sale form labels it Buyer. Original currencies are retained.
- New sale headers have immutable ordered `copyIds`. New sale lines snapshot the
  four acquisition-cost components in optional `basisCosts`. This preserves the
  basis of an old sale even after reversal and a subsequent acquisition correction.
  Optional fields keep existing records readable.
- Transaction P/L uses net proceeds minus the selected copies' total landed basis.
  Unknown/unallocated costs remain unavailable; estimates remain estimates.
  Different acquisition/sale currencies require historical FX evidence; without
  it P/L is unavailable. Current display FX never supplies missing historical FX.
- Buyer shipping and expenses split equally in stable selection order, with exact
  penny reconciliation. Multi-copy lines label nonzero splits as estimates;
  transaction totals remain exact when their inputs are exact.
- Edits preserve membership and acquisition snapshots. Copy revision updates also
  act as concurrency guards. Reversal preserves the sale and lines, restores the
  same copies, and records `reversedAt` plus immutable audits. Reversed sales have
  zero contribution to History monthly transaction totals and no active P/L.
- Up to nine copies fit the existing verified edit audit limit (19 updated
  documents plus matching audits). The picker states the limit explicitly.
- No lifecycle operation edits Binder pockets, empty pockets, page order, Wishlist
  ordering, acquisition references, historical purchase costs or shipment records.
  Receipt/delivery remains #11; no shortcut makes pending copies eligible.

## Verification and activation

Pure domain tests cover eligibility, costs/FX, estimated allocations, editing,
reversal, exact identities, retained basis and incomplete write-set rejection.
Adapter tests verify all-or-nothing writes, identical retries, competing sales,
stale corrections and reversal replay. Component tests exercise invalid forms,
submit locking, failure retention and currency undo. Mobile journeys cover the
picker, sale/edit/reverse, shared form sizing, empty accounts and Hebrew/RTL.

The Firestore adapter uses the existing owner-only portfolio envelopes, atomic
revision/audit policy and immutable receipt. No rules deployment is required.
Live acceptance must use synthetic staging records only. A saved acquisition is
pending until its independently evidenced receipt workflow is implemented in #11.
