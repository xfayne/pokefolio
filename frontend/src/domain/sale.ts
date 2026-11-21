import { z } from 'zod';
import { cardCopySchema, currencySchema, dateSchema, idSchema, revisionSchema, saleLineSchema, saleSchema, type CardCopy, type Cost, type Currency, type Sale, type SaleLine } from './schema';
import { costBasis, netSaleProceeds, parseMoney, realizedProfit, safeInteger, splitMoney, sumMoney, type Metric } from './money';
import { planSale, reverseSaleCopy } from './lifecycle';
import { prepareCommit, type PortfolioCommit, type PortfolioRecord } from './persistence';
import { selectHistory, type HistoryData } from './transaction-history';

export const saleCopyLimit = 9; // Keep create/edit/reverse within the existing verified atomic audit limit.
export const saleDraftSchema = z.strictObject({
  id: idSchema, date: dateSchema, source: z.enum(['manual', 'ebay', 'other']), buyer: z.string().trim().min(1).max(200),
  currency: currencySchema, listingUrl: z.union([z.literal(''), z.url().max(2000).refine(s => /^https?:\/\//.test(s))]), itemReference: z.string().max(200),
  cards: z.array(z.strictObject({ copyId: idSchema, amount: z.string().min(1) })).min(1).max(saleCopyLimit),
  buyerShipping: z.string(), sellingFees: z.string(), sellerShipping: z.string(), sellingTaxes: z.string(),
  notes: z.string().max(2000),
});
export type SaleDraft = z.infer<typeof saleDraftSchema>;
export function newSaleDraft(): SaleDraft {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  return { id: `sale-${crypto.randomUUID()}`, date, source: 'manual', buyer: '', currency: 'USD', listingUrl: '', itemReference: '', cards: [], buyerShipping: '0', sellingFees: '0', sellerShipping: '0', sellingTaxes: '0', notes: '' };
}
export function eligibleSaleCopies(owner: string, copies: readonly CardCopy[]) {
  const parsed = copies.map(c => cardCopySchema.parse(c));
  if (parsed.some(c => c.ownerUid !== owner) || new Set(parsed.map(c => c.id)).size !== parsed.length) throw Error('Foreign or duplicate copies');
  return parsed.filter(c => c.disposition === 'held' && c.possession === 'received');
}
const costsOf = (copy: CardCopy): Cost[] => [copy.cardCost, copy.shippingCost, copy.taxCost, copy.feeCost];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const known = <T,>(value: T) => ({ status: 'known' as const, source: 'user' as const, value });
const exact = (minor: number, currency: Currency, id: string): Cost => ({ status: 'exact', value: { minor, currency }, evidenceRef: id });

export function prepareSale(owner: string, raw: SaleDraft, copies: readonly CardCopy[], at: string) {
  const draft = saleDraftSchema.parse(raw);
  const metadata = { schemaVersion: 1, ownerUid: owner, revision: 1, createdAt: at, updatedAt: at } as const;
  const selected = draft.cards.map(c => copies.find(copy => copy.id === c.copyId));
  if (selected.some(c => !c)) throw Error('Selected copy unavailable');
  const ordered = selected as CardCopy[];
  const amounts = draft.cards.map(c => parseMoney(c.amount, draft.currency));
  const sale = saleSchema.parse({ ...metadata, id: draft.id, kind: 'sale', transactionOn: draft.date, currency: draft.currency,
    source: { kind: draft.source, seller: draft.buyer, listingUrl: draft.listingUrl || null, itemReference: draft.itemReference || null }, notes: draft.notes,
    copyIds: draft.cards.map(c => c.copyId), cardProceeds: known(sumMoney(amounts, draft.currency)),
    ...Object.fromEntries((['buyerShipping', 'sellingFees', 'sellerShipping', 'sellingTaxes'] as const).map(key => [key, known(parseMoney(draft[key], draft.currency))])),
  });
  const lines = allocateSaleLines(sale, draft.cards.map((c,i) => ({ ...metadata, id: `${draft.id}-line-${i}`, transactionId: sale.id, copyId: c.copyId,
    proceeds: exact(amounts[i]!.minor, sale.currency, sale.id), expenses: exact(0, sale.currency, sale.id), basisCosts: costsOf(ordered[i]!),
  })));
  return planSale(owner, sale, lines, ordered, at);
}

// Equal splits are explicit estimates for per-copy reporting. The transaction net stays exact.
export function allocateSaleLines(sale: Sale, base: readonly SaleLine[], cardPrices?: readonly string[]): SaleLine[] {
  if (!sale.copyIds || base.length !== sale.copyIds.length || base.some((l,i) => l.copyId !== sale.copyIds![i])) throw Error('Sale membership mismatch');
  const amount = (key: 'buyerShipping' | 'sellingFees' | 'sellerShipping' | 'sellingTaxes') => {
    const a = sale[key]; if (a.status !== 'known') throw Error('Sale amount missing'); return a.value;
  };
  const shipping = amount('buyerShipping');
  const expenses = sumMoney([amount('sellingFees'), amount('sellerShipping'), amount('sellingTaxes')], sale.currency);
  const buyerShares = splitMoney(shipping, sale.copyIds), expenseShares = splitMoney(expenses, sale.copyIds);
  return base.map((line, index) => {
    const proceeds = cardPrices ? parseMoney(cardPrices[index]!, sale.currency).minor : line.proceeds.status === 'exact' ? line.proceeds.value.minor : null;
    if (proceeds === null) throw Error('Per-copy sale price required');
    const receipt = { currency: sale.currency, minor: safeInteger(BigInt(proceeds) + BigInt(buyerShares.get(line.copyId)!.minor)) };
    const expense = expenseShares.get(line.copyId)!;
    return saleLineSchema.parse({ ...line,
      proceeds: base.length > 1 && shipping.minor > 0 ? { status: 'estimated', value: receipt, method: 'Buyer shipping split equally between selected copies' } : exact(receipt.minor, sale.currency, sale.id),
      expenses: base.length > 1 && expenses.minor > 0 ? { status: 'estimated', value: expense, method: 'Selling expenses split equally between selected copies' } : exact(expense.minor, sale.currency, sale.id),
    });
  });
}
function update(command: PortfolioCommit, before: PortfolioRecord, afterRecord: PortfolioRecord['record'], at: string, operation: 'edit' | 'reverse') {
  const after = { ...before, record: { ...afterRecord, revision: before.record.revision + 1, createdAt: before.record.createdAt, updatedAt: at } } as PortfolioRecord;
  command.updates.push({ before, after });
  command.creates.push({ collection: 'revisions', record: revisionSchema.parse({ schemaVersion: 1, id: `audit-${crypto.randomUUID()}`, ownerUid: command.ownerUid, actorUid: command.ownerUid,
    revision: 1, createdAt: at, updatedAt: at, recordId: before.record.id, operation, reason: operation === 'reverse' ? 'Sale reversed' : 'Sale edited', before: before.record, after: after.record }) });
}
export function saleCommit(owner: string, draft: SaleDraft, copies: readonly CardCopy[], at: string): PortfolioCommit {
  const plan = prepareSale(owner, draft, copies, at);
  const command: PortfolioCommit = { ownerUid: owner, idempotencyKey: draft.id, creates: [{ collection: 'transactions', record: plan.sale }, ...plan.lines.map(record => ({ collection: 'lines' as const, record }))], updates: [] };
  for (const change of plan.changes) update(command, { collection: 'copies', record: change.before }, change.after, at, 'edit');
  return prepareCommit(owner, command, 450);
}
export function saleRecords(records: readonly PortfolioRecord[], id: string) {
  const entry = records.find(e => e.collection === 'transactions' && e.record.id === id);
  if (entry?.collection !== 'transactions' || entry.record.kind !== 'sale') throw Error('Sale unavailable');
  const sale = entry.record;
  const lines = records.flatMap(e => e.collection === 'lines' && e.record.transactionId === id && 'copyId' in e.record ? [e.record] : []);
  const copies = records.flatMap(e => e.collection === 'copies' && lines.some(l => l.copyId === e.record.id) ? [e.record] : []);
  return { sale, lines: sale.copyIds ? sale.copyIds.map(id => { const line = lines.find(l => l.copyId === id); if (!line) throw Error('Sale line missing'); return line; }) : lines, copies };
}
export function draftFromSale(records: readonly PortfolioRecord[], id: string): SaleDraft {
  const { sale, lines } = saleRecords(records, id);
  if (sale.reversedAt || !sale.copyIds) throw Error('Sale cannot be edited');
  const value = (key: 'buyerShipping' | 'sellingFees' | 'sellerShipping' | 'sellingTaxes') => { const a = sale[key]; if (a.status !== 'known') throw Error('Incomplete sale'); return (a.value.minor/100).toFixed(2); };
  const buyer = splitMoney(parseMoney(value('buyerShipping'), sale.currency), sale.copyIds);
  return { id, date: sale.transactionOn, source: sale.source.kind, buyer: sale.source.seller ?? '', currency: sale.currency, listingUrl: sale.source.listingUrl ?? '', itemReference: sale.source.itemReference ?? '', notes: sale.notes,
    cards: lines.map(line => { if (line.proceeds.status !== 'exact' && line.proceeds.status !== 'estimated') throw Error('Sale price missing'); return { copyId: line.copyId, amount: ((line.proceeds.value.minor - buyer.get(line.copyId)!.minor)/100).toFixed(2) }; }),
    buyerShipping: value('buyerShipping'), sellingFees: value('sellingFees'), sellerShipping: value('sellerShipping'), sellingTaxes: value('sellingTaxes') };
}
export function editSaleCommit(owner: string, draft: SaleDraft, records: readonly PortfolioRecord[], at: string): PortfolioCommit {
  const previous = saleRecords(records, draft.id);
  if (previous.sale.reversedAt || !same(previous.sale.copyIds, draft.cards.map(c => c.copyId))) throw Error('Sale membership cannot change');
  const plan = prepareSale(owner, draft, previous.copies.map(c => ({ ...c, disposition: 'held', dispositionRecordId: null })), at);
  const command: PortfolioCommit = { ownerUid: owner, idempotencyKey: `sale-edit-${crypto.randomUUID()}`, creates: [], updates: [] };
  update(command, { collection: 'transactions', record: previous.sale }, plan.sale, at, 'edit');
  for (const [i, line] of previous.lines.entries()) update(command, { collection: 'lines', record: line }, { ...plan.lines[i]!, basisCosts: line.basisCosts }, at, 'edit');
  for (const copy of previous.copies) { if (copy.disposition !== 'sold' || copy.dispositionRecordId !== draft.id) throw Error('Sale copy changed'); update(command, { collection: 'copies', record: copy }, copy, at, 'edit'); }
  return prepareCommit(owner, command, 450);
}
export function reverseSaleCommit(owner: string, id: string, records: readonly PortfolioRecord[], at: string): PortfolioCommit {
  const { sale, copies } = saleRecords(records, id);
  if (sale.reversedAt || !sale.copyIds || copies.length !== sale.copyIds.length) throw Error('Sale cannot be reversed');
  const command: PortfolioCommit = { ownerUid: owner, idempotencyKey: `sale-reverse-${crypto.randomUUID()}`, creates: [], updates: [] };
  update(command, { collection: 'transactions', record: sale }, { ...sale, reversedAt: at }, at, 'reverse');
  for (const copy of copies) update(command, { collection: 'copies', record: copy }, reverseSaleCopy(owner, id, copy, at).after, at, 'reverse');
  return prepareCommit(owner, command, 450);
}

/** Validate complete lifecycle commands before the adapter's atomic snapshot checks. */
export function validateSaleCommit(owner: string, command: PortfolioCommit): boolean {
  const header = [...command.creates, ...command.updates.map(u => u.after)].find(e => e.collection === 'transactions' && e.record.kind === 'sale');
  if (!header) return false;
  if (header.collection !== 'transactions' || header.record.kind !== 'sale') return false;
  const sale = header.record;
  const txBefore = command.updates.find(u => u.before.collection === 'transactions');
  const before = txBefore?.before;
  if (!sale.copyIds || new Set(sale.copyIds).size !== sale.copyIds.length) throw Error('Explicit distinct sale membership required');
  const copyUpdates = command.updates.filter(u => u.before.collection === 'copies');
  if (copyUpdates.length !== sale.copyIds.length || copyUpdates.some(u => !sale.copyIds!.includes(u.before.record.id))) throw Error('Incomplete sale copy write set');
  const reversing = !!sale.reversedAt;
  const isNew = !before;
  if (before && (before.collection !== 'transactions' || before.record.kind !== 'sale' || before.record.reversedAt || !same(before.record.copyIds, sale.copyIds))) throw Error('Invalid sale correction');
  if (isNew && reversing) throw Error('Cannot create reversed sale');
  const allowed = new Set(['revisions', 'transactions', 'lines', 'copies']);
  const writes = [...command.creates, ...command.updates.map(u => u.after)];
  if (writes.some(e => !allowed.has(e.collection)) || writes.filter(e => e.collection === 'transactions').length !== 1 || command.creates.some(e => e.collection === 'copies')) throw Error('Unexpected sale write');
  const lineEntries = writes.filter(e => e.collection === 'lines');
  if (reversing) {
    if (!before || before.record.kind !== 'sale' || lineEntries.length || command.creates.some(e => e.collection !== 'revisions') || sale.reversedAt !== sale.updatedAt) throw Error('Invalid reversal');
    if (!same({ ...sale, reversedAt: undefined, revision: before.record.revision, updatedAt: before.record.updatedAt }, before.record)) throw Error('Reversal cannot rewrite sale');
  } else {
    const lines = lineEntries.map(e => { if (e.collection !== 'lines' || !('copyId' in e.record)) throw Error('Invalid sale line'); return e.record; });
    const originalCopies = copyUpdates.map(u => { if (u.before.collection !== 'copies') throw Error('Invalid copy'); return u.before.record; });
    const eligible = originalCopies.map(c => isNew ? c : { ...c, disposition: 'held' as const, dispositionRecordId: null });
    planSale(owner, { ...sale, revision: 1 }, lines.map(l => ({ ...l, revision: 1 })), eligible, sale.updatedAt);
    if (lines.length !== sale.copyIds.length || lines.some(l => l.transactionId !== sale.id || !sale.copyIds!.includes(l.copyId))) throw Error('Incomplete sale lines');
    for (const line of lines) {
      const prior = command.updates.find(u => u.before.collection === 'lines' && u.before.record.id === line.id);
      if (isNew ? !same(line.basisCosts, costsOf(originalCopies.find(c => c.id === line.copyId)!)) : !prior || !('basisCosts' in prior.before.record) || !same(prior.before.record.basisCosts, line.basisCosts) || !('copyId' in prior.before.record) || prior.before.record.copyId !== line.copyId) throw Error('Sale basis snapshot mismatch');
    }
    if (isNew ? command.updates.some(u => u.before.collection !== 'copies') : command.creates.some(e => e.collection !== 'revisions')) throw Error('Invalid sale create/edit write set');
  }
  for (const u of copyUpdates) {
    if (u.before.collection !== 'copies' || u.after.collection !== 'copies') throw Error('Invalid copy update');
    const a = u.before.record, b = u.after.record;
    if (!isNew && (a.disposition !== 'sold' || a.dispositionRecordId !== sale.id)) throw Error('Sale no longer owns copy');
    const expected = { ...a, disposition: reversing ? 'held' : 'sold', dispositionRecordId: reversing ? null : sale.id, revision: b.revision, updatedAt: b.updatedAt };
    if (!same(expected, b)) throw Error('Sale cannot alter copy acquisition or costs');
  }
  return true;
}
export function selectSaleDetails(data: HistoryData, id: string) {
  selectHistory(data);
  const sale = data.transactions.find(t => t.id === id);
  if (!sale || sale.kind !== 'sale') return null;
  const lines = data.saleLines.filter(l => l.transactionId === id);
  const catalog = new Map(data.catalog.map(c => [c.id,c]));
  const copies = lines.map(line => {
    const copy = data.copies.find(c => c.id === line.copyId)!;
    const basis = costBasis(line.basisCosts ?? costsOf(copy), sale.currency);
    const amount = (cost: Cost): Metric => cost.status === 'exact' || cost.status === 'estimated' ? { status: cost.status, ...cost.value } : { status: 'unavailable', reason: 'Unallocated sale amount' };
    const net = realizedProfit(amount(line.proceeds), amount(line.expenses));
    return { copy, line, card: copy.catalog.kind === 'identified' ? catalog.get(copy.catalog.cardId) : undefined, basis, net, profit: realizedProfit(net, basis) };
  });
  const basis = copies.length ? costBasis(copies.flatMap(c => c.line.basisCosts ?? costsOf(c.copy)), sale.currency) : { status: 'unavailable' as const, reason: 'No copies' };
  return { sale, copies, net: netSaleProceeds(sale), basis, profit: realizedProfit(netSaleProceeds(sale), basis) };
}
