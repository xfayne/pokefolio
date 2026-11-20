# Issue #6 — Legacy import plan and synthetic preview

Status: Proposed for owner approval. No migration implementation or live writes.
Prepared 2026-11-20 from current main, the approved #5 domain proposal,
domain implementation guide and retained legacy cloud/card/shipment modules.
Related: #6; final real-data cutover remains #21.

## Scope and evidence policy

Build offline backup validation, a pure mapper and read-only comparison first.
Input is an explicitly supplied complete raw export, never the legacy UI's cleaned
state. Do not invoke clean, adoptProgress or normalizeOrders. Do not connect an
import tool to legacy production. Development uses synthetic fixtures.

Existing ownership booleans prove at most one copy per catalog ID. Never infer
duplicates from repeated binder tokens or multiple shipment references.
Conflicting ownership/possession/membership produces a blocking exception.
Unknown fields and invalid values remain intact in the archived source.

## Mapping contract

| Source | Proposed target and evidence |
| --- | --- |
| Truthy owned marker | One received, held opening copy; preserve original marker |
| pendingPurchase only | One pending, held opening copy; preserve wasWish/wishIndex/binderIndex |
| owned plus pending | Blocking conflict; no automatic precedence |
| Explicit independent duplicate-copy evidence | Separate stable copy IDs; never infer quantity from a boolean |
| purchasePrices.amount/currency | Exact evidenced card component only if valid; other charges unknown |
| Missing price/date | Explicit unknown; never zero or import date |
| conditions | Preserve original; map DMG to DAMAGED; unknown codes reported |
| firstEdition | Preserve explicit boolean; missing flag remains unknown |
| notes | Exact private text, with source pointer |
| ownedAddedAt / shipment createdAt | Ordering/provenance only, never purchase/payment date |
| Shipment purchaseDate | Valid civil date retained as acquisition evidence where association is unambiguous; not proof of payment |
| shipments/cardIds | Preserve parcel IDs and sequence; resolve copy memberships only when unambiguous |
| deliveredAt / seenEventIds / initialized | Preserve delivery and read baseline; no provider registration or refresh |
| binderOrder | Exact token-by-index preservation, including empty tokens and pending references |
| wish/wishOrder/removedWish | Preserve all values, sequence and tombstones independently |
| binderIncludeWish/binderExcluded | Preserve exactly; no inferred fulfillment or pruning |
| analyticsSnapshots | Archive original observations and coverage, separate from cash/accounting |
| Other root/settings/analysis/public data | Include in backup inventory; preserve separately without coercing into financial records |

A known card price does not prove shipping, taxes or fees were zero.
A parcel is not automatically a transaction: combined and split shipments exist.
The initial converter produces opening inventory and retained purchase evidence.
Historical transactions require a separately reviewed explicit evidence mapping;
no automatic reconstruction from price plus shipment date alone.

Opening records retain received/pending possession and known acquisition-date
evidence without creating cash movements. Monthly spending remains incomplete
where payment evidence is unavailable.

## Synthetic before/after preview

These examples are not the owner's data. Amounts are GBP.

| Before | After | Verification / exception |
| --- | --- | --- |
| Gengar owned, LP, price 20 GBP, no date | 1 received opening copy; card cost 2000 pence; date/other charges unknown | No purchase or cash movement |
| Childhood Pikachu owned, no price/date | 1 received opening copy, unknown cost/date | Not zero-cost and no invented month |
| Snorlax pending, price 30 GBP, parcel purchaseDate 2026-11-12 | 1 pending opening copy, retained date and parcel link | Receipt later changes same copy, never adds one |
| Same catalog ID in two active parcels | Unresolved association | Blocks apply; does not create a second copy |
| Same ID both owned and pending | Unresolved possession | Blocks apply, retains both source values |
| Two separately evidenced physical copies | 2 distinct copy identities | A bare legacy ownership boolean is insufficient |
| Binder [Gengar, __binder_empty__:demo, pending Snorlax, wish Eevee] | Same four indexed tokens plus resolved reference sidecar | Exact token equality; no compaction |
| Wishlist [Eevee, Mew, Dragonite] | Same ordered organization data | No purchase-driven removal |
| Price 0 GBP explicitly stored | Exact zero card component | Missing charges remain unknown |
| Unknown catalog token or malformed price | Preserved raw evidence, exception with source path | No silent deletion/default |

