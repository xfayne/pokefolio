# Issue #5 — Transaction and inventory domain proposal

Status: **Approved by the owner on 2026-11-20; domain foundation implemented.**

Prepared 2026-11-20 against main `05c0c6083c7e903f9e7531c82da05e3077c1c0fe`.
The owner approved the policies in section 10, including the simpler initial rule
that only held, received copies can be sold. This document is not a deployed rules
change or migration authorization. Examples are synthetic. Delivery receipts are tracked in Issue #5.

## 1. Design and scope

Separate catalog identity, physical copies, financial transactions and organization.
Use ordinary typed records with explicit transaction links and append-only revision
history. Do not add a general event-sourcing framework, accounting library or queue.

The current React `services/contracts.ts` contains catalog/quote contracts only;
`services/firebase.ts` initializes isolated services but performs no data writes.
Retained `js/collection-state.js` stores ownership, conditions and prices by catalog
ID, which cannot represent independently purchased duplicate copies. Its root
progress document is reference input, not the new inventory persistence design.

| Record | Identity and responsibility |
| --- | --- |
| Catalog reference | Existing catalog ID plus edition/language/finish identity; no ownership or purchase data |
| CardCopy | Stable opaque ID for one physical card, including an unidentified card in a counted lot |
| Transaction | Stable purchase/sale ID; source, dates, original currency and actual totals |
| TransactionLine | Stable line ID; quantity, variant and price mode; each unit maps to one distinct copy |
| Lot | Stable grouping ID linked to a total-priced purchase and its copy lines; never an additional cash expense |
| CashMovement | Actual paid/received amount and date, including subsequent refunds/expenses; distinct from profit |
| Revision | Immutable previous/replacement values, reason, actor and recorded timestamp for an edit/reversal |
| Shipment / membership | Parcel metadata and ordered links to specific copies/transactions; no ownership creation |
| Opening inventory / adjustment | Evidenced pre-existing inventory, gifts or explicit corrections without invented purchases |

Identifiers never depend on condition, price, catalog ID or list position. Identifying
an unknown lot card later updates its catalog reference without changing its copy ID.
Transaction source supports manual/eBay/other, optional listing URL/item reference,
seller and notes. An expired listing or missing tracking number never blocks entry.

## 2. Proposed typed boundaries

These abbreviated TypeScript sketches describe approved contracts, not runtime
code. Every persisted domain record has `schemaVersion: 1`, its stable ID, revision
number and server-recorded timestamps. Schema version is local to these new records,
unrelated to existing public-binder schema version 2.

```ts
type Currency = 'ILS' | 'USD' | 'EUR' | 'GBP';
type Money = { currency: Currency; minor: number }; // safe integer, never float
type Evidence<T> =
  | { status: 'known'; value: T; source: 'user' | 'legacy' | 'provider' }
  | { status: 'unknown'; reason: string };
type Cost =
  | { status: 'exact'; value: Money; evidenceRef: string }
  | { status: 'estimated'; value: Money; method: string }
  | { status: 'unallocated'; lotId: string }
  | { status: 'unknown'; reason: string };
type CatalogRef =
  | { kind: 'identified'; cardId: string;
      edition: 'unlimited' | 'first-edition' | 'unknown';
      language: Evidence<string>; finish: Evidence<string> }
  | { kind: 'unidentified'; description: string };
type Acquisition =
  | { kind: 'purchase'; transactionId: string; lineId: string }
  | { kind: 'opening-inventory'; recordId: string }
  | { kind: 'gift' | 'adjustment'; recordId: string };
type CardCopy = {
  id: string; catalog: CatalogRef;
  condition: Evidence<'NM' | 'LP' | 'MP' | 'HP' | 'DAMAGED'>;
  acquisition: Acquisition; acquiredOn: Evidence<string>;
  possession: 'pending' | 'received' | 'unknown';
  disposition: 'held' | 'sold' | 'returned' | 'gifted' | 'lost';
  cardCost: Cost; shippingCost: Cost; taxCost: Cost; feeCost: Cost;
  dispositionRecordId: string | null; notes: string;
};
type LinePricing =
  | { mode: 'per-copy'; unitPrice: Money }
  | { mode: 'lot-total'; lotId: string };
type PurchaseLine = {
  id: string; transactionId: string; ordinal: number;
  quantity: number; catalog: CatalogRef; pricing: LinePricing;
};
type FxEvidence = {
  from: Currency; to: Currency; rateDecimal: string;
  effectiveOn: string; observedAt: string; source: string;
  quality: 'actual' | 'historical-reference';
};
```

