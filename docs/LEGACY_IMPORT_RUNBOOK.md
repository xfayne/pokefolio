# Offline legacy import runbook (#6)

This is an offline development/rehearsal pipeline, not a live Firestore migration.
No command here connects to Vintage Binder, writes its data, registers tracking
numbers or publishes public links. Real-data capture, destination authentication,
Firestore rules/atomic limits and production cutover remain release prerequisites.

## Input and backup

Supply an unmodified JSON export containing the private root progress plus an
explicit inventory of related settings, analyses and public projections.
createBackup({ source, documents, inventory }) requires source projectId, ownerUid,
revision and capture time. Each inventory entry has a path and one of present,
absent or not-exported; present entries must have a matching document payload.
Do not call old clean/adoptProgress/normalizers or use an SDK object that JSON would
silently coerce. Firestore timestamps need an explicit reversible JSON encoding.

saveAndVerifyBackup(path, backup) creates exclusively and independently reopens and
compares every value and digest. Keep this file outside the destination directory.
Do not put real exports in source control. A complete release source adapter must
establish the required inventory by authenticated enumeration; the offline helper
cannot prove a caller supplied every live document. Missing coverage blocks apply
when it appears in the required scope.

## Preview and schema validation

1. previewLegacy(backup, { rootPath, catalogIds, requiredPaths }) returns mapping
   version 2, counts, native amounts, indexed binder references and exceptions.
   Version 1 purchase drafts are not silently upgraded.
2. PASS means the supplied scope maps without exceptions; it is not real-source
   completeness or authorization proof. Review unresolved membership, currencies,
   invalid amounts/dates and unsupported catalog IDs before applying.
3. materializeLegacyImport(report, ownerUid, recordedAt) validates domain records
   and references. The supplied timestamp is a planning timestamp. Live persistence
   must use its own authoritative server timestamp protocol.
4. A parcel with prices 20 and 30 in the same currency produces a purchase total 50,
   with both original prices and specific copy/line/parcel links. Missing individual
   prices give an unknown transaction total; mixed currencies block conversion.
   Unrecorded shipping adds no amount but stays explicitly uncovered. No purchase
   payment cash movement/date is fabricated. Cards without parcels remain opening
   inventory. Raw organization/provider/history state remains byte-value equivalent
   as JSON, including duplicate binder tokens, holes and pending positions.

## Isolated filesystem apply

prepareOfflineImport({ backupPath, expectedBackup, scope, payload, ownerUid })
reopens the independent backup, recomputes the preview and binds the approved
schema-validated payload into a content-addressed plan. expectedBackup is the
independent captured value, not a digest inferred from the same reopened file.
This storage layer relies on the caller to run materializeLegacyImport first.

applyOfflineImport receives that plan plus approval containing the exact planDigest,
ownerUid, absolute destination and environment 'offline-isolated'. It checks the
backup again, takes an exclusive migration lock, creates a separate dataset artifact,
reads it back, then atomically renames an active-pointer file. Existing source data
is never overwritten. An exact replay returns replayed. Source/owner/plan mismatch,
changed active revision, another active dataset, missing active artifact or tampering
halts. This is filesystem activation, not a Firestore atomicity/security test.

rollbackOfflineImport({ destination, ownerUid, planDigest, expectedRevision })
only deactivates the matching unchanged dataset. It retains the independent backup
and staged data. Editing/tampering or a changed pointer halts rollback rather than
overwriting newer work. A lock left by a process interruption must be inspected
manually; never delete a lock that may belong to a running import. Staged artifacts
without a published pointer stay inactive and can be independently verified/retried.
Direct editing of immutable dataset files is unsupported.

These helpers are trusted developer APIs, not a public upload endpoint. The
content-bound approval is a review receipt, not an authentication mechanism.
Never substitute this filesystem adapter for an authenticated live adapter.

## Verification

From the repository root:

    node --test tests/legacy-backup.test.mjs tests/legacy-preview.test.mjs tests/legacy-import-state.test.mjs tests/legacy-import-files.test.mjs

From frontend:

    npm run typecheck
    npm run lint
    npm test

The frontend integration test runs actual backup → mapper → domain validation →
isolated filesystem apply/replay → rollback with synthetic data and verifies the
source is unchanged. No browser E2E was added for tools without a product screen.
Existing required repository CI checks still run before merge.

## Real-data release gate

Before any real apply: independently verified complete backup; exact approved diff;
owner/destination authentication; versioned source and target comparison; verified
Firestore record limits/rules/write protocol; full source-vs-target reconciliation;
and rollback tested against the destination. Do not copy a live dataset until those
release prerequisites are fulfilled. Public link destinations/opt-in are separate
release actions; they are never enabled by an import as a side effect.
