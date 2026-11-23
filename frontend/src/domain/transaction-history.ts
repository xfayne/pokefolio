import { cardCopySchema, idSchema, importedPurchaseSchema, purchaseSchema, saleLineSchema, saleSchema, type CardCopy, type Currency, type ImportedPurchase, type Purchase, type Sale, type SaleLine } from './schema';
import type { InventoryCatalogCard } from './inventory';
import { safeInteger, sumMoney } from './money';

export type HistoryTransaction = Purchase | Sale | ImportedPurchase;
export type HistoryStatus = 'inTransit' | 'received' | 'pending' | 'partial' | 'unknown' | 'completed' | 'reversed';
export type HistoryData = Readonly<{
  ownerUid: string;
  transactions: readonly HistoryTransaction[];
  copies: readonly CardCopy[];
  saleLines: readonly SaleLine[];
  catalog: readonly InventoryCatalogCard[];
  // Only actual tracking evidence may promote pending copies to "In transit".
  inTransit: readonly Readonly<{ ownerUid: string; transactionId: string }>[];
}>;
export type HistoryRow = Readonly<{
  createdAt?: string; id: string; kind: 'purchase' | 'sale'; date: string | null; currency: Currency | null;
  minor: number | null; source: string; sourceKind: 'manual' | 'ebay' | 'other';
  cards: readonly InventoryCatalogCard[]; copyCount: number; status: HistoryStatus; search: string;
  nativeCardTotals?: readonly Readonly<{ currency: Currency; minor: number }>[];
  unpricedCopyCount?: number;
}>;
export type HistoryFilters = Readonly<{ query: string; kind: 'all' | 'purchase' | 'sale'; currency: 'all' | Currency; status: 'all' | HistoryStatus }>;
export type HistoryMonth = Readonly<{
  month: string | null; rows: readonly HistoryRow[];
  // Signed transaction totals, by original currency. This is NOT cash flow or profit.
  totals: readonly Readonly<{ currency: Currency; minor: number }>[]; missingCount: number;
}>;

function ownedUnique<T extends { ownerUid: string; id: string }>(ownerUid: string, records: readonly T[]): void {
  if (records.some(r => r.ownerUid !== ownerUid) || new Set(records.map(r => r.id)).size !== records.length) throw Error('Foreign or duplicate history record');
}

export function selectHistory(data: HistoryData): readonly HistoryRow[] {
  idSchema.parse(data.ownerUid);
  const transactions = data.transactions.map(t => 'origin' in t ? importedPurchaseSchema.parse(t) : t.kind === 'purchase' ? purchaseSchema.parse(t) : saleSchema.parse(t));
  const copies = data.copies.map(c => cardCopySchema.parse(c));
  const lines = data.saleLines.map(l => saleLineSchema.parse(l));
  ownedUnique(data.ownerUid, transactions); ownedUnique(data.ownerUid, copies); ownedUnique(data.ownerUid, lines);
  const byCopy = new Map(copies.map(c => [c.id, c]));
  const catalog = new Map(data.catalog.map(c => [c.id, c]));
  if (catalog.size !== data.catalog.length) throw Error('Duplicate catalog identity');
  const purchases = new Map<string, CardCopy[]>(), sold = new Map<string, CardCopy[]>();
  for (const copy of copies) {
    if (copy.acquisition.kind !== 'purchase') continue;
    const id = copy.acquisition.transactionId;
    const list = purchases.get(id) ?? []; list.push(copy); purchases.set(id, list);
  }
  for (const line of lines) {
    const copy = byCopy.get(line.copyId);
    if (!copy) throw Error('Missing sale copy');
    const list = sold.get(line.transactionId) ?? [];
    if (list.some(c => c.id === copy.id)) throw Error('Duplicate sale copy');
    list.push(copy); sold.set(line.transactionId, list);
  }
  const inTransit = new Set<string>();
  for (const evidence of data.inTransit) {
    if (evidence.ownerUid !== data.ownerUid) throw Error('Foreign tracking evidence');
    inTransit.add(evidence.transactionId);
  }
  return transactions.map(transaction => {
    const imported = 'origin' in transaction;
    const date = imported ? transaction.transactionOn.status === 'known' ? transaction.transactionOn.value : null : transaction.transactionOn;
    const currency = imported ? transaction.currency.status === 'known' ? transaction.currency.value : null : transaction.currency;
    const total = transaction.kind === 'sale' && transaction.reversedAt ? {currency: transaction.currency, minor: 0} : transaction.kind === 'sale'
      ? transaction.cardProceeds.status === 'known' && transaction.buyerShipping.status === 'known'
        ? sumMoney([transaction.cardProceeds.value, transaction.buyerShipping.value], transaction.currency) : null
      : imported ? transaction.payable.status === 'known' ? transaction.payable.value : null : transaction.payable;
    const linked = (transaction.kind === 'sale' ? sold : purchases).get(transaction.id) ?? [];
    const cards = [...new Set(linked.flatMap(c => c.catalog.kind === 'identified' ? [c.catalog.cardId] : []))].flatMap(id => catalog.get(id) ?? []);
    const sourceKind = imported ? 'other' : transaction.source.kind;
    const source = imported ? '' : transaction.source.seller?.trim() ?? '';
    const status: HistoryStatus = transaction.kind === 'sale' ? transaction.reversedAt ? 'reversed' : 'completed'
      : !linked.length || linked.some(c => c.possession === 'unknown') ? 'unknown'
      : linked.every(c => c.possession === 'received') ? 'received'
      : linked.some(c => c.possession === 'received') ? 'partial'
      : inTransit.has(transaction.id) ? 'inTransit' : 'pending';
    return { createdAt: transaction.createdAt, id: transaction.id, kind: transaction.kind, date, currency, minor: total?.minor ?? null,
      nativeCardTotals: imported ? transaction.nativeCardTotals ?? [] : [],
      unpricedCopyCount: imported ? transaction.unpricedCopyCount ?? 0 : 0,
      source, sourceKind, cards, copyCount: linked.length, status,
      search: [transaction.id, source, sourceKind, transaction.notes, imported ? transaction.sourceParcelId : transaction.source.itemReference,
        ...cards.map(c => `${c.name} ${c.setName} ${c.number}`), ...linked.flatMap(c => c.catalog.kind === 'unidentified' ? [c.catalog.description] : [])].join(' ').toLowerCase() };
  }).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || a.id.localeCompare(b.id));
}

export function groupHistory(rows: readonly HistoryRow[], filters: HistoryFilters): readonly HistoryMonth[] {
  const needle = filters.query.trim().toLowerCase();
  const months = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    if (filters.kind !== 'all' && row.kind !== filters.kind || filters.currency !== 'all' && row.currency !== filters.currency ||
        filters.status !== 'all' && row.status !== filters.status || needle && !row.search.includes(needle)) continue;
    const key = row.date?.slice(0, 7) ?? '';
    const bucket = months.get(key) ?? []; bucket.push(row); months.set(key, bucket);
  }
  return [...months].sort(([a], [b]) => b.localeCompare(a)).map(([month, group]) => {
    const totals = new Map<Currency, bigint>();
    for (const row of group) {
      if (row.currency === null || row.minor === null) continue;
      totals.set(row.currency, (totals.get(row.currency) ?? 0n) + BigInt(row.minor) * (row.kind === 'sale' ? 1n : -1n));
    }
    return { month: month || null, rows: group,
      totals: [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, minor]) => ({ currency, minor: safeInteger(minor) })),
      missingCount: group.filter(r => r.minor === null || r.currency === null).length };
  });
}