Copy records store acquisition line and unit ordinal; do not put an unbounded copy-ID
array in a transaction/line. Quantity is a positive integer, and the committed copies
for each line must match it. Different unit prices use separate lines; equal-price
units can share a line and still have different conditions. Money is nonnegative
within each component; direction is explicit on a cash movement. All arithmetic must
remain within safe integers and supported currency precision (two decimals here).

Purchase headers contain `pricingMode`, `transactionOn`, currency, source,
card subtotal, shipping/tax/fee components, payable total and settlement status.
Unknown optional charges are evidence-tagged, not silently converted to zero.
Ordinary purchase confirmation requires exact per-copy card prices and a reconciled
payable total; absent charges must be explicitly confirmed as none or flagged unknown.
For an evidenced all-in total with unknown component breakdown, preserve the total,
mark the breakdown incomplete and leave affected costs unknown. Do not invent a split.

Cash movements reference the transaction and, where applicable, a revision/refund.
They store direction, purpose, Money, evidence-tagged effective date, recordedAt and
an idempotency key. A normal paid purchase creates its initial cash movement exactly
once. Transaction date and actual payment date are separate; the form may reuse an
explicitly confirmed purchase date for payment, never silently infer it from entry time.

## 3. Allocation and reconciliation

1. Expand line quantities into stable `(line.ordinal, unitOrdinal)` order.
2. For known purchase shipping `S` in minor units and `N` physical copies,
   allocate `floor(S / N)` to each. Give one extra minor unit to the first `S % N`
   copies in that stable order. Persist the result and allocation version.
3. Include duplicates and counted unidentified copies in `N`. Reject zero-copy
   purchases. A lot with unknown total quantity cannot receive finalized per-copy
   shipping allocations until quantity is established; keep its paid total intact.
4. Card subtotal in per-copy mode equals the sum of unit prices multiplied by
   quantities. A lot subtotal remains at transaction/lot level unless the user
   explicitly supplies allocations. No automatic equal or market-weighted split.
5. An explicit estimated lot split must reconcile to the lot subtotal and retain
   its method/estimated flag. It cannot become an exact price through editing or FX.
6. Known taxes/fees may be attributed explicitly to copies. Proposed fallback for
   known transaction-wide purchase taxes/fees is the same equal-share algorithm,
   separately labeled; this fallback was approved with this proposal.
7. With a complete breakdown, subtotal + shipping + taxes + purchase fees equals
   payable total exactly. With incomplete costs, report the unallocated/unknown
   balance and do not claim complete per-copy basis.

Editing a finalized purchase creates a revision and recomputes allocations in stable
order. Do not silently reallocate a sold copy's historical basis: require a linked
basis correction and recompute affected reports with the correction visible.

## 4. Lifecycle, sales and organization

A committed purchase creates the copies once. Pending/received is possession;
held/sold/returned is disposition. Delivery only updates eligible pending copies
to received. Repeating a delivery event has no effect on quantities, cash or costs.
Unlinking a shipment never cancels a purchase or removes a copy.

A sale references explicitly selected held, received copies of the same owner.
Selling pending/unknown-possession copies is blocked in the initial implementation.
Concurrent sales must reserve/check the same copy revision atomically so only one
succeeds. Sold copies remain in history with acquisition and sale links; they are
excluded from current holdings. Sale reversal restores the same eligible copy,
never creates a replacement ID, and is blocked if later dependent activity conflicts.

