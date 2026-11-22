import { cloneJson, digest } from './legacy-backup.mjs';

// Pure simulation contract only. A live adapter must enforce these comparisons
// atomically on the server; this module supplies no Firestore write capability.
function verify(preview) {
  const { previewDigest, ...body } = preview;
  if (digest(body) !== previewDigest || preview.status !== 'PASS') throw Error('INVALID_OR_BLOCKED_PREVIEW');
}
export function stageImport(state, preview, approval) {
  verify(preview);
  if (approval?.previewDigest !== preview.previewDigest || approval?.backupDigest !== preview.backupDigest || approval?.ownerUid !== preview.source.ownerUid || approval?.destination !== 'synthetic-staging' || approval?.independentBackupVerified !== true) throw Error('APPROVAL_MISMATCH');
  if (state.ownerUid !== approval.ownerUid) throw Error('OWNER_MISMATCH');
  const id = 'import-' + preview.previewDigest;
  const next = cloneJson(state);
  if (Object.hasOwn(next.datasets, id)) {
    if (digest(next.datasets[id].preview) !== digest(preview)) throw Error('TARGET_MISMATCH');
    return next;
  }
  if (next.active !== null) throw Error('EXISTING_ACTIVE_DATASET');
  next.datasets[id] = { preview: cloneJson(preview), revision: 1 };
  return next;
}
export function activateImport(state, id, expectedRevision) {
  if (state.revision !== expectedRevision) throw Error('POINTER_CONFLICT');
  const data = state.datasets[id];
  if (!data || data.revision !== 1) throw Error('DATASET_CONFLICT');
  verify(data.preview);
  if (data.preview.source.ownerUid !== state.ownerUid) throw Error('OWNER_MISMATCH');
  const next = cloneJson(state);
  if (next.active === id) return next;
  if (next.active !== null) throw Error('EXISTING_ACTIVE_DATASET');
  next.active = id; next.revision++;
  return next;
}
export function rollbackImport(state, id, expectedRevision) {
  if (state.revision !== expectedRevision || state.active !== id || state.datasets[id]?.revision !== 1) throw Error('ROLLBACK_CONFLICT');
  verify(state.datasets[id].preview);
  const next = cloneJson(state);
  next.active = null; next.revision++;
  // Retain both dataset and backup evidence; never restore/overwrite source.
  return next;
}
