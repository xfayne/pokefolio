import { expect, it } from 'vitest';
import { selectInventory, visibleCopyMarket } from '@/domain/inventory';
import { createSampleCopies, sampleCatalog, sampleOwner, sampleQuotes } from './sample';
import { compareCollectionGroups, newestAcquiredOn } from './sort-collection';

const fixture = () => {
  const copies = createSampleCopies();
  // Same catalog card has two physical copies bought on different dates.
  copies[0] = { ...copies[0]!, acquiredOn: { status: 'known', value: '2026-10-15', source: 'user' } };
  copies[1] = { ...copies[1]!, acquiredOn: { status: 'known', value: '2026-11-20', source: 'user' } };
  copies[2] = { ...copies[2]!, acquiredOn: { status: 'unknown', reason: 'No purchase date' } };
  copies[3] = { ...copies[3]!, acquiredOn: { status: 'known', value: '2026-10-01', source: 'user' } };
  copies[4] = { ...copies[4]!, acquiredOn: { status: 'unknown', reason: 'No purchase date' } };
  return selectInventory(sampleOwner, copies, sampleCatalog, sampleQuotes, 'USD').groups;
};

it('sorts held catalog groups by the latest known purchase date among their physical copies', () => {
  const groups = fixture();
  const market = (g: typeof groups[number]) => visibleCopyMarket(g.copies, 'USD');
  const sorted = [...groups].sort((a, b) => compareCollectionGroups(a, b, 'acquired', market));
  expect(sorted.map(g => g.card?.name)).toEqual(['Charizard', 'Gengar', 'Snorlax']);
  expect(newestAcquiredOn(sorted[0]!)).toBe('2026-11-20');
  expect(newestAcquiredOn(sorted[1]!)).toBe('2026-10-01');
  expect(newestAcquiredOn(sorted[2]!)).toBeNull();
  expect(sorted[0]!.copies).toHaveLength(2);
});

it('sorts by series and numeric card number, not string digits', () => {
  const groups = fixture();
  const market = (g: typeof groups[number]) => visibleCopyMarket(g.copies, 'USD');
  const cards = groups.map(g => ({ ...g, card: g.card && { ...g.card, setName: 'Same set', number: g.card.name === 'Charizard' ? '10/100' : g.card.name === 'Gengar' ? '2/100' : '1/100' } }));
  const sorted = cards.sort((a, b) => compareCollectionGroups(a, b, 'setNumber', market));
  expect(sorted.map(g => g.card?.name)).toEqual(['Snorlax', 'Gengar', 'Charizard']);
});

it('preserves previous value, copies and name sort options', () => {
  const groups = fixture();
  const market = (g: typeof groups[number]) => visibleCopyMarket(g.copies, 'USD');
  for (const sort of ['value', 'copies', 'name'] as const) {
    expect([...groups].sort((a, b) => compareCollectionGroups(a, b, sort, market))).toHaveLength(3);
  }
});
