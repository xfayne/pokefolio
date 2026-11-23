import { it, expect } from 'vitest';
import { createPurchaseDraft } from '@/features/transactions/purchase-draft-seed';
import { purchaseCommit, draftFromPurchase } from './purchase-commit';
import { prepareCommit } from './persistence';
const at = '2026-11-21T08:00:00Z';
it('round trips original costs, edition and references, and audits every changed record', () => {
  const draft = {
    ...createPurchaseDraft(true),
    listingUrl: 'https://www.ebay.com/itm/123',
    itemReference: 'ORDER-123',
  };
  draft.cards[0]!.catalog = {
    ...draft.cards[0]!.catalog,
    kind: 'identified',
    cardId: 'base1-4',
    edition: 'first-edition',
    language: { status: 'known', value: 'en', source: 'user' },
    finish: { status: 'known', value: 'holo', source: 'user' },
  };
  const initial = purchaseCommit('owner', draft, at);
  expect(prepareCommit('owner', initial, 450)).toEqual(initial);
  const restored = draftFromPurchase(initial.creates, draft.id);
  expect(restored.listingUrl).toBe(draft.listingUrl);
  expect(restored.cards[0]!.catalog).toMatchObject({
    edition: 'first-edition',
  });
  const edited = purchaseCommit(
    'owner',
    { ...restored, shipping: '1.00' },
    '2026-11-21T09:00:00Z',
    initial.creates,
  );
  expect(prepareCommit('owner', edited, 450)).toEqual(edited);
  expect(edited.creates).toHaveLength(edited.updates.length);
  expect(
    edited.updates
      .filter((e) => e.after.collection === 'copies')
      .map((e) => e.after.record),
  ).toMatchObject([
    { shippingCost: { value: { minor: 34 } } },
    { shippingCost: { value: { minor: 33 } } },
    { shippingCost: { value: { minor: 33 } } },
  ]);
  const removed = purchaseCommit(
    'owner',
    { ...restored, cards: restored.cards.slice(1) },
    '2026-11-21T09:00:00Z',
    initial.creates,
  );
  expect(prepareCommit('owner',removed,450)).toEqual(removed);
  const removedCopy = removed.updates.find(update =>
    update.before.collection==='copies' && update.before.record.id===restored.cards[0]!.id);
  expect(removedCopy?.after).toMatchObject({collection:'copies',record:{removedFromPurchase:true}});
  if (removedCopy?.before.collection!=='copies' || removedCopy.after.collection!=='copies') throw Error('Missing removed copy');
  expect(removedCopy.after.record.acquiredOn).toEqual(removedCopy.before.record.acquiredOn);
  expect(removed.creates.some(entry=>entry.collection==='revisions' && entry.record.recordId===removedCopy.before.record.id)).toBe(true);
  const result = [...initial.creates.map(entry=>
    removed.updates.find(update=>update.before.collection===entry.collection && update.before.record.id===entry.record.id)?.after??entry),
    ...removed.creates.filter(entry=>entry.collection!=='revisions')];
  expect(draftFromPurchase(result,draft.id).cards.map(card=>card.id))
    .toEqual(restored.cards.slice(1).map(card=>card.id));
});
it('rejects foreign owners and preserves per-copy possession during edits', () => {
  const draft = createPurchaseDraft(true);
  const initial = purchaseCommit('owner', draft, at);
  const records = initial.creates.map((e) =>
    e.collection === 'copies'
      ? { ...e, record: { ...e.record, possession: 'received' as const } }
      : e,
  );
  expect(() => purchaseCommit('owner', draft, '2026-11-21T09:00:00Z', records)).toThrow('received');
  expect(() => prepareCommit('foreign', initial, 450)).toThrow();
});
it('edits tracking atomically and supports adding and clearing tracking evidence',()=>{
 const draft=createPurchaseDraft(true);const before=purchaseCommit('owner',draft,at).creates;
 const withTracking={...draft,trackingNumber:'SYNTHETIC-NEW',carrier:'Test carrier'};
 const added=purchaseCommit('owner',withTracking,'2026-11-21T09:00:00Z',before);
 expect(added.creates.some(e=>e.collection==='shipments')).toBe(true);
 const current=[...before.map(e=>added.updates.find(u=>u.before.record.id===e.record.id)?.after??e),...added.creates.filter(e=>e.collection!=='revisions')];
 const changed=purchaseCommit('owner',{...withTracking,trackingNumber:'SYNTHETIC-CHANGED'},'2026-11-21T10:00:00Z',current);
 expect(changed.updates.find(u=>u.after.collection==='shipments')?.after.record).toMatchObject({trackingNumber:'SYNTHETIC-CHANGED'});
 const cleared=purchaseCommit('owner',draft,'2026-11-21T10:00:00Z',current);
 expect(cleared.updates.find(u=>u.after.collection==='shipments')?.after.record).toMatchObject({trackingNumber:null});
});

it('never changes physical card acquiredOn when an ordinary purchase transaction date changes', () => {
  const draft = createPurchaseDraft(true);
  const original = purchaseCommit('owner', draft, at).creates;
  const changed = purchaseCommit('owner', { ...draft, date: '2026-11-23' }, '2026-11-23T09:00:00Z', original);
  const copyChanges = changed.updates.filter(e => e.before.collection === 'copies' && e.after.collection === 'copies');
  expect(copyChanges).toHaveLength(draft.cards.length);
  for (const change of copyChanges) {
    if (change.before.collection !== 'copies' || change.after.collection !== 'copies') throw Error('Missing copy');
    expect(change.after.record.acquiredOn).toEqual(change.before.record.acquiredOn);
    expect(change.after.record.acquisition).toEqual(change.before.record.acquisition);
  }
  expect(changed.updates.find(e => e.after.collection === 'transactions')?.after.record).toMatchObject({ transactionOn: '2026-11-23' });
});
