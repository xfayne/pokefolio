import { expect, it } from 'vitest';
import { purchaseCommit } from './purchase-commit';
import { createPurchaseDraft } from '@/features/transactions/purchase-draft-seed';
import { importedPurchaseEditCommit, importedPurchaseEditDraft, validateImportedPurchaseEdit } from './imported-purchase-edit';
import { importedPurchaseFormSeed, importedPurchaseFormCommit, requireCompleteImportedDraft } from './imported-purchase-form';
import { portfolioRecordSchema, prepareCommit, type PortfolioRecord } from './persistence';
import { importedPurchaseSchema } from './schema';

const at = '2026-11-23T08:00:00Z';
function fixture(): PortfolioRecord[] {
  const draft = createPurchaseDraft(true);
  const original = purchaseCommit('owner', draft, at).creates;
  const transaction = original.find(e => e.collection === 'transactions')!;
  const copies = original.filter(e => e.collection === 'copies');
  const amounts = copies.map((e, index) => {
    if (e.collection !== 'copies') throw Error('Bad copy');
    return index === 0 ? { currency: 'GBP' as const, minor: 1000 } : index === 1 ? { currency: 'EUR' as const, minor: 750 } : null;
  });
  const tx = importedPurchaseSchema.parse({
    schemaVersion: 1, id: transaction.record.id, ownerUid: 'owner', revision: 1,
    createdAt: at, updatedAt: at, kind: 'purchase', origin: 'legacy-import',
    transactionOn: { status: 'known', value: '2026-11-20', source: 'legacy' },
    currency: { status: 'unknown', reason: 'Mixed currencies' }, sourceParcelId: 'parcel-1',
    notes: 'Original parcel note', subtotal: { status: 'unknown', reason: 'Mixed currencies' },
    payable: { status: 'unknown', reason: 'Mixed currencies' },
    nativeCardTotals: [{ currency: 'GBP', minor: 1000 }, { currency: 'EUR', minor: 750 }],
    unpricedCopyCount: 1, shippingIncludedInCardPrices: true,
    shipping: { status: 'unknown', reason: 'Mixed currencies' },
    taxes: { status: 'unknown', reason: 'Unknown' }, fees: { status: 'unknown', reason: 'Unknown' },
    totalBasis: 'recorded-card-prices', settlement: 'unknown',
  });
  return [
    { collection: 'transactions', record: tx },
    ...original.filter(e => e.collection === 'lines').map((e, index) => {
      if (e.collection !== 'lines') throw Error('Bad line');
      const amount = amounts[index];
      return portfolioRecordSchema.parse({ collection: 'lines', record: {
        ...e.record, origin: 'legacy-import', pricing: { mode: 'per-copy', unitPrice: amount
          ? { status: 'known', value: amount, source: 'legacy' }
          : { status: 'unknown', reason: 'Not recorded' } },
      } });
    }),
    ...copies.map((e, index) => {
      if (e.collection !== 'copies') throw Error('Bad copy');
      const amount = amounts[index];
      return portfolioRecordSchema.parse({ collection: 'copies', record: {
        ...e.record, possession: index === 2 ? 'pending' : 'received',
        acquiredOn: { status: 'known', value: '2026-10-15', source: 'legacy' },
        notes: 'Keep this copy note',
        cardCost: amount ? { status: 'exact', value: amount, evidenceRef: transaction.record.id } : { status: 'unknown', reason: 'No original price' },
        shippingCost: amount ? { status: 'exact', value: { currency: amount.currency, minor: 0 }, evidenceRef: transaction.record.id } : { status: 'unknown', reason: 'No currency' },
      } });
    }),
  ];
}
it('edits a mixed-currency imported purchase and preserves every physical-copy acquisition date and relationship', () => {
  const before = fixture();
  const draft = importedPurchaseEditDraft(before, before[0]!.record.id);
  expect(draft.cards.map(c => c.currency)).toEqual(['GBP', 'EUR', 'GBP']);
  const edited = { ...draft, date: '2026-11-22', notes: 'Edited parcel note',
    cards: draft.cards.map((card, index) => index === 0 ? { ...card, amount: '12.50' } : index === 2 ? { ...card, currency: 'USD' as const, amount: '3.00' } : card) };
  const command = importedPurchaseEditCommit('owner', edited, '2026-11-23T09:00:00Z', before)!;
  expect(prepareCommit('owner', command, 450)).toEqual(command);
  expect(validateImportedPurchaseEdit(command)).toBe(true);
  expect(command.creates.every(e => e.collection === 'revisions')).toBe(true);
  expect(command.updates).toHaveLength(5); // Two copy/line pairs plus their original purchase.
  const updated = command.updates.find(e => e.after.collection === 'transactions')!.after;
  if (updated.collection !== 'transactions' || !('origin' in updated.record)) throw Error('Invalid update');
  expect(updated.record).toMatchObject({
    origin: 'legacy-import', sourceParcelId: 'parcel-1', notes: 'Edited parcel note',
    transactionOn: { status: 'known', value: '2026-11-22', source: 'user' },
    nativeCardTotals: [{ currency: 'EUR', minor: 750 }, { currency: 'GBP', minor: 1250 }, { currency: 'USD', minor: 300 }],
    unpricedCopyCount: 0, settlement: 'unknown',
  });
  for (const update of command.updates) if (update.before.collection === 'copies' && update.after.collection === 'copies') {
    expect(update.after.record.acquiredOn).toEqual(update.before.record.acquiredOn);
    expect(update.after.record.acquisition).toEqual(update.before.record.acquisition);
    expect(update.after.record.possession).toEqual(update.before.record.possession);
    expect(update.after.record.disposition).toEqual(update.before.record.disposition);
    expect(update.after.record.notes).toEqual(update.before.record.notes);
  }
  expect(command.updates.every(u => !['shipments', 'memberships'].includes(u.before.collection))).toBe(true);
});
it('keeps copy dates and financial evidence unchanged for a date-only correction', () => {
  const original = fixture();
  const draft = importedPurchaseEditDraft(original, original[0]!.record.id);
  const command = importedPurchaseEditCommit('owner', { ...draft, date: '2026-11-21' }, '2026-11-23T09:00:00Z', original)!;
  expect(command.updates).toHaveLength(1);
  expect(command.updates[0]!.before.collection).toBe('transactions');
  expect(command.updates.some(e => e.before.collection === 'copies')).toBe(false);
  expect(validateImportedPurchaseEdit(command)).toBe(true);
});
it('rejects changing acquiredOn or a sale-linked copy during imported edits', () => {
  const original = fixture();
  const draft = importedPurchaseEditDraft(original, original[0]!.record.id);
  const command = importedPurchaseEditCommit('owner', { ...draft, cards: draft.cards.map((c,i) => i===0 ? {...c, amount:'15.00'} : c) }, '2026-11-23T09:00:00Z', original)!;
  const bad = structuredClone(command);
  const copyUpdate = bad.updates.find(e => e.after.collection === 'copies')!;
  if (copyUpdate.after.collection !== 'copies') throw Error('Missing copy');
  copyUpdate.after.record.acquiredOn = { status: 'known', value: '2026-11-22', source: 'user' };
  expect(() => validateImportedPurchaseEdit(bad)).toThrow('dates');
  const sold = original.map(e => e.collection === 'copies' ? portfolioRecordSchema.parse({ ...e, record: { ...e.record, disposition: 'sold', dispositionRecordId: 'sale-1' } }) : e);
  expect(() => importedPurchaseEditDraft(sold, original[0]!.record.id)).toThrow('cannot be edited');
});

