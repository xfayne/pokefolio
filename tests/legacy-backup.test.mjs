import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, createBackup, validateBackup, saveAndVerifyBackup, readVerifiedBackup, backupCoverage } from '../scripts/legacy-backup.mjs';

const input = () => ({
  source: { projectId: 'synthetic-only', ownerUid: 'fixture-owner', revision: '7', capturedAt: '2026-11-20T12:00:00Z' },
  documents: { root: { progress: { binderOrder: ['a', '__binder_empty__:1', 'b', 'a'], wishOrder: ['z', 'y'], unknownField: null } } },
  inventory: [{ path: 'root', status: 'present' }, { path: 'settings', status: 'absent' }, { path: 'analyses', status: 'not-exported' }],
});

test('lossless export preserves duplicates, holes, unknown fields and source immutability', () => {
  const source = input(), before = structuredClone(source), backup = createBackup(source);
  assert.deepEqual(validateBackup(backup).payload.documents, source.documents);
  backup.payload.documents.root.progress.binderOrder.push('changed');
  assert.deepEqual(source, before);
  assert.throws(() => validateBackup(backup), /DIGEST/);
});

test('rejects lossy JSON values, prototypes, cycles, accessors and sparse arrays', () => {
  const cyclic = {}; cyclic.self = cyclic;
  for (const value of [undefined, NaN, Infinity, -0, 1n, new Date(), new Map(), cyclic, [, 1], { x: undefined }, { get x() { throw Error('must not run'); } }]) {
    assert.throws(() => canonical(value));
  }
});

test('manifest distinguishes absent from omitted data and rejects inconsistent exports', () => {
  const backup = createBackup(input());
  assert.deepEqual(backupCoverage(backup, ['root', 'settings', 'analyses', 'public']), ['analyses', 'public']);
  const x = input(); x.inventory[0].status = 'absent';
  assert.throws(() => createBackup(x), /COVERAGE/);
  const y = input(); y.inventory.push(y.inventory[0]);
  assert.throws(() => createBackup(y), /PATHS/);
  const z = input(); z.documents.extra = {};
  assert.throws(() => createBackup(z), /UNLISTED/);
});

test('durable independent read-back, no overwrite, tamper and wrong-source detection', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pokefolio-synthetic-'));
  try {
    const path = join(dir, 'backup.json'), backup = createBackup(input());
    assert.equal((await saveAndVerifyBackup(path, backup)).readBackVerified, true);
    await assert.rejects(saveAndVerifyBackup(path, backup), /EEXIST/);
    const other = input(); other.source.ownerUid = 'different';
    await assert.rejects(readVerifiedBackup(path, createBackup(other)), /READBACK/);
    const data = JSON.parse(await readFile(path, 'utf8')); data.payload.documents.root.progress.wishOrder.reverse();
    await writeFile(path, JSON.stringify(data));
    await assert.rejects(readVerifiedBackup(path), /DIGEST/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
