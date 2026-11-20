import { describe, it, expect } from 'vitest';
import { materializeLegacyDraft } from './legacy-import';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const stamp = '2026-11-20T00:00:00Z';
const unknown = { status: 'unknown', reason: 'Missing source evidence' };
const input = () => ({ mappingVersion: 1, status: 'PASS', source: { ownerUid: 'test' }, copies: [{ id: 'legacy-copy', cardId: 'base-1', possession: 'pending', condition: unknown, edition: 'unknown', acquiredOn: unknown, cardCost: { status: 'exact', value: { currency: 'GBP', minor: 2000 }, sourcePath: 'purchasePrices.base-1' } }], memberships: [{ parcelIndex: 0, ordinal: 0, cardId: 'base-1', copyId: 'legacy-copy' }], preservedProgress: { notes: { 'base-1': 'Private note' }, shipments: [{ id: 'original-parcel', number: 'ABC123', initialized: true }], binderOrder: ['base-1', '__binder_empty__:1'], wishOrder: ['other'] } });

describe('legacy domain draft', () => {
  it('materializes the actual offline preview, including legacy known conditions', () => {
    const code = `import { createBackup } from './scripts/legacy-backup.mjs';
      import { previewLegacy } from './scripts/legacy-preview.mjs';
      const backup = createBackup({ source: { projectId: 'fixture', ownerUid: 'test', revision: '1', capturedAt: '${stamp}' }, documents: { root: { progress: { owned: { a: true }, conditions: { a: 'DMG' }, shipments: [{ id: 'parcel', cardIds: ['a'], purchaseDate: '2026-11-12' }] } } }, inventory: [{ path: 'root', status: 'present' }] });
      console.log(JSON.stringify(previewLegacy(backup, { rootPath: 'root', catalogIds: ['a'], requiredPaths: ['root'] })));`;
    const report: unknown = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: resolve(process.cwd(), '..'), encoding: 'utf8' }));
    const result = materializeLegacyDraft(report, 'test', stamp);
    expect(result.copies[0]!.condition).toEqual({ status: 'known', value: 'DAMAGED', source: 'legacy' });
    expect(result.transactionDrafts).toHaveLength(1);
    expect(result.acquisitions[0]!.effectiveOn).toEqual({ status: 'known', value: '2026-11-12', source: 'legacy' });
  });
  it('creates schema-valid opening records, preserves organization and references without cash', () => {
    const source = input(), before = structuredClone(source);
    const result = materializeLegacyDraft(source, 'test', stamp);
    expect(result.copies[0]!.cardCost).toEqual({ status: 'exact', value: { currency: 'GBP', minor: 2000 }, evidenceRef: result.acquisitions[0]!.id });
    expect(result.copies[0]!.notes).toBe('Private note');
    expect(result.copies[0]!.possession).toBe('pending');
    expect(result.memberships[0]!.copyId).toBe(result.copies[0]!.id);
    expect(result.preservedProgress).toEqual(source.preservedProgress);
    expect(result.cashMovements).toEqual([]);
    expect(result.transactions).toEqual([]);
    expect(source).toEqual(before);
  });
  it('rejects blocked drafts, wrong owners, duplicate identities and broken references', () => {
    expect(() => materializeLegacyDraft({ ...input(), status: 'BLOCKED' }, 'test', stamp)).toThrow();
    expect(() => materializeLegacyDraft(input(), 'other', stamp)).toThrow('OWNER');
    const duplicate = input(); duplicate.copies.push(duplicate.copies[0]!);
    expect(() => materializeLegacyDraft(duplicate, 'test', stamp)).toThrow('DUPLICATE');
    const broken = input(); broken.memberships[0]!.copyId = 'missing';
    expect(() => materializeLegacyDraft(broken, 'test', stamp)).toThrow('REFERENCE');
  });
});