Sale receipts distinguish card proceeds and buyer-paid shipping from selling fees,
seller-paid shipping and taxes borne by the seller. Net proceeds is actual receipts
minus those selling expenses. Realized P/L is net proceeds minus the exact sold
copy basis; unknown basis gives unknown profit, estimated basis gives estimated profit.
Multi-copy sale allocations must reconcile, with exact per-copy sale amounts entered
or an explicitly labeled estimated/unallocated split. Do not invent per-copy profit
from a total-only sale. Transaction-level net cash remains known where evidenced.

Binder order, reserved empty pockets, page order and Wishlist priority are independent
records. No purchase, sale, delivery, refund or condition edit normalizes these lists.
Binder pockets may reference a specific copy, a catalog wish or an explicit empty
pocket. If the referenced copy is sold, retain its slot/reference and let the later
approved Binder workflow resolve it; never compact pages or substitute another copy.
Wishlist removal/fulfillment must be an explicit separate intent, not an ownership
side effect. Wishlist and Binder UX remain the responsibility of #7/#13/#14.

## 5. Money, dates, corrections and missing history

- One original currency per transaction. A charge paid in another currency is a
  linked cash movement with its own currency and evidenced FX, not added numerically.
- Preserve original money forever. Historical basis conversion uses recorded actual
  FX or a labeled historical reference rate, never today's display rate. Missing
  historical FX gives unavailable converted basis/profit; native amounts remain valid.
- Today's display currency/rate is presentation metadata and never rewrites history.
  Historical-rate estimates remain distinguishable from actual settlement conversions.
- Store civil effective dates as `YYYY-MM-DD`, separately from UTC recorded timestamps.
  Calendar-month grouping uses the recorded civil date, without browser timezone shifts.
- Monthly purchase spending uses dated purchase cash outflows; purchase refunds are
  negative spending in the refund's actual month. Sales are separate inflows. Net
  cash flow is all relevant received cash minus paid cash, and is never profit.
- A refund has its own cash movement and explicit scope (shipping, item or other).
  A shipping refund reduces remaining shipping basis with the original equal-share
  rule. Item refunds target specified copies; ambiguous lot refunds stay unallocated.
  Refunds cannot drive basis negative; excess/ambiguous amounts require classification.
- Returning a card is a separate inventory transition: refund alone does not imply
  the card left the collection. A partial refund can leave the same copy held.
- Correcting an incorrectly entered amount/date updates its effective record through
  a revision, not a fabricated refund. An actual later refund is a new movement.
- Gifts create copies and a gift acquisition record without purchase spending.
  Proposed recipient basis is unknown unless independently evidenced; do not assume
  market value or the giver's spend. Disposal by gift/loss is not a sale.
- Inventory corrections require a reason and audit record. Existing childhood cards
  enter as opening inventory, never purchases on import/first-seen/addedAt dates.
- Unknown charge, unknown cost, unallocated amount, estimated amount and exact zero
  remain different states. Reports expose missing coverage; no fabricated tax advice
  or statutory tax-basis treatment is implied by portfolio cost calculations.

## 6. Synthetic examples and expected outcomes

All amounts below are GBP; persisted amounts use integer pence.

| Scenario | Recorded result |
| --- | --- |
| Two Gengar copies at £20 each plus one Snorlax at £30; shipping £1 | Card subtotal £70; total £71; shipping £0.34 / £0.33 / £0.33 in stable unit order; basis £20.34 / £20.33 / £30.33 |
| Same copies, shipping £0.01 | Shares £0.01 / £0 / £0; no penny lost or duplicated |
| Three-copy lot subtotal £90 plus £6 shipping | Total £96; each shipping component £2 exact; each card component unallocated; no claim of £32 exact copy basis |
| Lot subtotal £90 explicitly estimated £50 / £25 / £15 | Components reconcile; plus £2 shipping each gives estimated bases £52 / £27 / £17 |
| Sell the first £20.34 Gengar for £30; buyer shipping £3, fees £2, seller postage £4 | Net proceeds £27; realized P/L £6.66; the other Gengar is unchanged |
| Same sale, acquisition cost unknown | Net proceeds £27 known; realized P/L unknown |
| Purchase above in November, £1 shipping refund received in December | November purchase spending £71; December purchase spending −£1; net purchase spend £70; bases become £20 / £20 / £30 with correction history |
| Mark parcel delivered twice | Three original copy IDs; one possession change per eligible copy; no new cash or cost |
| Import a childhood card without price/date | One opening copy; cost/date unknown; no purchase movement or invented month |
| Double-submit purchase or concurrent sale of one copy | Same purchase result by idempotency key; only one competing sale commits |