it('edits condition, adds a physical copy and reversibly removes an imported copy without deleting original evidence', () => {
  const records = fixture(), id = records[0]!.record.id;
  const draft = importedPurchaseEditDraft(records, id);
  const newCard = { ...draft.cards[0]!, id: 'copy-added', amount: '8.00', condition: 'LP' as const };
  const correctedCondition = draft.cards[1]!.condition === 'NM' ? 'LP' as const : 'NM' as const;
  const input = { ...draft, cards: [...draft.cards.slice(1).map((card,index) =>
    index === 0 ? { ...card, condition: correctedCondition } : card), newCard] };
  const command = importedPurchaseEditCommit('owner', input, '2026-11-23T09:00:00Z', records)!;
  expect(validateImportedPurchaseEdit(command)).toBe(true);
  expect(prepareCommit('owner', command, 450)).toEqual(command);
  const removed = command.updates.find(u => u.before.record.id === draft.cards[0]!.id);
  expect(removed?.after).toMatchObject({ collection: 'copies', record: { removedFromImport: true } });
  const corrected = command.updates.find(u => u.before.record.id === draft.cards[1]!.id);
  expect(corrected?.after).toMatchObject({ collection: 'copies', record: { condition: { status: 'known', value: correctedCondition, source: 'user' } } });
  const added = command.creates.find(e => e.collection === 'copies' && e.record.id === 'copy-added');
  expect(added).toMatchObject({collection:'copies',record:{
    acquisition:{kind:'purchase',transactionId:id},acquiredOn:{status:'known',value:'2026-11-20',source:'user'},
    condition:{status:'known',value:'LP',source:'user'},cardCost:{status:'exact',value:{minor:800,currency:'GBP'}},
  }});
  expect(command.creates.some(e => e.collection === 'lines' && e.record.transactionId === id)).toBe(true);
  expect(command.creates.some(e => e.collection === 'revisions' && e.record.recordId === draft.cards[0]!.id)).toBe(true);
  expect(command.updates.filter(e=>e.before.collection==='copies').every(e=>
    e.before.collection==='copies' && e.after.collection==='copies' &&
    JSON.stringify(e.before.record.acquiredOn)===JSON.stringify(e.after.record.acquiredOn))).toBe(true);
  const after = [
    ...records.map(entry => command.updates.find(u=>u.before.collection===entry.collection && u.before.record.id===entry.record.id)?.after??entry),
    ...command.creates.filter(entry=>entry.collection!=='revisions'),
  ];
  expect(importedPurchaseEditDraft(after,id).cards.map(card=>card.id))
    .toEqual([draft.cards[1]!.id,draft.cards[2]!.id,'copy-added']);
});

