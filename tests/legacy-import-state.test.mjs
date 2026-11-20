import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackup } from '../scripts/legacy-backup.mjs';
import { previewLegacy } from '../scripts/legacy-preview.mjs';
import { stageImport, activateImport, rollbackImport } from '../scripts/legacy-import-state.mjs';
function setup() {
  const backup = createBackup({ source: { projectId: 'fixture', ownerUid: 'test', revision: '1', capturedAt: '2026-11-20T00:00:00Z' }, documents: { root: { progress: { owned: { a: true } } } }, inventory: [{ path: 'root', status: 'present' }] });
  const preview = previewLegacy(backup, { rootPath: 'root', requiredPaths: ['root'], catalogIds: ['a'] });
  const approval = { previewDigest: preview.previewDigest, backupDigest: backup.sha256, ownerUid: 'test', destination: 'synthetic-staging', independentBackupVerified: true };
  return { preview, approval, state: { ownerUid: 'test', datasets: {}, active: null, revision: 0 }, id: 'import-' + preview.previewDigest };
}
test('inactive stage, exact replay, atomic pointer contract and retained rollback data', () => {
  const { state, preview, approval, id } = setup();
  const staged = stageImport(state, preview, approval);
  assert.equal(staged.active, null);
  assert.deepEqual(stageImport(staged, preview, approval), staged);
  assert.deepEqual(state.datasets, {});
  const active = activateImport(staged, id, 0);
  assert.deepEqual(activateImport(active, id, 1), active);
  const rolled = rollbackImport(active, id, 1);
  assert.equal(rolled.active, null);
  assert.deepEqual(rolled.datasets, active.datasets);
});
test('rejects forged approval/preview, concurrent pointers, target corruption and later edits', () => {
  const { state, preview, approval, id } = setup();
  assert.throws(() => stageImport(state, preview, { ...approval, destination: 'production' }), /APPROVAL/);
  assert.throws(() => stageImport(state, { ...preview, copies: [] }, approval), /PREVIEW/);
  const staged = stageImport(state, preview, approval);
  assert.throws(() => activateImport(staged, id, 9), /POINTER/);
  staged.datasets[id].preview.copies = [];
  assert.throws(() => stageImport(staged, preview, approval), /TARGET/);
  assert.throws(() => activateImport(staged, id, 0), /PREVIEW/);
  const active = activateImport(stageImport(state, preview, approval), id, 0);
  active.datasets[id].revision++;
  assert.throws(() => rollbackImport(active, id, 1), /ROLLBACK/);
});
