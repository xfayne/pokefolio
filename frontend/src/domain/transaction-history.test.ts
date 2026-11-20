import { expect, it } from 'vitest';
import { groupHistory, selectHistory, type HistoryFilters, type HistoryRow } from './transaction-history';
import { sampleHistory } from '@/features/transactions/sample';
import { importedPurchaseSchema } from './schema';

const all: HistoryFilters = { query: '', kind: 'all', currency: 'all', status: 'all' };
it('reconciles original transaction totals and counts physical copies, independently of thumbnail count', () => {
  const rows = selectHistory(sampleHistory);
  expect(rows.map(r => r.minor)).toEqual([14200, 4200, 8500, 12800]);
  expect(rows[3]).toMatchObject({ copyCount: 4, cards: expect.any(Array) });
  expect(rows[3]?.cards).toHaveLength(3);
  expect(groupHistory(rows, all)[0]).toMatchObject({ month: '2026-11', missingCount: 0, totals: [{ currency: 'USD', minor: -22700 }] });
});
it('never calls a pending purchase in transit without tracking evidence and retains mixed receipts', () => {
  expect(selectHistory(sampleHistory)[0]?.status).toBe('inTransit');
  expect(selectHistory({ ...sampleHistory, inTransit: [] })[0]?.status).toBe('pending');
  const copies = sampleHistory.copies.map((copy, index) => index === 0 ? { ...copy, possession: 'received' as const } : copy);
  expect(selectHistory({ ...sampleHistory, copies })[0]?.status).toBe('partial');
});
it('searches catalog/seller/reference information and combines type, currency and delivery filters', () => {
  const rows = selectHistory(sampleHistory);
  expect(groupHistory(rows, { ...all, query: 'Gengar', kind: 'purchase', status: 'inTransit', currency: 'USD' })[0]?.rows.map(r => r.id)).toEqual(['sample-nov-19']);
  expect(groupHistory(rows, { ...all, query: '  local buyer ', kind: 'sale' })[0]?.totals).toEqual([{ currency: 'USD', minor: 8500 }]);
  expect(groupHistory(rows, { ...all, kind: 'purchase' })[0]?.totals[0]?.minor).toBe(-31200);
  expect(groupHistory(rows, { ...all, currency: 'GBP' })).toEqual([]);
});
it('keeps mixed currencies separate and exposes missing historical totals/dates without inventing values', () => {
  const row = selectHistory(sampleHistory)[0]!;
  const rows: HistoryRow[] = [row, { ...row, id: 'gbp', currency: 'GBP', minor: 1200 }, { ...row, id: 'unknown', currency: null, minor: null }];
  expect(groupHistory(rows, all)[0]).toMatchObject({ totals: [{ currency: 'GBP', minor: -1200 }, { currency: 'USD', minor: -14200 }], missingCount: 1 });
  const unknown = { status: 'unknown', reason: 'Not recorded' };
  const imported = importedPurchaseSchema.parse({ schemaVersion: 1, ownerUid: sampleHistory.ownerUid, id: 'imported', revision: 1,
    createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z', kind: 'purchase', origin: 'legacy-import', transactionOn: unknown,
    currency: unknown, sourceParcelId: 'legacy-parcel', notes: '', subtotal: unknown, payable: unknown, shipping: unknown, taxes: unknown, fees: unknown,
    totalBasis: 'recorded-card-prices', settlement: 'unknown',
  });
  const months = groupHistory(selectHistory({ ...sampleHistory, transactions: [...sampleHistory.transactions, imported] }), all);
  expect(months.at(-1)).toMatchObject({ month: null, totals: [], missingCount: 1, rows: [{ id: 'imported', minor: null, date: null }] });
});
it('rejects foreign/duplicate records and invalid sale references before presenting history', () => {
  expect(() => selectHistory({ ...sampleHistory, ownerUid: 'foreign' })).toThrow();
  expect(() => selectHistory({ ...sampleHistory, transactions: [...sampleHistory.transactions, sampleHistory.transactions[0]!] })).toThrow();
  expect(() => selectHistory({ ...sampleHistory, saleLines: sampleHistory.saleLines.map(l => ({ ...l, copyId: 'absent' })) })).toThrow('Missing sale copy');
  expect(() => selectHistory({ ...sampleHistory, inTransit: [{ ownerUid: 'foreign', transactionId: 'sample-nov-19' }] })).toThrow('Foreign tracking evidence');
});
