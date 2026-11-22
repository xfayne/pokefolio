import { describe, expect, it } from 'vitest';
import { auditCopyChange, planSale } from './lifecycle';
import { prepareCommit, recordKey, type PortfolioCommit, type PortfolioRecord } from './persistence';
import { copy, gbp, known, metadata, purchase } from './fixtures.test-support';

// Contract test double only: validates optimistic/idempotent semantics without
// opening Firebase. A future live adapter must pass its own security/atomicity tests.
class FakeAtomicStore {
  records = new Map<string, PortfolioRecord>();
  receipts = new Map<string, string>();
  commit(raw: PortfolioCommit): 'committed' | 'replayed' {
    const command = prepareCommit('owner', raw, 50), fingerprint = JSON.stringify(command);
    const previous = this.receipts.get(command.idempotencyKey);
    if (previous !== undefined) {
      if (previous !== fingerprint) throw new Error('Idempotency payload conflict');
      return 'replayed';
    }
    for (const entry of command.creates) if (this.records.has(recordKey(entry))) throw new Error('Create conflict');
    for (const update of command.updates) if (JSON.stringify(this.records.get(recordKey(update.before))) !== JSON.stringify(update.before)) throw new Error('Concurrent revision conflict');
    for (const entry of [...command.creates, ...command.updates.map((update) => update.after)]) this.records.set(recordKey(entry), structuredClone(entry));
    this.receipts.set(command.idempotencyKey, fingerprint);
    return 'committed';
  }
}

describe('owner-scoped persistence contract', () => {
  const command: PortfolioCommit = { ownerUid: 'owner', idempotencyKey: 'purchase-command', creates: [{ collection: 'transactions', record: purchase }, { collection: 'copies', record: copy }], updates: [] };
  it('replays a double submission once and rejects a changed payload for the same key', () => {
    const store = new FakeAtomicStore();
    expect(store.commit(command)).toBe('committed');
    expect(store.commit(command)).toBe('replayed');
    expect(store.records.size).toBe(2);
    expect(() => store.commit({ ...command, creates: [{ collection: 'copies', record: { ...copy, notes: 'Changed' } }] })).toThrow('Idempotency payload conflict');
    expect(store.records.size).toBe(2);
  });
  it('rejects foreign writes, unknown paths and over-capacity commits including receipts', () => {
    expect(() => prepareCommit('foreign', command, 50)).toThrow();
    expect(() => prepareCommit('owner', { ...command, creates: [{ collection: 'copies', record: { ...copy, ownerUid: 'foreign' } }] }, 50)).toThrow();
    expect(() => prepareCommit('owner', { ...command, creates: [{ collection: 'binderOrder', record: copy }] }, 50)).toThrow();
    expect(() => prepareCommit('owner', command, 2)).toThrow();
    expect(() => prepareCommit('owner', { ...command, creates: [command.creates[0], command.creates[0]] }, 50)).toThrow();
  });
  it('allows only one competing sale and leaves no partial second-sale records', () => {
    const store = new FakeAtomicStore(); store.commit(command);
    const makeSale = (id: string): PortfolioCommit => {
      const sale = { ...metadata, id, kind: 'sale', transactionOn: '2026-11-21', currency: 'GBP', source: purchase.source, notes: '', cardProceeds: known(gbp(3000)), buyerShipping: known(gbp(0)), sellingFees: known(gbp(0)), sellerShipping: known(gbp(0)), sellingTaxes: known(gbp(0)) };
      const plan = planSale('owner', sale, [{ ...metadata, id: `${id}-line`, transactionId: id, copyId: copy.id, proceeds: { status: 'exact', value: gbp(3000), evidenceRef: id }, expenses: { status: 'exact', value: gbp(0), evidenceRef: id } }], [copy], '2026-11-21T10:00:00Z');
      const change = plan.changes[0]!;
      return { ownerUid: 'owner', idempotencyKey: id, creates: [{ collection: 'transactions', record: plan.sale }, { collection: 'revisions', record: auditCopyChange(change, `${id}-audit`, 'Sale recorded', 'edit') }], updates: [{ before: { collection: 'copies', record: change.before }, after: { collection: 'copies', record: change.after } }] };
    };
    store.commit(makeSale('sale-a'));
    const size = store.records.size;
    expect(() => store.commit(makeSale('sale-b'))).toThrow('Concurrent revision conflict');
    expect(store.records.size).toBe(size);
    expect(store.records.has('transactions/sale-b')).toBe(false);
    expect(store.records.get('copies/copy-a')?.record.revision).toBe(2);
  });
  it('requires an audit record before changing a copy', () => {
    expect(() => prepareCommit('owner', { ...command, creates: [], updates: [{ before: { collection: 'copies', record: copy }, after: { collection: 'copies', record: { ...copy, revision: 2, notes: 'Updated' } } }] }, 50)).toThrow('matching immutable audit');
  });
});