it('shares ordinary form validation: ambiguous imported currency and missing card prices block saving',()=>{
  const original=fixture(), id=original[0]!.record.id;
  const seed=importedPurchaseFormSeed(original,id);
  expect(seed.currencyChosen).toBe(false);
  expect(seed.draft.cards).toHaveLength(3);
  expect(seed.draft.cards.every(card=>card.amount==='')).toBe(true);
  expect(()=>requireCompleteImportedDraft(seed.draft,false)).toThrow('Choose');
  expect(()=>importedPurchaseFormCommit('owner',seed.draft,'2026-11-23T09:00:00Z',original,false)).toThrow('Choose');
  const chosen={...seed.draft,currency:'GBP' as const};
  expect(()=>requireCompleteImportedDraft(chosen)).toThrow('All cards need prices');
  const withPrices={...chosen,cards:chosen.cards.map((card,index)=>({...card,amount:['10.00','7.50','5.00'][index]!}))};
  const command=importedPurchaseFormCommit('owner',withPrices,'2026-11-23T09:00:00Z',original)!;
  expect(prepareCommit('owner',command,450)).toEqual(command);
  expect(validateImportedPurchaseEdit(command)).toBe(true);
  const purchase=command.updates.find(u=>u.after.collection==='transactions')?.after;
  expect(purchase).toMatchObject({collection:'transactions',record:{
    origin:'legacy-import',sourceParcelId:'parcel-1',
    currency:{status:'known',value:'GBP'},
    subtotal:{status:'known',value:{currency:'GBP',minor:2250}},
    nativeCardTotals:[{currency:'GBP',minor:2250}],unpricedCopyCount:0,
    shipping:{status:'unknown'},
  }});
  expect(command.updates.filter(u=>u.before.collection==='copies').every(u=>
    u.before.collection==='copies' && u.after.collection==='copies' &&
    JSON.stringify(u.before.record.acquiredOn)===JSON.stringify(u.after.record.acquiredOn))).toBe(true);
});
