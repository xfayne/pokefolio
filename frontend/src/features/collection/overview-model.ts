import { catalogIdentity, selectInventory, type CopyQuote, type InventoryCatalogCard } from '@/domain/inventory';
import { referenceConverter, type FxRow } from '@/domain/performance';
import { compareCopyToMarket, summarizeMarketChange, type MarketChange } from '../inventory/market-change';
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
  const comparisons: Holding[] = inventory.groups.flatMap(group => group.card ? group.copies.flatMap(view => {
    if (view.copy.possession !== 'received' && view.copy.possession !== 'pending') return [];
    return [{copy:view.copy,card:group.card!,...compareCopyToMarket(view,input.currency,historical,input.convert)}];
  }) : []);
  const holdings = comparisons.filter(holding => holding.copy.possession === 'received');
  const pendingKnown = comparisons.filter(holding=>holding.copy.possession==='pending'&&holding.market!==null);
  const pendingValue = safeInteger(pendingKnown.reduce((sum,holding)=>sum+BigInt(holding.market!),0n));
  const byCopy = new Map(comparisons.map(holding=>[holding.copy.id,holding]));
  const changes = inventory.groups.flatMap(group=> {
    if (!group.card) return [];
    const eligible = group.copies.filter(view=>view.copy.possession==='received'||view.copy.possession==='pending');
    const change: MarketChange = summarizeMarketChange(eligible.map(view=>byCopy.get(view.copy.id)!));
    return eligible.length ? [{card:group.card,copyId:eligible[0]!.copy.id,change}] : [];
  });
  // Match Dashboard: rank received physical copies, not catalog-group sums.
  const pricedHoldings = holdings.filter(holding=>holding.market!==null);
  const total = safeInteger(pricedHoldings.reduce((sum,holding)=>sum+BigInt(holding.market!),0n));
  const top = [...pricedHoldings].sort((a,b)=>b.market!-a.market!||a.copy.id.localeCompare(b.copy.id)).slice(0,10);
  return {
    received: inventory.counts.received, pending: inventory.counts.pending, unknown: inventory.counts.unknownPossession,
    holdings, top, total, pendingValue, pendingPriced: pendingKnown.length, priced: holdings.filter(holding => holding.market !== null).length,
    changes, compared: comparisons.filter(holding => holding.gain !== null).length,
    comparableTotal: inventory.counts.received + inventory.counts.pending,
    above: comparisons.filter(holding => holding.gain !== null && holding.gain > 0).sort((a,b) => b.gain! - a.gain! || a.copy.id.localeCompare(b.copy.id)).slice(0,3),
    below: comparisons.filter(holding => holding.gain !== null && holding.gain < 0).sort((a,b) => a.gain! - b.gain! || a.copy.id.localeCompare(b.copy.id)).slice(0,3),
  };
}

export type BreakdownMode = 'value' | 'quantity';
export function selectCollectionBreakdown(
  figures: Pick<ReturnType<typeof selectCollectionOverview>, 'received' | 'pending' | 'total' | 'priced' | 'pendingValue' | 'pendingPriced'>,
  budget: ReturnType<typeof selectWishlistBudget>, mode: BreakdownMode,
) {
  const categories = [
    {key:'received' as const, count:figures.received, minor:figures.priced || !figures.received ? figures.total : null, covered:figures.priced},
    {key:'pending' as const, count:figures.pending, minor:figures.pendingPriced || !figures.pending ? figures.pendingValue : null, covered:figures.pendingPriced},
    {key:'wishlist' as const, count:budget.total, minor:budget.minor, covered:budget.covered},
  ];
  const count = categories.reduce((sum, item) => sum + item.count, 0);
  const covered = categories.reduce((sum, item) => sum + item.covered, 0);
  const minor = covered || !count ? safeInteger(categories.reduce((sum, item) => sum + BigInt(item.minor ?? 0), 0n)) : null;
  const total = mode === 'value' ? minor : count;
  return { total, count, covered, categories: categories.map(item => {
    const amount = mode === 'value' ? item.minor : item.count;
    return {...item, amount, share: amount !== null && total !== null && total > 0 ? amount / total : null};
  }) };
}
