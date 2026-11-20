# Portfolio domain (#5)

The owner approved [the model](../../../docs/DOMAIN_MODEL_PROPOSAL.md) on 2026-11-20.
`schema.ts` defines strict Zod boundaries and inferred TypeScript contracts for private
records. Costs distinguish exact, estimated, unallocated and unknown; absent data
must never become zero or a guessed purchase date. Money uses safe integer minor
units in the original currency. Catalog and physical-copy identity are independent.

These are plain domain DTOs. Timestamp strings are ISO UTC boundary values; a future
Firestore adapter must translate server timestamps without letting client clocks
become authoritative. Private record schema version 1 is independent of the existing
public-binder schema version 2. No existing Firestore path, rules or UI is changed.

`money.ts` provides integer allocations, explicit cost coverage, net sale proceeds,
profit primitives and historical-only FX conversion. `purchase.ts` constructs pure
purchase plans with per-copy identities, equal shipping, explicit lot allocations and
reconciled initial payments. Its 10,000-copy in-memory planning bound is a resource
limit, not a Firestore atomic commit limit. Unknown lot quantities cannot be expanded
into finalized copies; record them as draft/partial evidence until counted.

`lifecycle.ts` plans copy receipt, eligible sales/reversals, audited changes and shipping
refund basis corrections. Delivery changes possession once; it never creates inventory.
Sale-line proceeds include buyer shipping and expenses include all selling costs;
known/estimated line allocations must reconcile to known transaction totals. Total-only
sales can retain unknown per-copy proceeds/profit. Refunds do not imply physical returns;
disposed-copy basis corrections need the later explicit workflow.

`cash.ts` groups actual dated movements by civil month and original currency. It keeps
undated movements separate. `saleReceiptsMinor` subtracts classified sale expenses and
refunds, not acquisition basis; it is not profit. Unclassified expenses affect net cash
and remain explicitly reported. Record either a net settlement or gross receipts plus
separately paid/withheld fees, never both representations of the same cash flow.

`persistence.ts` exposes strict owner-scoped commit DTOs and an adapter interface.
Commits require matching immutable audits for updates and reserve capacity for an
idempotency receipt. Fake-store tests demonstrate replay/conflict expectations;
they are not proof of live Firestore auth, reference integrity or atomicity.
Production persistence is deliberately not
implemented here: owner authorization, atomicity, reference checks, idempotency and
security rules must be enforced in the eventual adapter as well as domain commands.
Record validation alone does not authorize a write or prove cross-record integrity.

Future adapter paths follow the proposal: `users/{uid}/transactions/{id}/lines/{id}`
and `users/{uid}/shipments/{id}/memberships/{id}` for nested records; other private
collections live under `users/{uid}`. `recordKey` is a logical key for test doubles,
not a Firestore document path. Adapters must verify atomic limits/rule access budgets,
owner auth, referential integrity, lot count/identity, shipment membership, complete
purchase/sale write sets, settlement reconciliation, sale eligibility, dependent
reversals, expected versions and idempotent retries before any write is enabled.

Tests use synthetic fixtures only. No domain function should read or normalize the
legacy `progress` map. Binder/Wishlist order stays outside financial command payloads.

## Legacy import (#6)

`legacy-import.ts` materializes a verified offline report into schema-validated copies,
imported purchases/lines and shipments/memberships. A 20 + 30 recorded card-price
purchase has total 50, with the original two prices retained. Missing dates/prices
stay unknown; absent extra charges add no amount and retain unknown coverage.
Parcel-linked copies reference purchase lines, while unrelated existing cards remain
opening inventory. Original organization and provider metadata are preserved as raw
progress. The returned payload creates no invented payment cash movements.

`importedPurchaseSchema`/`importedPurchaseLineSchema` are accepted by private commit
and audit contracts, but ordinary new purchases remain strict. Materialization is
not an authenticated write adapter and planning timestamps are not server timestamps.

The mapper uses version 2. The [offline runbook](../../../docs/LEGACY_IMPORT_RUNBOOK.md)
describes backup verification, scope limitations and the isolated filesystem adapter.