Illustrative record fragments (shared metadata omitted):

```json
{
  "purchase": {
    "id": "purchase-example-1", "pricingMode": "per-copy",
    "transactionOn": "2026-11-20", "currency": "GBP",
    "cardSubtotalMinor": 7000, "shippingMinor": 100,
    "taxMinor": 0, "feeMinor": 0, "payableMinor": 7100
  },
  "line": {
    "id": "line-example-1", "transactionId": "purchase-example-1",
    "ordinal": 0, "quantity": 2,
    "pricing": { "mode": "per-copy", "unitPrice": { "currency": "GBP", "minor": 2000 } }
  },
  "copyCostFragment": {
    "id": "copy-example-1", "lineId": "line-example-1", "unitOrdinal": 0,
    "cardCost": { "status": "exact", "value": { "currency": "GBP", "minor": 2000 }, "evidenceRef": "purchase-example-1" },
    "shippingCost": { "status": "exact", "value": { "currency": "GBP", "minor": 34 }, "evidenceRef": "purchase-example-1" }
  },
  "payment": {
    "id": "payment-example-1", "transactionId": "purchase-example-1",
    "direction": "out", "purpose": "purchase",
    "money": { "currency": "GBP", "minor": 7100 },
    "effectiveOn": { "status": "known", "value": "2026-11-20", "source": "user" },
    "idempotencyKey": "purchase-example-1-initial-payment"
  }
}
```

## 7. Proposed persistence and access boundary

Use separate owner-scoped collections under `users/{uid}`, with a portfolio schema
metadata document rather than rewriting the retained `progress` root. Proposed paths:
`transactions/{id}`, `transactions/{id}/lines/{lineId}`, `copies/{copyId}`,
`lots/{lotId}`, `cashMovements/{id}`, `acquisitions/{id}`,
`shipments/{id}/memberships/{copyId}`, `revisions/{id}` and a schema metadata document.
Shipment membership contains stable order and transaction/copy references; queries
support one combined parcel for several transactions and split parcels per purchase.

Bound individual record sizes and strings; no growing history, copy lists or photos
inside a portfolio document. Binder pages/Wishlist ordering will use separate bounded
organization records in #6/#7 without changing their ordered meaning or old snapshots.

Persistence interfaces accept owner context, expected revision and idempotency key;
no direct UI writes. A purchase/sale commit atomically validates header, affected
lines/copies and cash movement. Before implementing persistence, select a bounded
atomic write limit based on verified Firestore SDK/rules constraints; reject larger
commits safely and report the limit. Do not silently chunk financial commits. If real
lot sizes require staged commits, propose a separate reviewed commit protocol first.

Owner-only rules must reject unauthenticated/cross-user reads and writes, unexpected
fields, invalid amounts, changed identity/owner, invalid transitions and unsupported
schema versions. Referential/reconciliation checks need transactional validation and
rules tests, not TypeScript alone. New paths currently fall under deny-all; no rule
deployment is authorized here. Private financial records never enter public binder
projections. Keep the existing public reader/opt-in policy until separately adapted.

Planned queries: transactions by effective date and type; cash movements by effective
date/purpose; copies by disposition/possession, catalog identity or acquisition; parcel
memberships by copy. Paginate with stable ID tie-breakers, and define needed indexes
alongside the persistence implementation. Historical market observations and coverage
remain separate immutable observations for #19, not fabricated transaction prices.

## 8. Legacy mapping for the later #6 dry-run

