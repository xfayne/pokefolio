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
  expect(() =>
    purchaseCommit(
      'owner',
      { ...restored, cards: restored.cards.slice(1) },
      at,
      initial.creates,
    ),
  ).toThrow();
});
it('rejects foreign owners and preserves per-copy possession during edits', () => {
  const draft = createPurchaseDraft(true);
  const initial = purchaseCommit('owner', draft, at);
  const records = initial.creates.map((e) =>
    e.collection === 'copies'
      ? { ...e, record: { ...e.record, possession: 'received' as const } }
      : e,
  );
  const edited = purchaseCommit(
    'owner',
    draft,
    '2026-11-21T09:00:00Z',
    records,
  );
  expect(
    edited.updates
      .filter((e) => e.after.collection === 'copies')
      .every(
        (e) =>
          e.after.collection === 'copies' &&
          e.after.record.possession === 'received',
      ),
  ).toBe(true);
  expect(() => prepareCommit('foreign', initial, 450)).toThrow();
});
