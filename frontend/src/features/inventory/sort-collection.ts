import type { InventoryGroup } from '@/domain/inventory';
import { compareMarketChanges, type MarketChange } from './market-change';

export type CollectionSort = 'value' | 'name' | 'copies' | 'acquired' | 'setNumber' | 'marketChangeDesc' | 'marketChangeAsc';
type VisibleMarket = InventoryGroup['market'];

function label(group: InventoryGroup): string {
  return group.card?.name ?? (group.copies[0]?.copy.catalog.kind === 'unidentified'
    ? group.copies[0].copy.catalog.description : group.key);
}

/** Each grouped catalog card sorts by its newest known purchase/acquisition date. */
export function newestAcquiredOn(group: InventoryGroup): string | null {
  return group.copies.reduce<string | null>((latest, { copy }) => {
    if (copy.acquiredOn.status !== 'known') return latest;
    return latest === null || copy.acquiredOn.value > latest ? copy.acquiredOn.value : latest;
  }, null);
}

function compareKnownDates(a: string | null, b: string | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return b.localeCompare(a);
}

function numericCardNumber(value: string | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = /^\d+/.exec(value);
  return parsed ? Number(parsed[0]) : Number.POSITIVE_INFINITY;
}

export function compareCollectionGroups(
  a: InventoryGroup,
  b: InventoryGroup,
  sort: CollectionSort,
  market: (group: InventoryGroup) => VisibleMarket,
  locale = 'en',
  change?: (group:InventoryGroup)=>MarketChange|undefined,
): number {
  const tie = () => label(a).localeCompare(label(b), locale) || a.key.localeCompare(b.key);
  if (sort === 'marketChangeDesc' || sort === 'marketChangeAsc') return compareMarketChanges(change?.(a),change?.(b),sort==='marketChangeAsc') || tie();
  if (sort === 'copies') return b.copies.length - a.copies.length || tie();
  if (sort === 'acquired') return compareKnownDates(newestAcquiredOn(a), newestAcquiredOn(b)) || tie();
  if (sort === 'setNumber') {
    // Unidentified cards have no meaningful catalog position.
    if (!a.card) return b.card ? 1 : tie();
    if (!b.card) return -1;
    return a.card.setName.localeCompare(b.card.setName, locale)
      || numericCardNumber(a.card.number) - numericCardNumber(b.card.number)
      || a.card.number.localeCompare(b.card.number, locale, { numeric: true })
      || tie();
  }
  if (sort === 'value') {
    const x = market(a);
    const y = market(b);
    return Number(y.pricedCount > 0) - Number(x.pricedCount > 0) || y.minor - x.minor || tie();
  }
  return tie();
}
