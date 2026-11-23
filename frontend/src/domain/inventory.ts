import { z } from 'zod';
import { cardCopySchema, catalogRefSchema, conditionSchema, idSchema, moneySchema, type CardCopy, type Currency } from './schema';
import { auditCopyChange, type CopyChange } from './lifecycle';
import { costBasis, safeInteger, type Metric } from './money';

export const copyQuoteSchema = z.strictObject({
  catalog: catalogRefSchema, condition: conditionSchema, money: moneySchema,
  observedAt: z.iso.datetime(), source: z.string().trim().min(1).max(200),
});
export type CopyQuote = z.infer<typeof copyQuoteSchema>;
export type InventoryCatalogCard = Readonly<{ id: string; name: string; setName: string; number: string; imageUrl: string }>;
export type CopyView = Readonly<{ copy: CardCopy; paid: CardCopy['cardCost']; basis: Metric; market: Metric }>;
export type InventoryGroup = Readonly<{
  key: string; card: InventoryCatalogCard | null; copies: readonly CopyView[];
  receivedCount: number; pendingCount: number; unknownPossessionCount: number;
  market: Readonly<{ currency: Currency; minor: number; pricedCount: number; missingCount: number }>;
}>;
export type InventorySelection = Readonly<{
  groups: readonly InventoryGroup[];
  counts: Readonly<{ catalogCards: number; received: number; pending: number; unknownPossession: number; sold: number; otherDisposed: number }>;
  market: InventoryGroup['market'];
}>;

// A quote for another grade, edition, language or finish must not leak into a copy.
export function catalogIdentity(catalog: CardCopy['catalog']): string {
  if (catalog.kind === 'unidentified') return JSON.stringify(['unidentified', catalog.description]);
  const evidence = (value: typeof catalog.language) => value.status === 'known' ? value.value : null;
  return JSON.stringify([catalog.cardId, catalog.edition, evidence(catalog.language), evidence(catalog.finish)]);
}
function validatedCopies(ownerUid: string, raw: readonly unknown[]): CardCopy[] {
  idSchema.parse(ownerUid);
  const copies = raw.map(c => cardCopySchema.parse(c));
  if (copies.some(c => c.ownerUid !== ownerUid)) throw Error('Foreign inventory record');
  if (new Set(copies.map(c => c.id)).size !== copies.length) throw Error('Duplicate physical copy identity');
  return copies;
}
const unavailable = (reason: string): Metric => ({ status: 'unavailable', reason });

export function selectInventory(ownerUid: string, rawCopies: readonly unknown[], catalog: readonly InventoryCatalogCard[], rawQuotes: readonly unknown[], currency: Currency): InventorySelection {
  const copies = validatedCopies(ownerUid, rawCopies);
  moneySchema.parse({ currency, minor: 0 });
  if (new Set(catalog.map(c => c.id)).size !== catalog.length) throw Error('Duplicate catalog identity');
  const cards = new Map(catalog.map(c => [c.id, c]));
  const quoteMap = new Map<string, CopyQuote[]>();
  for (const raw of rawQuotes) {
    const quote = copyQuoteSchema.parse(raw);
    if (quote.money.currency !== currency || quote.catalog.kind !== 'identified') continue;
    const key = `${catalogIdentity(quote.catalog)}:${quote.condition}`;
    const previous = quoteMap.get(key) ?? [];
    const latest = previous[0]?.observedAt;
    if (!latest || Date.parse(quote.observedAt) > Date.parse(latest)) quoteMap.set(key, [quote]);
    else if (Date.parse(quote.observedAt) === Date.parse(latest)) quoteMap.set(key, [...previous, quote]);
  }
  const groups = new Map<string, CopyView[]>();
  for (const copy of copies) {
    if (copy.disposition !== 'held' || copy.removedFromImport) continue;
    const key = copy.catalog.kind === 'identified' ? copy.catalog.cardId : `unidentified:${copy.id}`;
    const quotes = copy.condition.status === 'known' && copy.catalog.kind === 'identified'
      ? quoteMap.get(`${catalogIdentity(copy.catalog)}:${copy.condition.value}`) ?? [] : [];
    const quote = quotes[0];
    const market = quote && quotes.every(q => q.money.minor === quote.money.minor)
      ? { ...quote.money, status: 'exact' as const } : unavailable('No unambiguous matching market quote');
    const costs = [copy.cardCost, copy.shippingCost, copy.taxCost, copy.feeCost];
    const originalCurrency = costs.find(c => c.status === 'exact' || c.status === 'estimated');
    const basis = originalCurrency && (originalCurrency.status === 'exact' || originalCurrency.status === 'estimated')
      ? costBasis(costs, originalCurrency.value.currency) : unavailable('No cost evidence');
    groups.set(key, [...(groups.get(key) ?? []), { copy, paid: copy.cardCost, basis, market }]);
  }
  let total = 0n, pricedCount = 0, missingCount = 0;
  const rows: InventoryGroup[] = [...groups].map(([key, views]) => {
    views.sort((a, b) => a.copy.createdAt.localeCompare(b.copy.createdAt) || a.copy.id.localeCompare(b.copy.id));
    const received = views.filter(v => v.copy.possession === 'received');
    const priced = received.filter(v => v.market.status !== 'unavailable');
    const minor = safeInteger(priced.reduce((sum, v) => sum + (v.market.status === 'unavailable' ? 0n : BigInt(v.market.minor)), 0n));
    total += BigInt(minor); pricedCount += priced.length; missingCount += received.length - priced.length;
    return { key, card: cards.get(key) ?? null, copies: views, receivedCount: received.length,
      pendingCount: views.filter(v => v.copy.possession === 'pending').length,
      unknownPossessionCount: views.filter(v => v.copy.possession === 'unknown').length,
      market: { currency, minor, pricedCount: priced.length, missingCount: received.length - priced.length } };
  });
  rows.sort((a, b) => (a.card?.name ?? a.key).localeCompare(b.card?.name ?? b.key) || a.key.localeCompare(b.key));
  return { groups: rows, counts: {
    catalogCards: rows.filter(g => g.copies.some(c => c.copy.catalog.kind === 'identified')).length,
    received: copies.filter(c => !c.removedFromImport && c.disposition === 'held' && c.possession === 'received').length,
    pending: copies.filter(c => !c.removedFromImport && c.disposition === 'held' && c.possession === 'pending').length,
    unknownPossession: copies.filter(c => !c.removedFromImport && c.disposition === 'held' && c.possession === 'unknown').length,
    sold: copies.filter(c => c.disposition === 'sold').length,
    otherDisposed: copies.filter(c => c.disposition !== 'held' && c.disposition !== 'sold').length,
  }, market: { currency, minor: safeInteger(total), pricedCount, missingCount } };
}