Read raw verified backup input. Do not call legacy `adoptProgress`, `clean` or
`normalizeOrders`: they deduplicate/filter arrays and can change pending/Wishlist
state. Preserve raw source and report ambiguities instead of silently repairing them.

| Legacy evidence | Proposed mapping / safeguard |
| --- | --- |
| `owned[cardId]` | One received opening copy per evidenced card; duplicate counts cannot be inferred from a boolean |
| `pendingPurchase[cardId]` | One pending opening copy; preserve `wasWish`, `wishIndex`, `binderIndex` as provenance, not automatic order commands |
| Both owned and pending / several parcels referencing one catalog ID | Report ambiguity; never manufacture additional copies or silently merge conflicting evidence |
| `purchasePrices[id].amount/currency` | Evidence-backed opening card-cost component; shipping/tax/fee coverage unknown unless separately evidenced; never assume a new paid transaction |
| `conditions`, `firstEdition`, `notes` | Copy metadata with legacy provenance; missing condition/edition stays unknown; map a legacy DMG condition explicitly if encountered |
| Shipment `purchaseDate` | Preserve explicit date with provenance; conflicting dates are unresolved, not latest-date guesses; a date alone does not prove a full purchase payment |
| `ownedAddedAt` / parcel `createdAt` | Preserve for ordering/audit only; never treat as purchase dates |
| `shipments`, `cardIds`, `seenEventIds`, `deliveredAt` | Preserve IDs, order, notes, unread metadata and delivery evidence; map links to resolved copies, report unresolved associations |
| `binderOrder` including `__binder_empty__:*` | Preserve every index/token and 3×3 grouping; map owned/pending reference to resolved copy without sorting, appending, filtering or compacting |
| `wish`, `wishOrder`, `removedWish`, binder flags/exclusions | Preserve exact values/order separately from inventory; unresolved binder references retain their raw token |
| `analyticsSnapshots` | Preserve source observations and their original coverage/provenance; never use them to invent acquisition costs, dates or cash flows |

Reconstruct a historical purchase only with sufficient explicit evidence for its
identity, membership, amounts and dates; otherwise retain opening inventory and
partial evidence. Real-data apply is a separate approved #6/#21 process: independent
backup verification, read-only diff, deterministic import IDs, retry safety, count/
cost/order checks, mismatch halt and tested rollback. This proposal performs no import.

## 9. Delivery after owner approval

1. Focused PR: domain types, evidence/identity contracts and synthetic fixtures.
2. Focused PR: boundary validation, integer allocation and reconciliation functions.
3. Focused PR: lifecycle commands and owner-scoped persistence contracts, with fake
   repositories. Actual adapters/rules are introduced with the dependent workflows,
   after atomicity/security design is verified; no dummy live persistence is needed.

Meaningful tests cover duplicate identity, quantity expansion, zero/one/remainder
shipping, lots/unallocated costs, invalid money and dates, refunds and basis changes,
sale eligibility/reversal, idempotency/concurrent edits, missing FX/history, and exact
preservation of Binder/Wishlist fixtures. Run existing required CI for each PR;
screen E2E additions belong to actual screen changes, not this document.

## 10. Owner approval — 2026-11-20

Existing approved requirements are retained: per-copy ordinary costs, equal shipping,
explicit unknown lot costs, no fabricated history and independent organization state.
The owner approved the following policies before schema implementation:

- Transaction-linked records with revision history, without full event sourcing.
- Equal-share fallback for known transaction-wide purchase taxes/fees; explicit
  attribution overrides it and unknown amounts remain unknown.
- Refund cash in the actual refund month, with separate transparent basis adjustment;
  purchase spending and net cash flow are distinct from profit.
- Gifts/opening inventory do not invent purchase spending; recipient gift basis is
  unknown unless evidenced. Initial sales require held, received copies.
- Preserve original currency; historical FX must be evidenced/labeled, while current
  display FX never becomes historical execution data.

Approval of this document permits the scoped implementation above, not real-data
migration, legacy production writes, frontend production cutover or a new screen design.
