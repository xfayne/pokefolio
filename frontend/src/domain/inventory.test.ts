import { describe, it, expect } from 'vitest';
import { copy, catalog, known, gbp, metadata, unknown } from './fixtures.test-support';
import { inspectBinder, planCopyMetadataEdit, selectInventory } from './inventory';
import { planSale, receiveCopy } from './lifecycle';
import type { CardCopy } from './schema';

const sibling: CardCopy = { ...copy, id: 'copy-b', condition: known('NM'), cardCost: { status: 'exact', value: gbp(3000), evidenceRef: 'purchase' } };
const pending: CardCopy = { ...copy, id: 'copy-pending', possession: 'pending' };
const cards = [{ id: 'base3-5', name: 'Gengar', setName: 'Fossil', number: '5', imageUrl: 'https://images.pokemontcg.io/base3/5.png' }];
const quotes = [{ catalog, condition: 'LP', money: gbp(4000), observedAt: metadata.updatedAt, source: 'fixture' }, { catalog, condition: 'NM', money: gbp(6000), observedAt: metadata.updatedAt, source: 'fixture' }];

describe('physical-copy inventory', () => {
  it('groups distinct copies, values received holdings once and separates pending/sold/unknown possession', () => {
    const sold = { ...copy, id: 'sold-copy', disposition: 'sold', dispositionRecordId: 'sale' };
    const result = selectInventory('owner', [copy, sibling, pending, sold, { ...copy, id: 'unknown-copy', possession: 'unknown' }], cards, quotes, 'GBP');
    expect(result.groups).toHaveLength(1);
    expect(result.counts).toEqual({ catalogCards: 1, received: 2, pending: 1, unknownPossession: 1, sold: 1, otherDisposed: 0 });
    expect(result.market).toEqual({ currency: 'GBP', minor: 10000, pricedCount: 2, missingCount: 0 });
    expect(result.groups[0]!.copies.map(v => v.copy.id)).toEqual(['copy-a', 'copy-b', 'copy-pending', 'unknown-copy']);
  });
  it('matches grade/edition/language/finish/currency, reports partial coverage and keeps zero distinct from missing', () => {
    const first = { ...sibling, id: 'first-edition', catalog: { ...catalog, edition: 'first-edition' } };
    const r = selectInventory('owner', [copy, first, { ...copy, id: 'no-condition', condition: unknown }], cards, [{ ...quotes[0]!, money: gbp(0) }, { ...quotes[0]!, money: { currency: 'USD', minor: 50000 } }], 'GBP');
    expect(r.market).toEqual({ currency: 'GBP', minor: 0, pricedCount: 1, missingCount: 2 });
    expect(selectInventory('owner', [copy], cards, [quotes[0], { ...quotes[0]!, money: gbp(5000) }], 'GBP').market.missingCount).toBe(1);
    expect(selectInventory('owner', [copy], cards, [{ ...quotes[0]!, catalog: { ...catalog, language: known('ja') } }], 'GBP').market.pricedCount).toBe(0);
  });
  it('edits only selected metadata with immutable audit, no costs/identity/lifecycle or sibling changes', () => {
    const original = structuredClone([copy, sibling, pending]);
    const plan = planCopyMetadataEdit('owner', copy, { condition: known('NM'), edition: 'first-edition', notes: 'One copy only' }, '2026-11-21T10:00:00Z', 'edit-a', 'Correct details')!;
    expect(plan.change.after.revision).toBe(copy.revision + 1);
    expect(plan.change.after.cardCost).toEqual(copy.cardCost);
    expect(plan.change.after.acquisition).toEqual(copy.acquisition);
    expect(plan.audit.before).toEqual(copy);
    expect(plan.audit.after).toEqual(plan.change.after);
    expect([copy, sibling, pending]).toEqual(original);
    expect(planCopyMetadataEdit('owner', copy, { notes: copy.notes }, metadata.updatedAt, 'unused', 'No change')).toBeNull();
    expect(() => planCopyMetadataEdit('owner', copy, { cardCost: { status: 'unknown' } }, metadata.updatedAt, 'edit-a', 'Invalid')).toThrow();
  });
  it('keeps exact binder indexes through receipt and sale, including holes and pending references', () => {
    const pockets = [{ kind: 'copy', copyId: copy.id }, { kind: 'empty', token: '__binder_empty__:1' }, { kind: 'copy', copyId: pending.id }, { kind: 'wish', cardId: 'base2-11' }, ...Array.from({ length: 6 }, (_, n) => ({ kind: 'empty', token: `empty-${n}` }))];
    const before = structuredClone(pockets);
    const sale = { ...metadata, id: 'sale', kind: 'sale', transactionOn: '2026-11-21', currency: 'GBP', source: { kind: 'manual', seller: null, listingUrl: null, itemReference: null }, notes: '', cardProceeds: known(gbp(5000)), buyerShipping: known(gbp(0)), sellingFees: known(gbp(0)), sellerShipping: known(gbp(0)), sellingTaxes: known(gbp(0)) };
    const saleLine = { ...metadata, id: 'sale-line', transactionId: 'sale', copyId: copy.id, proceeds: { status: 'exact', value: gbp(5000), evidenceRef: 'sale' }, expenses: { status: 'exact', value: gbp(0), evidenceRef: 'sale' } };
    const sold = planSale('owner', sale, [saleLine], [copy], '2026-11-21T10:00:00Z').changes[0]!.after;
    const received = receiveCopy('owner', pending, '2026-11-21T10:00:00Z')!.after;
    const slots = inspectBinder('owner', pockets, [sold, sibling, received]);
    expect(slots[0]!.copy?.id).toBe(copy.id);
    expect(slots[0]!.copy?.disposition).toBe('sold');
    expect(slots[2]!.copy?.id).toBe(pending.id);
    expect(slots[9]!.page).toBe(1);
    expect(pockets).toEqual(before);
    expect(selectInventory('owner', [sold, sibling, received], cards, quotes, 'GBP').counts.received).toBe(2);
    expect(sibling.condition).toEqual(known('NM'));
  });
  it('rejects foreign/duplicate identities and retains unidentified or missing-catalog copies', () => {
    expect(() => selectInventory('owner', [copy, copy], cards, quotes, 'GBP')).toThrow('Duplicate');
    expect(() => selectInventory('other', [copy], cards, quotes, 'GBP')).toThrow('Foreign');
    const r = selectInventory('owner', [copy, { ...sibling, catalog: { kind: 'unidentified', description: 'Counted lot card' } }], [], [], 'GBP');
    expect(r.groups).toHaveLength(2);
    expect(r.groups.every(g => g.card === null)).toBe(true);
    expect(r.market.missingCount).toBe(2);
  });
});