/** Quote coverage of the visible copies, including pending acquisitions. Financial
 * holdings totals above deliberately continue to count received copies only. */
export function visibleCopyMarket(copies: readonly CopyView[], currency: Currency): InventoryGroup['market'] {
  const priced=copies.filter(v=>v.market.status!=='unavailable' && v.market.currency===currency);
  return {currency,minor:safeInteger(priced.reduce((sum,v)=>sum+(v.market.status==='unavailable'?0n:BigInt(v.market.minor)),0n)),pricedCount:priced.length,missingCount:copies.length-priced.length};
}

const editSchema = z.strictObject({
  condition: cardCopySchema.shape.condition.optional(),
  edition: z.enum(['unlimited', 'first-edition', 'unknown']).optional(),
  notes: z.string().max(2000).optional(),
}).refine(p => Object.keys(p).length > 0, 'Choose a copy field to update');
export type CopyMetadataEdit = z.infer<typeof editSchema>;
export function planCopyMetadataEdit(ownerUid: string, rawCopy: unknown, rawPatch: unknown, at: string, auditId: string, reason: string) {
  const before = validatedCopies(ownerUid, [rawCopy])[0]!;
  const patch = editSchema.parse(rawPatch);
  if (before.disposition !== 'held') throw Error('Only current copies can be edited');
  if (patch.edition !== undefined && before.catalog.kind !== 'identified') throw Error('Identify the card before editing its edition');
  const changed = cardCopySchema.parse({ ...before,
    condition: patch.condition ?? before.condition, notes: patch.notes ?? before.notes,
    catalog: before.catalog.kind === 'identified' ? { ...before.catalog, edition: patch.edition ?? before.catalog.edition } : before.catalog,
  });
  if (JSON.stringify(changed) === JSON.stringify(before)) return null;
  const after = cardCopySchema.parse({ ...changed, revision: safeInteger(BigInt(before.revision) + 1n), updatedAt: at });
  if (Date.parse(after.updatedAt) < Date.parse(before.updatedAt)) throw Error('Recorded timestamp cannot move backwards');
  const change: CopyChange = { before, after };
  return { change, audit: auditCopyChange(change, auditId, reason, 'edit') };
}

export const binderPocketSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('copy'), copyId: idSchema }),
  z.strictObject({ kind: z.literal('wish'), cardId: idSchema }),
  z.strictObject({ kind: z.literal('empty'), token: z.string().min(1) }),
]);
export type BinderPocket = z.infer<typeof binderPocketSchema>;
// Pockets name a specific copy. Delivery, editing or selling it never substitutes
// a sibling, removes a reserved pocket or compacts pages. Assignment UI is #13.
export function inspectBinder(ownerUid: string, rawPockets: readonly unknown[], rawCopies: readonly unknown[]) {
  const copies = validatedCopies(ownerUid, rawCopies);
  const byId = new Map(copies.map(c => [c.id, c]));
  return rawPockets.map((raw, index) => {
    const pocket = binderPocketSchema.parse(raw);
    const copy = pocket.kind === 'copy' ? byId.get(pocket.copyId) ?? null : null;
    return { index, page: Math.floor(index / 9), position: index % 9, pocket, copy };
  });
}

