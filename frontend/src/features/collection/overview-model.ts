import { catalogIdentity, selectInventory, type CopyQuote, type InventoryCatalogCard } from '@/domain/inventory';
import { acquisitionBasis, referenceConverter, type FxRow } from '@/domain/performance';
import { safeInteger } from '@/domain/money';
import type { CardCopy, Condition, Currency, Money } from '@/domain/schema';
import { catalogMarketReference } from '@/features/catalog/catalog';

export function currentCopies(copies: readonly CardCopy[]) {
  return copies.filter(copy => copy.disposition === 'held' && !copy.removedFromImport && !copy.removedFromPurchase);
}

/** This is a projection only; Wishlist membership and priority are never changed. */
export function remainingWishes(copies: readonly CardCopy[], wishes: readonly string[]) {
  const acquired = new Set(currentCopies(copies).flatMap(copy =>
    copy.catalog.kind === 'identified' && ['received', 'pending'].includes(copy.possession) ? [copy.catalog.cardId] : []));
  return [...new Set(wishes)].filter(id => !acquired.has(id));
}

export function matchingQuote(quotes: readonly CopyQuote[], reference: CopyQuote['catalog'], condition: Condition) {
  const matches = quotes.filter(quote => quote.condition === condition && catalogIdentity(quote.catalog) === catalogIdentity(reference));
  const latest = Math.max(...matches.map(quote => Date.parse(quote.observedAt)));
  const rows = matches.filter(quote => Date.parse(quote.observedAt) === latest);
  const first = rows[0];
  return first && rows.every(row => row.money.currency === first.money.currency && row.money.minor === first.money.minor) ? first : null;
}

export function selectWishlistBudget(ids: readonly string[], quotes: readonly CopyQuote[], condition: Condition, convert: (money: Money) => number | null) {
  const values = [...new Set(ids)].map(id => {
    const quote = matchingQuote(quotes, catalogMarketReference(id), condition);
    return quote ? convert(quote.money) : null;
  });
  const known = values.filter((value): value is number => value !== null);
  return {
    minor: known.length || !values.length ? safeInteger(known.reduce((sum, value) => sum + BigInt(value), 0n)) : null,
    covered: known.length, total: values.length,
  };
}

export type Holding = { copy: CardCopy; card: InventoryCatalogCard; market: number | null; basis: number | null; gain: number | null; roi: number | null };

export function selectCollectionOverview(input: {
  owner: string; copies: readonly CardCopy[]; catalog: readonly InventoryCatalogCard[];
  quotes: readonly CopyQuote[]; currency: Currency; fx: readonly FxRow[]; convert: (money: Money) => number | null;
}) {
  const inventory = selectInventory(input.owner, input.copies, input.catalog, input.quotes, 'USD');
  const historical = referenceConverter(input.fx);
  const holdings: Holding[] = inventory.groups.flatMap(group => group.card ? group.copies.flatMap(view => {
    const copy = view.copy;
    if (copy.possession !== 'received') return [];
    // The current provider covers English only. Unknown/foreign language must not inherit its prices.
    const english = copy.catalog.kind === 'identified' && copy.catalog.language.status === 'known'
      && ['en', 'english'].includes(copy.catalog.language.value.toLowerCase());
    const market = english && view.market.status !== 'unavailable' ? input.convert(view.market) : null;
    const basis = acquisitionBasis([copy.cardCost, copy.shippingCost, copy.taxCost, copy.feeCost],
      copy.acquiredOn.status === 'known' ? copy.acquiredOn.value : null, input.currency, historical);
    const amount = basis.status === 'unavailable' ? null : basis.minor;
    const gain = market !== null && amount !== null ? safeInteger(BigInt(market) - BigInt(amount)) : null;
    return [{ copy, card: group.card!, market, basis: amount, gain, roi: gain !== null && amount !== null && amount > 0 ? gain / amount * 100 : null }];
  }) : []);
  // Concentration is by catalog card, aggregating its physical copies.
  const groups = new Map<string, { card: InventoryCatalogCard; copyId: string; minor: number }>();
  for (const holding of holdings) if (holding.market !== null) {
    const existing = groups.get(holding.card.id);
    groups.set(holding.card.id, { card: holding.card, copyId: existing?.copyId ?? holding.copy.id,
      minor: safeInteger(BigInt(existing?.minor ?? 0) + BigInt(holding.market)) });
  }
  const ranked = [...groups.values()].sort((a, b) => b.minor - a.minor || a.card.id.localeCompare(b.card.id));
  const total = safeInteger(ranked.reduce((sum, group) => sum + BigInt(group.minor), 0n));
  const top = ranked.slice(0, 5);
  const topValue = safeInteger(top.reduce((sum, group) => sum + BigInt(group.minor), 0n));
  return {
    received: inventory.counts.received, pending: inventory.counts.pending, unknown: inventory.counts.unknownPossession,
    holdings, top, total, topValue, priced: holdings.filter(holding => holding.market !== null).length,
    compared: holdings.filter(holding => holding.gain !== null).length,
    comparableTotal: inventory.counts.received,
    above: holdings.filter(holding => holding.gain !== null && holding.gain > 0).sort((a,b) => b.gain! - a.gain! || a.copy.id.localeCompare(b.copy.id)).slice(0,3),
    below: holdings.filter(holding => holding.gain !== null && holding.gain < 0).sort((a,b) => a.gain! - b.gain! || a.copy.id.localeCompare(b.copy.id)).slice(0,3),
  };
}
