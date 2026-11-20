import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createBackup, saveAndVerifyBackup } from '../scripts/legacy-backup.mjs';
import { prepareOfflineImport, applyOfflineImport, rollbackOfflineImport } from '../scripts/legacy-import-files.mjs';

test('durable isolated apply, replay, conflicts and rollback retain exact source and staged data', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pokefolio-import-fixture-'));
  try {
    const backupPath = join(dir, 'source.json'), destination = join(dir, 'target');
    const progress = { owned: {}, binderOrder: ['__binder_empty__:1'], wishOrder: [] };
    const backup = createBackup({ source: { projectId: 'synthetic', ownerUid: 'test', revision: '1', capturedAt: '2026-11-20T00:00:00Z' }, documents: { root: { progress }, settings: { enabled: false, shareId: 'synthetic-only' } }, inventory: [{ path: 'root', status: 'present' }, { path: 'settings', status: 'present' }, { path: 'analyses', status: 'absent' }] });
    await saveAndVerifyBackup(backupPath, backup);
    const before = await readFile(backupPath, 'utf8');
    const plan = await prepareOfflineImport({ backupPath, expectedBackup: backup, scope: { rootPath: 'root', requiredPaths: ['root', 'settings', 'analyses'], catalogIds: [] }, ownerUid: 'test', payload: { copies: [], transactions: [], preservedProgress: progress } });
    assert.deepEqual(plan.sourceArchive, backup.payload);
    const approval = { planDigest: plan.planDigest, ownerUid: 'test', destination: resolve(destination), environment: 'offline-isolated' };
    const args = { destination, backupPath, expectedBackup: backup, plan, approval, expectedRevision: 0 };
    await assert.rejects(prepareOfflineImport({ backupPath, ownerUid: 'test' }), /INDEPENDENT_CAPTURE/);
    await assert.rejects(applyOfflineImport({ ...args, approval: { ...approval, planDigest: 'wrong' } }), /APPROVAL/);
    await assert.rejects(applyOfflineImport({ ...args, destination: dir, approval: { ...approval, destination: dir } }), /OUTSIDE/);
    assert.equal((await applyOfflineImport(args)).status, 'committed');
    assert.equal((await applyOfflineImport(args)).status, 'replayed');
    await writeFile(join(destination, 'migration.lock'), 'interrupted-operation', { flag: 'wx' });
    await assert.rejects(applyOfflineImport(args), /EEXIST/);
    await rm(join(destination, 'migration.lock'));
    await assert.rejects(rollbackOfflineImport({ destination, ownerUid: 'test', planDigest: plan.planDigest, expectedRevision: 0 }), /ROLLBACK_CONFLICT/);
    const state = await rollbackOfflineImport({ destination, ownerUid: 'test', planDigest: plan.planDigest, expectedRevision: 1 });
    assert.equal(state.active, null);
    assert.equal(await readFile(backupPath, 'utf8'), before);
    const artifact = join(destination, `dataset-${plan.planDigest}.json`);
    assert.deepEqual(JSON.parse(await readFile(artifact, 'utf8')), plan);
    const interrupted = join(dir, 'interrupted');
    await mkdir(interrupted);
    await writeFile(join(interrupted, `dataset-${plan.planDigest}.json`), JSON.stringify(plan));
    assert.equal((await applyOfflineImport({ ...args, destination: interrupted, approval: { ...approval, destination: resolve(interrupted) } })).status, 'committed');
    await writeFile(artifact, '{}');
    await assert.rejects(applyOfflineImport({ ...args, expectedRevision: 2 }), /DATASET_MISMATCH/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
