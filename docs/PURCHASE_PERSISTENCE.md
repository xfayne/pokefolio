# Purchase persistence (#8)

This branch prepares the account workflow; live activation is pending authenticated
staging rules publication and live acceptance. Do not close #8 or merge on unit
results alone. No legacy or production data has been changed.

## Storage

The existing named Firebase app and exact staging runtime gate remain in effect.
Private records use the approved `users/{uid}` subcollections: transactions with
nested lines, copies, lots, shipments with nested memberships, revisions and
idempotency receipts. The retained `users/{uid}.progress` document is untouched.
An envelope holds the validated domain `record`, matching `auditId` for updates,
and an authoritative Firestore `committedAt` server timestamp. Domain timestamps
retain the submitted command's timing; they are not authoritative server time.

A transaction reads all candidate documents and its receipt before writing. Every
creation checks nonexistence; every edit checks the complete expected snapshot.
A matching receipt replays without writes; a different payload with the same key
fails. Retries retain the prepared command. No partial save or destructive retry
is attempted. Payloads reserve capacity for a receipt, are limited to 450 writes
and 700 KB, and audit-checked edits are limited to 20 updated records by the
Firestore rule document-access budget. Oversized commands fail before writing.

New purchases reconcile their complete physical-copy plans. Money stays in the
original currency with integer-cent shipping allocation and distinct card/landed
costs. Purchases start pending with unknown settlement; no payment is invented.
Tracking details only link private records; provider registration remains #11.

## UI

Settings supplies Google sign-in/out. Account readers are UID-scoped and surface
loading/errors. Ordinary account routes never consume sample records. Transient
purchase drafts are keyed by owner; sample drafts are a separate key. History,
Cards, purchase details and recent Dashboard purchases consume the same account
query. Card-copy edits commit their revision and audit atomically.

First Edition is a checkbox: checked means first-edition, unchecked means
Unlimited. Newly selected cards have a known catalog finish and default Unlimited.
Historical unknown evidence remains readable without rewriting existing records.
Market prices match condition and edition exactly; an unavailable printing never
falls back to another edition. Listing URL and order reference are optional.
Saving is direct, without a review/confirmation screen.

Editing reuses the existing form and retains physical-copy IDs, possession and
notes. It supports prices, shipping, date, source, references, condition and edition.
Adding/removing copies, changing pricing mode, shipment modifications, paid/imported
purchases and disposed-copy correction need a separate lifecycle workflow and are
not silently performed. Every affected financial record has an immutable audit.

## Validation and activation

Run frontend unit/type/lint/build checks and mobile journeys. Run the demo-only
Firestore emulator security suite; cloud fallback is forbidden. Local Chromium
cannot start in this environment; required mobile journeys must pass in CI.

Before merge/activation, publish only `firebase/firestore.private.rules` to
`pokefolio-staging`, verify owner/foreign-user access and a synthetic complete
create -> reload -> edit -> reload journey. Compare receipts, audits, original
costs and shipping sums. Verify no sample/private-root mixing. Never run this
against Vintage Binder or Production. Keep the prior rules for rollback; do not
delete test or existing account records as part of activation.
