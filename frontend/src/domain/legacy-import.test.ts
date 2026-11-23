import { describe, it, expect } from 'vitest';
import { materializeLegacyImport } from './legacy-import';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const stamp = '2026-11-20T00:00:00Z';
const unknown = { status: 'unknown', reason: 'Missing source evidence' };
const input = () => ({ mappingVersion: 2, status: 'PASS', source: { ownerUid: 'test' }, copies: [{ id: 'legacy-copy', cardId: 'base-1', possession: 'pending', condition: unknown, edition: 'unknown', acquiredOn: unknown, cardCost: { status: 'exact', value: { currency: 'GBP', minor: 2000 }, sourcePath: 'purchasePrices.base-1' } }], transactions: [{ id: 'legacy-purchase', sourceParcelIndex: 0 }], memberships: [{ parcelIndex: 0, ordinal: 0, cardId: 'base-1', copyId: 'legacy-copy' }], preservedProgress: { notes: { 'base-1': 'Private note' }, shipments: [{ id: 'original-parcel', cardIds: ['base-1'], number: 'ABC123', initialized: true }], binderOrder: ['base-1', '__binder_empty__:1'], wishOrder: ['other'], analyticsSnapshots: [{ date: '2026-11-19', index: 100.24 }] } });

describe('legacy domain draft', () => {
  it('runs backup  preview  domain  isolated apply/replay  rollback without source changes', () => {
    const code = `import { createBackup } from './scripts/legacy-backup.mjs';
      import { previewLegacy } from './scripts/legacy-preview.mjs';
      const backup = createBackup({ source: { projectId: 'fixture', ownerUid: 'test', revision: '1', capturedAt: '${stamp}' }, documents: { root: { progress: { owned: { a: true }, conditions: { a: 'DMG' }, analyticsSnapshots: [{ date: '2026-11-19', totalValue: 100 }], shipments: [{ id: 'parcel', cardIds: ['a'], purchaseDate: '2026-11-12' }] } } }, inventory: [{ path: 'root', status: 'present' }] });
      console.log(JSON.stringify(previewLegacy(backup, { rootPath: 'root', catalogIds: ['a'], requiredPaths: ['root'] })));`;
    const report: unknown = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: resolve(process.cwd(), '..'), encoding: 'utf8' }));
    const result = materializeLegacyImport(report, 'test', stamp);
    expect(result.copies[0]!.condition).toEqual({ status: 'known', value: 'DAMAGED', source: 'legacy' });
    expect(result.transactions).toHaveLength(1);
    expect(result.preservedProgress).not.toHaveProperty('analyticsSnapshots');
    expect((report as {preservedProgress:{analyticsSnapshots:unknown[]}}).preservedProgress.analyticsSnapshots).toHaveLength(1);
    expect(result.transactions[0]!.transactionOn).toEqual({ status: 'known', value: '2026-11-12', source: 'legacy' });
    expect(result.acquisitions).toHaveLength(0);
    const storeCode = `import { createBackup, saveAndVerifyBackup } from './scripts/legacy-backup.mjs';
      import { prepareOfflineImport, applyOfflineImport, rollbackOfflineImport } from './scripts/legacy-import-files.mjs';
      import { mkdtemp, readFile, rm } from 'node:fs/promises';
      import { join, resolve } from 'node:path'; import { tmpdir } from 'node:os';
      const { report, payload } = JSON.parse(process.argv[1]);
      const dir = await mkdtemp(join(tmpdir(), 'pokefolio-domain-fixture-'));
      try {
        const backupPath = join(dir, 'backup.json'), destination = join(dir, 'isolated');
        const backup = createBackup({ source: report.source, documents: { root: { progress: report.preservedProgress } }, inventory: [{ path: 'root', status: 'present' }] });
        await saveAndVerifyBackup(backupPath, backup);
        const before = await readFile(backupPath, 'utf8');
        const plan = await prepareOfflineImport({ backupPath, expectedBackup: backup, scope: { rootPath: 'root', requiredPaths: ['root'], catalogIds: ['a'] }, ownerUid: 'test', payload });
        const args = { destination, backupPath, expectedBackup: backup, plan, approval: { planDigest: plan.planDigest, ownerUid: 'test', destination: resolve(destination), environment: 'offline-isolated' }, expectedRevision: 0 };
        const first = await applyOfflineImport(args), replay = await applyOfflineImport(args);
        const rolled = await rollbackOfflineImport({ destination, ownerUid: 'test', planDigest: plan.planDigest, expectedRevision: 1 });
        console.log(JSON.stringify({ first: first.status, replay: replay.status, active: rolled.active, unchanged: before === await readFile(backupPath, 'utf8') }));
      } finally { await rm(dir, { recursive: true, force: true }); }`;
    const stored = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', storeCode, JSON.stringify({ report, payload: result })], { cwd: resolve(process.cwd(), '..'), encoding: 'utf8' }));
    expect(stored).toEqual({ first: 'committed', replay: 'replayed', active: null, unchanged: true });
  });
  it('creates schema-valid opening records, preserves organization and references without cash', () => {
    const source = input(), before = structuredClone(source);
    const result = materializeLegacyImport(source, 'test', stamp);
    expect(result.copies[0]!.cardCost).toEqual({ status: 'exact', value: { currency: 'GBP', minor: 2000 }, evidenceRef: result.transactions[0]!.id });
    expect(result.copies[0]!.notes).toBe('Private note');
    expect(result.copies[0]!.possession).toBe('pending');
    expect(result.memberships[0]!.copyId).toBe(result.copies[0]!.id);
    const { analyticsSnapshots: archivedOnly, ...expectedProgress } = source.preservedProgress;
    expect(archivedOnly).toHaveLength(1);
    expect(result.preservedProgress).toEqual(expectedProgress);
    expect(result.preservedProgress).not.toHaveProperty('analyticsSnapshots');
    expect(result.cashMovements).toEqual([]);
    expect(result.transactions[0]!.payable).toEqual({ status: 'known', value: { currency: 'GBP', minor: 2000 }, source: 'legacy' });
    expect(source).toEqual(before);
  });
  it('rejects blocked drafts, wrong owners, duplicate identities and broken references', () => {
    expect(() => materializeLegacyImport({ ...input(), status: 'BLOCKED' }, 'test', stamp)).toThrow();
    expect(() => materializeLegacyImport(input(), 'other', stamp)).toThrow('OWNER');
    const duplicate = input(); duplicate.copies.push(duplicate.copies[0]!);
    expect(() => materializeLegacyImport(duplicate, 'test', stamp)).toThrow('DUPLICATE');
    const broken = input(); broken.memberships[0]!.copyId = 'missing';
    expect(() => materializeLegacyImport(broken, 'test', stamp)).toThrow('REFERENCE');
  });
  it('converts two per-copy prices to one 50 GBP purchase with exact copy/parcel links', () => {
    const source = input();
    source.copies[0]!.cardCost.value.minor = 2000;
    source.copies.push({ ...structuredClone(source.copies[0]!), id: 'second-copy', cardId: 'base-2', possession: 'received', cardCost: { status: 'exact', value: { currency: 'GBP', minor: 3000 }, sourcePath: 'purchasePrices.base-2' } });
    source.memberships.push({ parcelIndex: 0, ordinal: 1, cardId: 'base-2', copyId: 'second-copy' });
    source.preservedProgress.shipments[0]!.cardIds.push('base-2');
    const result = materializeLegacyImport(source, 'test', stamp);
    expect(result.transactions[0]!.payable).toEqual({ status: 'known', value: { currency: 'GBP', minor: 5000 }, source: 'legacy' });
    expect(result.lines.map(l => l.pricing.unitPrice)).toEqual([{ status: 'known', value: { currency: 'GBP', minor: 2000 }, source: 'legacy' }, { status: 'known', value: { currency: 'GBP', minor: 3000 }, source: 'legacy' }]);
    expect(result.acquisitions).toEqual([]);
    expect(result.copies.map(c => c.possession)).toEqual(['pending', 'received']);
    expect(result.copies.every(c => c.acquisition.kind === 'purchase' && c.acquisition.transactionId === result.transactions[0]!.id)).toBe(true);
    expect(result.memberships.every(m => m.transactionId === result.transactions[0]!.id)).toBe(true);
    expect(result.transactions[0]!.shipping.status).toBe('unknown');
    expect(result.transactions[0]!.transactionOn.status).toBe('unknown');
  });
  it('keeps cards without parcel evidence as opening inventory and refuses incomplete membership', () => {
    const source = input(); source.memberships = []; source.transactions = []; source.preservedProgress.shipments = [];
    const result = materializeLegacyImport(source, 'test', stamp);
    expect(result.acquisitions).toHaveLength(1);
    expect(result.transactions).toHaveLength(0);
    expect(result.copies[0]!.acquisition.kind).toBe('opening-inventory');
    const broken = input(); broken.memberships = [];
    expect(() => materializeLegacyImport(broken, 'test', stamp)).toThrow('INCOMPLETE');
  });
});
