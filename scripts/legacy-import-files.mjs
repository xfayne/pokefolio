import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonical, cloneJson, digest, readVerifiedBackup } from './legacy-backup.mjs';
import { previewLegacy } from './legacy-preview.mjs';

// Offline filesystem storage only. No Firebase, provider or legacy source writes.
// Payload must come from materializeLegacyImport; approval binds its exact digest.
export async function prepareOfflineImport({ backupPath, expectedBackup, scope, payload, ownerUid }) {
  if (!expectedBackup) throw Error('INDEPENDENT_CAPTURE_REQUIRED');
  const backup = await readVerifiedBackup(backupPath, expectedBackup);
  if (backup.payload.source.ownerUid !== ownerUid) throw Error('OWNER_MISMATCH');
  const report = previewLegacy(backup, scope);
  if (report.status !== 'PASS') throw Error('BLOCKED_PREVIEW');
  // Archived analytics snapshots never enter the activated Pokefolio payload.
  const importableProgress = cloneJson(report.preservedProgress);
  delete importableProgress.analyticsSnapshots;
  if (canonical(payload.preservedProgress) !== canonical(importableProgress) || payload.copies.length !== report.copies.length || payload.transactions.length !== report.transactions.length) throw Error('PAYLOAD_COVERAGE_MISMATCH');
  const body = cloneJson({ formatVersion: 1, ownerUid, backupDigest: backup.sha256, previewDigest: report.previewDigest, mappingVersion: report.mappingVersion, scope, sourceArchive: backup.payload, payload });
  return { ...body, planDigest: digest(body) };
}

function validatePlan(plan) {
  const { planDigest, ...body } = plan;
  if (body.formatVersion !== 1 || !/^[a-f0-9]{64}$/.test(planDigest) || digest(body) !== planDigest) throw Error('PLAN_MISMATCH');
  if (digest(body.sourceArchive) !== body.backupDigest || body.sourceArchive.source.ownerUid !== body.ownerUid) throw Error('SOURCE_ARCHIVE_MISMATCH');
}
async function loadState(destination, ownerUid) {
  try {
    const state = JSON.parse(await readFile(join(destination, 'active.json'), 'utf8'));
    if (state.ownerUid !== ownerUid || !Number.isSafeInteger(state.revision) || state.revision < 0) throw Error('INVALID_TARGET_STATE');
    return state;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { ownerUid, active: null, revision: 0 };
  }
}
async function withLock(destination, action) {
  await mkdir(destination, { recursive: true });
  const path = join(destination, 'migration.lock');
  await writeFile(path, 'offline-import-lock', { flag: 'wx', mode: 0o600 });
  try { return await action(); } finally { await unlink(path); }
}
async function publish(destination, state) {
  const temp = join(destination, `active-${randomUUID()}.tmp`);
  await writeFile(temp, canonical(state), { flag: 'wx', mode: 0o600 });
  // Atomic rename publishes only a fully written pointer. A crash before rename
  // leaves the old state; a leftover exclusive lock halts automatic retries.
  await rename(temp, join(destination, 'active.json'));
}
function independentBackup(destination, backupPath) {
  const rel = relative(destination, resolve(backupPath));
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) throw Error('BACKUP_MUST_BE_OUTSIDE_DESTINATION');
}

export async function applyOfflineImport({ destination, backupPath, expectedBackup, plan, approval, expectedRevision }) {
  if (!expectedBackup) throw Error('INDEPENDENT_CAPTURE_REQUIRED');
  validatePlan(plan);
  const target = resolve(destination);
  independentBackup(target, backupPath);
  const backup = await readVerifiedBackup(backupPath, expectedBackup);
  if (backup.sha256 !== plan.backupDigest || backup.payload.source.ownerUid !== plan.ownerUid) throw Error('BACKUP_PLAN_MISMATCH');
  const currentPreview = previewLegacy(backup, plan.scope);
  if (currentPreview.status !== 'PASS' || currentPreview.previewDigest !== plan.previewDigest || currentPreview.mappingVersion !== plan.mappingVersion) throw Error('PREVIEW_CHANGED');
  if (approval?.planDigest !== plan.planDigest || approval?.ownerUid !== plan.ownerUid || approval?.destination !== target || approval?.environment !== 'offline-isolated') throw Error('APPROVAL_MISMATCH');
  return withLock(target, async () => {
    const state = await loadState(target, plan.ownerUid);
    if (state.active !== plan.planDigest && (state.revision !== expectedRevision || state.active !== null)) throw Error('TARGET_CONFLICT');
    const artifact = join(target, `dataset-${plan.planDigest}.json`);
    try {
      const existing = JSON.parse(await readFile(artifact, 'utf8'));
      if (canonical(existing) !== canonical(plan)) throw Error('TARGET_DATASET_MISMATCH');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (state.active === plan.planDigest) throw Error('ACTIVE_DATASET_MISSING');
      await writeFile(artifact, canonical(plan), { flag: 'wx', mode: 0o600 });
    }
    if (state.active === plan.planDigest) {
      if (state.revision !== expectedRevision + 1) throw Error('REPLAY_REVISION_CONFLICT');
      return { status: 'replayed', state };
    }
    if (state.revision !== expectedRevision || state.active !== null) throw Error('TARGET_CONFLICT');
    // Independently read back staged artifact before publishing the pointer.
    if (canonical(JSON.parse(await readFile(artifact, 'utf8'))) !== canonical(plan)) throw Error('STAGED_READBACK_MISMATCH');
    const next = { ownerUid: plan.ownerUid, active: plan.planDigest, revision: state.revision + 1 };
    await publish(target, next);
    return { status: 'committed', state: next };
  });
}

export async function rollbackOfflineImport({ destination, ownerUid, planDigest, expectedRevision }) {
  if (!/^[a-f0-9]{64}$/.test(planDigest)) throw Error('INVALID_PLAN_ID');
  const target = resolve(destination);
  return withLock(target, async () => {
    const state = await loadState(target, ownerUid);
    if (state.active !== planDigest || state.revision !== expectedRevision) throw Error('ROLLBACK_CONFLICT');
    const plan = JSON.parse(await readFile(join(target, `dataset-${planDigest}.json`), 'utf8'));
    validatePlan(plan);
    if (plan.planDigest !== planDigest || plan.ownerUid !== ownerUid) throw Error('ROLLBACK_DATASET_MISMATCH');
    const next = { ownerUid, active: null, revision: state.revision + 1 };
    await publish(target, next);
    return next; // Original backup and immutable imported dataset are retained.
  });
}
