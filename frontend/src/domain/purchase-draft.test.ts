import { expect, it } from 'vitest';
import { preparePurchaseDraft, previewPurchaseDraft } from './purchase-draft';
import { createPurchaseDraft } from '@/features/transactions/purchase-draft-seed';
const at = '2026-11-20T10:00:00Z';
it('requires each ordinary copy price and date and builds distinct pending copies without inferring payment', () => {
  const draft = createPurchaseDraft(true);
  expect(previewPurchaseDraft(draft).total).toEqual({ currency: 'USD', minor: 14200 });
  const before = structuredClone(draft);
  const prepared = preparePurchaseDraft('owner', draft, at);
  expect(prepared.plan.copies.map(c => c.shippingCost)).toMatchObject([{ value: { minor: 400 } }, { value: { minor: 400 } }, { value: { minor: 400 } }]);
  expect(prepared.plan.copies.every(c => c.possession === 'pending')).toBe(true);
  expect(new Set(prepared.plan.copies.map(c => c.id)).size).toBe(3);
  expect(prepared.plan.payment).toBeNull();
  expect(prepared.plan.purchase.settlement).toBe('unknown');
  expect(draft).toEqual(before);
  expect(() => preparePurchaseDraft('owner', { ...draft, cards: draft.cards.map((c, i) => i ? c : { ...c, amount: '' }) }, at)).toThrow();
  expect(() => preparePurchaseDraft('owner', { ...draft, date: '2026-02-30' }, at)).toThrow();
});
it('splits shipping per physical copy with deterministic reconciled cents even for duplicate catalog cards', () => {
  const draft = createPurchaseDraft(true);
  draft.shipping = '10.00';
  draft.cards = draft.cards.map(c => ({ ...c, catalog: draft.cards[0]!.catalog }));
  expect(previewPurchaseDraft(draft).range).toEqual({ min: 333, max: 334 });
  const prepared = preparePurchaseDraft('owner', draft, at);
  expect(prepared.plan.copies.map(c => c.shippingCost.status === 'exact' ? c.shippingCost.value.minor : null)).toEqual([334, 333, 333]);
  expect(prepared.plan.copies.map(c => c.cardCost)).toMatchObject([{ value: { minor: 5200 } }, { value: { minor: 4600 } }, { value: { minor: 3200 } }]);
});
it('stores a total-priced lot with unallocated card costs and exact shipping, never average card costs', () => {
  const draft = { ...createPurchaseDraft(true), pricingMode: 'lot-total' as const, lotTotal: '100.00' };
  const prepared = preparePurchaseDraft('owner', draft, at);
  expect(prepared.plan.purchase.payable.minor).toBe(11200);
  expect(prepared.lot?.allocation).toBe('unallocated');
  expect(prepared.plan.copies.every(c => c.cardCost.status === 'unallocated')).toBe(true);
  expect(prepared.plan.copies.every(c => c.shippingCost.status === 'exact')).toBe(true);
});
it('links only the new copies to optional shipment evidence without fabricating tracking events', () => {
  const draft = { ...createPurchaseDraft(true), carrier: 'Royal Mail', trackingNumber: 'DEMO-123' };
  const prepared = preparePurchaseDraft('owner', draft, at);
  expect(prepared.memberships.map(m => m.copyId)).toEqual(prepared.plan.copies.map(c => c.id));
  expect(prepared.snapshot).toMatchObject({ status: 'pending', events: [], ownerUid: 'owner' });
  expect(prepared.shipment?.trackingNumber).toBe('DEMO-123');
});
it('rejects missing sellers/cards, duplicate copy identity, unsafe values and malformed decimal input', () => {
  const draft = createPurchaseDraft(true);
  expect(previewPurchaseDraft({ ...draft, source: 'manual', seller: ' ' }).issues).toContainEqual({ field: 'seller', code: 'seller' });
  expect(previewPurchaseDraft({ ...draft, cards: [] }).issues).toContainEqual({ field: 'cards', code: 'cards' });
  expect(previewPurchaseDraft({ ...draft, cards: [draft.cards[0]!, draft.cards[0]!] }).issues).toContainEqual({ field: 'cards', code: 'duplicate' });
  for (const shipping of ['-1', '1.001', '1e4', '900719925474099.99']) expect(previewPurchaseDraft({ ...draft, shipping }).issues.length).toBeGreaterThan(0);
});
