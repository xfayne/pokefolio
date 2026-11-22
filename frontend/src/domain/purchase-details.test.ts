import { expect, it } from 'vitest';
import { selectPurchaseDetails } from './purchase-details';
import { sampleHistory, samplePurchaseShipments } from '@/features/transactions/sample';
import { importedPurchaseSchema } from './schema';

it('keeps card and landed costs separate and reconciles the approved example', () => {
  const view = selectPurchaseDetails(sampleHistory, 'sample-nov-19', samplePurchaseShipments)!;
  expect(view.transaction.subtotal).toMatchObject({ status: 'known', value: { minor: 13000 } });
  expect(view.row.minor).toBe(14200);
  expect(view.copies.map(c => c.copy.cardCost)).toMatchObject([{ value: { minor: 5200 } }, { value: { minor: 4600 } }, { value: { minor: 3200 } }]);
  expect(view.copies.map(c => c.basis)).toMatchObject([{ minor: 5600 }, { minor: 5000 }, { minor: 3600 }]);
  expect(view.shippingRange).toEqual({ currency: 'USD', min: 400, max: 400 });
  expect(view.cardCostMismatch).toBe(false);
  expect(view.shipments[0]?.events.map(e => e.code)).toEqual(['departed', 'accepted', 'registered']);
});
it('shows recorded rounded allocations without replacing them with an average', () => {
  const data = { ...sampleHistory, transactions: sampleHistory.transactions.map(p => p.id !== 'sample-nov-19' || p.kind !== 'purchase' || 'origin' in p ? p : {
    ...p, shipping: { status: 'known' as const, source: 'user' as const, value: { currency: 'USD' as const, minor: 1000 } }, payable: { currency: 'USD' as const, minor: 14000 },
  }), copies: sampleHistory.copies.map((c, index) => index > 2 ? c : { ...c, shippingCost: { status: 'exact' as const, value: { currency: 'USD' as const, minor: index ? 333 : 334 }, evidenceRef: 'sample-nov-19' } }) };
  expect(selectPurchaseDetails(data, 'sample-nov-19', [])?.shippingRange).toEqual({ currency: 'USD', min: 333, max: 334 });
  expect(selectPurchaseDetails({ ...data, copies: data.copies.slice(1) }, 'sample-nov-19', [])?.shippingRange).toBeNull();
});
it('preserves unknown imported prices and payment evidence instead of reporting zero or paid', () => {
  const unknown = { status: 'unknown', reason: 'Not recorded' };
  const p = importedPurchaseSchema.parse({ schemaVersion: 1, ownerUid: sampleHistory.ownerUid, id: 'imported', revision: 1, createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z', kind: 'purchase', origin: 'legacy-import', transactionOn: unknown, currency: unknown, sourceParcelId: 'parcel', notes: '', subtotal: unknown, payable: unknown, shipping: unknown, taxes: unknown, fees: unknown, totalBasis: 'recorded-card-prices', settlement: 'unknown' });
  const view = selectPurchaseDetails({ ...sampleHistory, transactions: [p] }, p.id, [])!;
  expect(view.row).toMatchObject({ date: null, currency: null, minor: null });
  expect(view.shippingRange).toBeNull();
  expect(view.transaction.settlement).toBe('unknown');
});
it('reports mismatched copy costs and rejects foreign tracking or another purchase copy', () => {
  const copies = sampleHistory.copies.map((c, index) => index ? c : { ...c, cardCost: { status: 'exact' as const, value: { currency: 'USD' as const, minor: 1 }, evidenceRef: 'sample-nov-19' } });
  expect(selectPurchaseDetails({ ...sampleHistory, copies }, 'sample-nov-19', [])?.cardCostMismatch).toBe(true);
  const shipment = samplePurchaseShipments[0]!;
  expect(() => selectPurchaseDetails(sampleHistory, 'sample-nov-19', [{ ...shipment, ownerUid: 'foreign' }])).toThrow();
  expect(() => selectPurchaseDetails(sampleHistory, 'sample-nov-19', [{ ...shipment, copyIds: ['sample-nov-16-copy-0'] }])).toThrow();
  expect(() => selectPurchaseDetails(sampleHistory, 'sample-nov-19', [shipment, shipment])).toThrow();
  expect(selectPurchaseDetails(sampleHistory, 'sample-nov-14', [])).toBeNull();
  expect(selectPurchaseDetails(sampleHistory, 'absent', [])).toBeNull();
});