## Backup and read-only report

1. Snapshot all supplied root data plus the explicitly inventoried related settings,
   analyses and public projections. Record source project/owner, source revision,
   capture metadata and completeness manifest. A root-only export must be labeled
   partial; it cannot qualify as a complete real-data backup.
2. Store the unmodified export and manifest outside the destination dataset; preserve
   JSON value types and timestamp encodings. Reject unsupported encoding rather than
   serialize it lossily. Never put real exports in Git or CI.
3. Compute versioned content digests. Independently reopen the durable backup and
   compare its decoded value tree, manifest and digest with captured source. A digest
   without independent read-back is not backup verification.
4. Produce counts of received/pending/unresolved copies; native-currency amounts and
   known/unknown cost coverage; all parcel associations; exact indexed binder/Wishlist
   comparisons; and exceptions containing paths, raw evidence and reasons.
5. Validate schema and cross-record references and reconcile every mapped source
   item with one target or explicit exception. Known original amounts must round-trip
   exactly to supported minor units; reject negative, unsafe or ambiguous amounts.
6. Report PASS/BLOCKED and backup status. Preview remains available for incomplete
   input, but real apply is blocked until completeness and all invariants pass.

## Replay, staging apply and rollback contract

Migration identity combines owner, source identity/revision/content digest and
mapping version. Persist generated opaque target IDs in a versioned import manifest;
retries reuse that manifest. Replanning cannot overwrite an existing import.
Changed source, owner, mapping, manifest or target content halts with concrete diff.
A committed replay is a verified no-op, never a second import.

Proposed staging protocol: create an isolated, inactive versioned import dataset,
verify complete records against the approved preview, then publish a small active
dataset pointer atomically with a completion receipt. Partial data stays invisible.
This is a migration-only staging protocol, not permission to chunk financial
transaction commits. Before any live adapter is implemented, specify and test
owner auth, create-only writes, batch/rule budgets, concurrency and pointer CAS.
No rules deployment is implied by this plan.

Apply requires a separately recorded approval bound to exact backup/preview digests,
owner, mapping version and destination. A generic earlier approval cannot authorize
a changed dataset. Existing target data is a conflict, not a replacement opportunity.

Rollback deactivates the imported dataset only when its pointer/revision still
matches the expected import. Preserve imported records and original backup for
inspection. If later edits exist, halt for a reconciliation plan; never blindly
delete records or restore an old root over newer user data. No writes to the source.
Public sharing settings/links are not republished or enabled automatically; preserve
their semantics and expose any destination-link changes for later cutover approval.

## Focused delivery sequence

1. This mapping plan and before/after examples for product approval.
2. Offline export envelope, completeness manifest, independent backup verification.
3. Pure mapper, reference sidecars and read-only diff/exception report.
4. Versioned apply/replay/rollback contracts and synthetic repository tests.
5. Any live staging adapter requires verified authorization/atomicity and explicit
   destination approval. Real-data rehearsal/cutover remains separately approved.

Tests: no source mutation; duplicates with evidence; owned/pending conflicts;
multi-parcel ambiguity; missing prices/dates; explicit zero; rounding rejection;
DMG mapping; unknown catalog entries; exact holes/page boundaries/pending binder
slots; Wishlist tombstones/order; shipment read metadata; analytics preservation;
tampered/incomplete backup; retry no-op; changed source/target refusal; interrupted
inactive import; concurrent activation; rollback conflict.

No cosmetic mock, new screen, provider mutation, production migration or database
rules change is included in this proposal.
