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

Lifecycle modules follow in a separate PR. Production persistence is deliberately not
implemented here: owner authorization, atomicity, reference checks, idempotency and
security rules must be enforced in the eventual adapter as well as domain commands.
Record validation alone does not authorize a write or prove cross-record integrity.

Tests use synthetic fixtures only. No domain function should read or normalize the
legacy `progress` map. Binder/Wishlist order stays outside financial command payloads.
