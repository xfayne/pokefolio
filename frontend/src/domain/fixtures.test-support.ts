import type { CardCopy, CatalogRef, Money, Purchase, PurchaseLine } from './schema';

export const metadata = { schemaVersion: 1 as const, ownerUid: 'owner', revision: 1,
  createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z' };
export const known = <T,>(value: T) => ({ status: 'known' as const, value, source: 'user' as const });
export const unknown = { status: 'unknown' as const, reason: 'Not recorded' };
export const gbp = (minor: number): Money => ({ currency: 'GBP', minor });
export const catalog: CatalogRef = { kind: 'identified', cardId: 'base3-5', edition: 'unlimited', language: known('en'), finish: known('holo') };
export const purchase: Purchase = { ...metadata, id: 'purchase', kind: 'purchase', transactionOn: '2026-11-20',
  currency: 'GBP', source: { kind: 'manual', seller: null, listingUrl: null, itemReference: null }, notes: '',
  pricingMode: 'per-copy', lotId: null, subtotal: known(gbp(7000)), shipping: known(gbp(100)), taxes: known(gbp(0)), fees: known(gbp(0)),
  payable: gbp(7100), settlement: 'paid' };
export const lines: PurchaseLine[] = [
  { ...metadata, id: 'line-a', transactionId: 'purchase', ordinal: 0, quantity: 2, catalog, pricing: { mode: 'per-copy', unitPrice: gbp(2000) } },
  { ...metadata, id: 'line-b', transactionId: 'purchase', ordinal: 1, quantity: 1, catalog: { ...catalog, cardId: 'base2-11' }, pricing: { mode: 'per-copy', unitPrice: gbp(3000) } },
];
export const copy: CardCopy = { ...metadata, id: 'copy-a', catalog, condition: known('LP'),
  acquisition: { kind: 'purchase', transactionId: 'purchase', lineId: 'line-a', unitOrdinal: 0 },
  acquiredOn: known('2026-11-20'), possession: 'received', disposition: 'held',
  cardCost: { status: 'exact', value: gbp(2000), evidenceRef: 'purchase' },
  shippingCost: { status: 'exact', value: gbp(34), evidenceRef: 'purchase' },
  taxCost: { status: 'exact', value: gbp(0), evidenceRef: 'purchase' }, feeCost: { status: 'exact', value: gbp(0), evidenceRef: 'purchase' },
  dispositionRecordId: null, notes: '' };
