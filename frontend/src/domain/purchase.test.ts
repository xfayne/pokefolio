import { describe, expect, it } from 'vitest';
import { costBasis } from './money';
import { planPurchase, type CopySeed } from './purchase';
import { gbp, known, lines, metadata, purchase, unknown } from './fixtures.test-support';

const seeds: CopySeed[] = [
  { id: 'copy-a', lineId: 'line-a', unitOrdinal: 0, condition: known('LP'), possession: 'pending', notes: '' },
  { id: 'copy-b', lineId: 'line-a', unitOrdinal: 1, condition: known('MP'), possession: 'received', notes: '' },
  { id: 'copy-c', lineId: 'line-b', unitOrdinal: 0, condition: unknown, possession: 'pending', notes: '' },
];
const payment = { ...metadata, id: 'payment', transactionId: 'purchase', direction: 'out', purpose: 'purchase', money: gbp(7100), effectiveOn: known('2026-11-20'), idempotencyKey: 'initial-payment', relatedRecordId: null };

describe('purchase construction', () => {
  it('creates distinct duplicates and reconciles paid costs regardless of input order', () => {
    const plan = planPurchase('owner', purchase, [...lines].reverse(), [...seeds].reverse(), payment);
    expect(plan.copies.map((c) => c.id)).toEqual(['copy-a', 'copy-b', 'copy-c']);
    expect(plan.copies.map((c) => costBasis([c.cardCost, c.shippingCost, c.taxCost, c.feeCost], 'GBP'))).toEqual([
      { status: 'exact', currency: 'GBP', minor: 2034 }, { status: 'exact', currency: 'GBP', minor: 2033 }, { status: 'exact', currency: 'GBP', minor: 3033 },
    ]);
    expect(plan.copies[0]?.condition).toEqual(known('LP'));
    expect(plan.copies[1]?.condition).toEqual(known('MP'));
  });
  it('keeps total-priced lots unallocated and includes unidentified copies in shipping', () => {
    const lot = { ...purchase, pricingMode: 'lot-total', lotId: 'lot', subtotal: known(gbp(9000)), shipping: known(gbp(600)), payable: gbp(9600) };
    const lotLines = lines.map((line) => ({ ...line, catalog: { kind: 'unidentified', description: 'Card pending identification' }, pricing: { mode: 'lot-total', lotId: 'lot' } }));
    const plan = planPurchase('owner', lot, lotLines, seeds, { ...payment, money: gbp(9600) });
    expect(plan.copies.map((c) => c.cardCost)).toEqual(Array(3).fill({ status: 'unallocated', lotId: 'lot' }));
    expect(plan.copies.map((c) => c.shippingCost)).toEqual(Array(3).fill({ status: 'exact', value: gbp(200), evidenceRef: 'purchase' }));
    expect(costBasis([plan.copies[0]!.cardCost, plan.copies[0]!.shippingCost], 'GBP').status).toBe('unavailable');
  });
  it('preserves unknown charges and refuses under-specified ordinary prices', () => {
    const plan = planPurchase('owner', { ...purchase, taxes: unknown }, lines, seeds, payment);
    expect(plan.copies[0]?.taxCost).toEqual(unknown);
    expect(() => planPurchase('owner', { ...purchase, subtotal: unknown }, lines, seeds, payment)).toThrow();
  });
  it('accepts only explicit reconciled lot estimates and attributed taxes', () => {
    const lot = { ...purchase, pricingMode: 'lot-total', lotId: 'lot', subtotal: known(gbp(9000)), shipping: known(gbp(600)), payable: gbp(9600) };
    const lotLines = lines.map((line) => ({ ...line, pricing: { mode: 'lot-total', lotId: 'lot' } }));
    const lotCardCosts = seeds.map((seed, i) => ({ copyId: seed.id, cost: { status: 'estimated' as const, value: gbp([5000, 2500, 1500][i]!), method: 'User allocation' } }));
    const plan = planPurchase('owner', lot, lotLines, seeds, { ...payment, money: gbp(9600) }, { lotCardCosts });
    expect(plan.copies.map((c) => costBasis([c.cardCost, c.shippingCost], 'GBP'))).toEqual([5200, 2700, 1700].map((minor) => ({ status: 'estimated', currency: 'GBP', minor })));
    expect(() => planPurchase('owner', lot, lotLines, seeds, { ...payment, money: gbp(9600) }, { lotCardCosts: lotCardCosts.slice(1) })).toThrow();
    const taxed = { ...purchase, taxes: known(gbp(300)), payable: gbp(7400) };
    const taxCosts = seeds.map((seed, i) => ({ copyId: seed.id, cost: { status: 'exact' as const, value: gbp(i === 2 ? 300 : 0), evidenceRef: 'tax-receipt' } }));
    expect(planPurchase('owner', taxed, lines, seeds, { ...payment, money: gbp(7400) }, { taxCosts }).copies.map((c) => c.taxCost)).toEqual(taxCosts.map((x) => x.cost));
    expect(planPurchase('owner', taxed, lines, seeds, { ...payment, money: gbp(7400) }).copies.map((c) => c.taxCost)).toEqual(Array(3).fill({ status: 'exact', value: gbp(100), evidenceRef: 'purchase' }));
  });
  it('rejects foreign owners, duplicate IDs/units, wrong quantities and unreconciled payments', () => {
    expect(() => planPurchase('foreign', purchase, lines, seeds, payment)).toThrow();
    expect(() => planPurchase('owner', purchase, [{ ...lines[0], ownerUid: 'foreign' }, lines[1]], seeds, payment)).toThrow();
    expect(() => planPurchase('owner', purchase, lines, [seeds[0], seeds[0], seeds[2]], payment)).toThrow();
    expect(() => planPurchase('owner', purchase, lines, seeds.slice(1), payment)).toThrow();
    expect(() => planPurchase('owner', purchase, lines, seeds, null)).toThrow();
    expect(() => planPurchase('owner', purchase, lines, seeds, { ...payment, money: gbp(1) })).toThrow();
  });
  it('cannot rewrite organization state and does not mutate inputs', () => {
    const organization = { binderOrder: ['base3-5', '__binder_empty__:keep', 'base2-11'], wishOrder: ['base2-11', 'base3-5'] };
    const before = structuredClone({ purchase, lines, seeds, payment, organization });
    const plan = planPurchase('owner', purchase, lines, seeds, payment);
    expect({ purchase, lines, seeds, payment, organization }).toEqual(before);
    expect(plan).not.toHaveProperty('binderOrder');
    expect(() => planPurchase('owner', { ...purchase, ...organization }, lines, seeds, payment)).toThrow();
  });
});
