# Purchase persistence (#8)

The owner account flow is active on isolated staging following PR #85. The staging
policy was published and checked on 2026-11-21. No legacy or production data was
changed, and production frontend cutover remains #21.

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

## Staging acceptance — 2026-11-21

All five PR and main workflows passed for #85; staging Pages deployed source
`5cd2e12d6ebc799387a1160b78a1ab1bfaacb283` in run `44875772495`.
The active staging policy matches the repository (9360 trimmed characters,
FNV32 `7b0e8f43`), published at 06:24 UTC. The previous revision remains available
in the Firebase console for rollback. Rules Playground denied anonymous/foreign
reads and allowed the simulated matching owner; emulator tests cover writes.

Google sign-in succeeded in the actual staging app. One explicitly labelled
`SYNTHETIC Issue 8 acceptance` purchase contains two independently selected Gengar
copies, Unlimited LP at GBP 1 and First Edition NM at GBP 2. Shipping GBP 0.01
reconciled to a GBP 3.01 purchase and survived page reload. Editing shipping to
GBP 0.03 produced GBP 3.03, retained both copy prices/editions and survived another
reload. The source order reference and synthetic tracking/carrier were preserved;
no provider registration occurred. Payment remains unknown, with no invented cash.

History displayed one purchase; both copies appeared in Cards. Copy and Dashboard
links returned to that exact purchase. Eight immutable audit documents were observed
in the console. The purchase audit records original revision 1 / GBP 3.01 and revision
2 / GBP 3.03, matching owner/actor and a server committedAt timestamp. The parent
user document remains nonexistent; no progress/Binder/Wishlist root was created or
rewritten. Synthetic acceptance records are retained, never deleted automatically.

A follow-up freezes edit baselines across query refreshes. Transaction and copy
regressions assert that stale drafts still submit their opening revision, allowing
the atomic adapter to reject concurrent changes. Tracking references alone do not
claim in-transit status; live shipment evidence remains #11.

## Owner UI refinements

Purchase editing is opened from the header ellipsis menu; no standalone edit
button consumes content space. The animated menu supports keyboard focus, Escape
and outside dismissal. Signed-out screens direct users to Settings sign-in.

Collection rows load the same exact-condition/edition public quotes as Card Details.
Duplicate printings share one query, and provider set/cards/SKU responses are cached
across printings. Rows show quotes for pending copies as well; financial received-
holdings aggregates are unchanged. Partial row coverage is explicit. Failed/missing
quotes remain unavailable, with retry. No FX conversion or account data is sent to
the price provider. Account IDs use purchase/copy prefixes; demo IDs stay in sample
contexts (the earlier explicitly synthetic live acceptance record remains readable).
