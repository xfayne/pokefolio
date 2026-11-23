import { parseMoney } from './money';
import { prepareCommit, type PortfolioCommit, type PortfolioRecord } from './persistence';
import { currencySchema, dateSchema, idSchema, importedPurchaseSchema, importedPurchaseLineSchema, revisionSchema, type Currency, type Cost, type ImportedPurchase } from './schema';

export type ImportedPurchaseEditDraft = Readonly<{
  id: string;
  date: string;
  notes: string;
  cards: readonly Readonly<{ id: string; amount: string; currency: Currency }>[];
}>;

function purchaseEntries(records: readonly PortfolioRecord[], id: string) {
  const purchase = records.find(e => e.collection === 'transactions' && e.record.id === id);
  if (!purchase || purchase.collection !== 'transactions' || purchase.record.kind !== 'purchase' || !('origin' in purchase.record)) throw Error('Imported purchase unavailable');
  const copies = records.filter(e => e.collection === 'copies' && e.record.acquisition.kind === 'purchase' && e.record.acquisition.transactionId === id);
  if (!copies.length || copies.some(e => e.collection !== 'copies' || e.record.disposition !== 'held')) throw Error('Imported purchase copies cannot be edited');
  const lines = records.filter(e => e.collection === 'lines' && e.record.transactionId === id);
  if (copies.length !== lines.length || copies.some(copy => !lines.some(line => line.collection === 'lines' && 'origin' in line.record && copy.collection === 'copies' && copy.record.acquisition.kind === 'purchase' && line.record.id === copy.record.acquisition.lineId))) throw Error('Imported purchase line mismatch');
  return { purchase, copies, lines };
}

export function importedPurchaseEditDraft(records: readonly PortfolioRecord[], id: string): ImportedPurchaseEditDraft {
  const { purchase, copies, lines } = purchaseEntries(records, id);
  const p = importedPurchaseSchema.parse(purchase.record);
  const sorted = [...copies].sort((a, b) => {
    const ordinal = (entry: PortfolioRecord) => {
      if (entry.collection !== 'copies' || entry.record.acquisition.kind !== 'purchase') return 0;
      const line = lines.find(l => l.collection === 'lines' && l.record.id === entry.record.acquisition.lineId);
      return line?.collection === 'lines' ? line.record.ordinal : 0;
    };
    return ordinal(a) - ordinal(b);
  });
  return {
    id,
    date: p.transactionOn.status === 'known' ? p.transactionOn.value : '',
    notes: p.notes,
    cards: sorted.map(entry => {
      if (entry.collection !== 'copies') throw Error('Invalid imported copy');
      const cost = entry.record.cardCost;
      return {
        id: entry.record.id,
        amount: cost.status === 'exact' ? (cost.value.minor / 100).toFixed(2) : '',
        currency: cost.status === 'exact' ? cost.value.currency : p.nativeCardTotals?.[0]?.currency ?? 'USD',
      };
    }),
  };
}

function unchangedExcept(before: object, after: object, allowed: readonly string[]): boolean {
  const stable = (value: object) => JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => !allowed.includes(key) && key !== 'revision' && key !== 'updatedAt')));
  return stable(before) === stable(after);
}

/** Only the already-imported purchase, its original lines and its original copies may be edited.
 * All date evidence on individual copies is immutable in this workflow. */
export function validateImportedPurchaseEdit(command: PortfolioCommit): boolean {
  const transactionUpdates = command.updates.filter(u => u.before.collection === 'transactions' && u.before.record.kind === 'purchase' && 'origin' in u.before.record);
  if (!transactionUpdates.length) return false;
  if (transactionUpdates.length !== 1 || command.creates.some(e => e.collection !== 'revisions')) throw Error('Invalid imported edit records');
  const txUpdate = transactionUpdates[0]!;
  if (txUpdate.after.collection !== 'transactions' || !('origin' in txUpdate.after.record) || txUpdate.before.record.id !== txUpdate.after.record.id ||
    !unchangedExcept(txUpdate.before.record, txUpdate.after.record, ['transactionOn', 'notes', 'subtotal', 'payable', 'currency', 'nativeCardTotals', 'unpricedCopyCount', 'shipping'])) throw Error('Imported purchase identity cannot change');
  const purchaseId = txUpdate.before.record.id;
  const modifiedCopyIds = new Set<string>();
  const modifiedLineIds = new Set<string>();
  for (const update of command.updates) {
    if (update === txUpdate) continue;
    const { before, after } = update;
    if (before.collection === 'copies' && after.collection === 'copies') {
      if (before.record.acquisition.kind !== 'purchase' || before.record.acquisition.transactionId !== purchaseId ||
        !unchangedExcept(before.record, after.record, ['cardCost', 'shippingCost'])) throw Error('Imported copy dates and identity must be preserved');
      if (after.record.cardCost.status !== 'exact' && after.record.cardCost.status !== 'unknown') throw Error('Invalid imported price');
      if (before.record.shippingCost.status === 'exact' && (before.record.shippingCost.value.minor !== 0 || after.record.shippingCost.status !== 'exact' || after.record.shippingCost.value.minor !== 0) ||
        before.record.shippingCost.status !== 'exact' && JSON.stringify(before.record.shippingCost) !== JSON.stringify(after.record.shippingCost)) throw Error('Imported shipping cannot change');
      modifiedCopyIds.add(before.record.acquisition.lineId);
    } else if (before.collection === 'lines' && after.collection === 'lines') {
      if (!('origin' in before.record) || !('origin' in after.record) || before.record.transactionId !== purchaseId ||
        !unchangedExcept(before.record, after.record, ['pricing'])) throw Error('Imported line identity cannot change');
      modifiedLineIds.add(before.record.id);
    } else throw Error('Imported edits cannot change shipments, memberships or other records');
  }
  if (modifiedCopyIds.size !== modifiedLineIds.size || [...modifiedCopyIds].some(id => !modifiedLineIds.has(id))) throw Error('Imported price and line must update together');
  for (const update of command.updates) {
    if (update.before.collection !== 'copies' || update.after.collection !== 'copies') continue;
    const cost = update.after.record.cardCost;
    const linked = command.updates.find(u => u.before.collection === 'lines' && u.before.record.id === update.before.record.acquisition.lineId);
    if (!linked || linked.after.collection !== 'lines' || !('origin' in linked.after.record)) throw Error('Imported cost line missing');
    const evidence = linked.after.record.pricing.unitPrice;
    if (cost.status === 'exact' ? evidence.status !== 'known' || evidence.value.minor !== cost.value.minor || evidence.value.currency !== cost.value.currency : evidence.status !== 'unknown') throw Error('Imported cost and line disagree');
  }
  return true;
}

/** Optimistic, audited edits; dates/possession/identity of physical copies never change. */
export function importedPurchaseEditCommit(owner: string, input: ImportedPurchaseEditDraft, at: string, records: readonly PortfolioRecord[]): PortfolioCommit | null {
  idSchema.parse(owner);
  const { purchase, copies, lines } = purchaseEntries(records, idSchema.parse(input.id));
  if (purchase.record.ownerUid !== owner || copies.some(e => e.record.ownerUid !== owner)) throw Error('Owner mismatch');
  const before = importedPurchaseSchema.parse(purchase.record);
  if (input.notes.length > 2000 || input.cards.length !== copies.length || new Set(input.cards.map(c => c.id)).size !== copies.length || input.cards.some(c => !copies.some(e => e.record.id === c.id))) throw Error('Invalid imported edit');
  const date = input.date.trim();
  if (date && !dateSchema.safeParse(date).success) throw Error('Invalid purchase date');
  const updateAt = new Date(at).toISOString();
  const updates: PortfolioCommit['updates'] = [];
  const creates: PortfolioCommit['creates'] = [];
  const newCosts = new Map<string, Cost>();
  let priceEdited = false;
  function addUpdate(oldEntry: PortfolioRecord, newEntry: PortfolioRecord) {
    updates.push({ before: oldEntry, after: newEntry });
    creates.push({ collection: 'revisions', record: revisionSchema.parse({
      schemaVersion: 1, id: 'audit-' + crypto.randomUUID(), ownerUid: owner, actorUid: owner,
      revision: 1, createdAt: updateAt, updatedAt: updateAt, recordId: oldEntry.record.id,
      operation: 'edit', reason: 'Imported purchase correction', before: oldEntry.record, after: newEntry.record,
    }) });
  }
  for (const entry of copies) {
    if (entry.collection !== 'copies' || entry.record.acquisition.kind !== 'purchase') throw Error('Invalid imported copy');
    const field = input.cards.find(card => card.id === entry.record.id)!;
    const currency = currencySchema.parse(field.currency);
    const oldCost = entry.record.cardCost;
    const nextPrice = field.amount.trim() ? parseMoney(field.amount.trim(), currency) : null;
    const unchanged = nextPrice ? oldCost.status === 'exact' && oldCost.value.minor === nextPrice.minor && oldCost.value.currency === currency : oldCost.status === 'unknown';
    const cost: Cost = unchanged ? oldCost : nextPrice
      ? { status: 'exact', value: nextPrice, evidenceRef: before.id }
      : { status: 'unknown', reason: 'Price cleared by owner' };
    newCosts.set(entry.record.id, cost);
    if (unchanged) continue;
    priceEdited = true;
    const originalLine = lines.find(l => l.collection === 'lines' && l.record.id === entry.record.acquisition.lineId);
    if (!originalLine || originalLine.collection !== 'lines' || !('origin' in originalLine.record)) throw Error('Imported purchase line unavailable');
    const nextCopy = {
      ...entry, record: {
        ...entry.record,
        // In particular: acquiredOn, acquisition, possession, edition, disposition and notes stay untouched.
        cardCost: cost,
        shippingCost: entry.record.shippingCost.status === 'exact' && entry.record.shippingCost.value.minor === 0 && nextPrice
          ? { ...entry.record.shippingCost, value: { currency, minor: 0 } }
          : entry.record.shippingCost,
        revision: entry.record.revision + 1, updatedAt: updateAt,
      },
    } as PortfolioRecord;
    const nextLine = {
      ...originalLine, record: {
        ...originalLine.record,
        pricing: {
          mode: 'per-copy' as const,
          unitPrice: nextPrice ? { status: 'known' as const, value: nextPrice, source: 'user' as const } : { status: 'unknown' as const, reason: 'Price cleared by owner' },
        },
        revision: originalLine.record.revision + 1, updatedAt: updateAt,
      },
    } as PortfolioRecord;
    addUpdate(entry, nextCopy);
    addUpdate(originalLine, nextLine);
  }
  const known = new Map<Currency, bigint>();
  let missing = 0;
  for (const cost of newCosts.values()) {
    if (cost.status !== 'exact') { missing++; continue; }
    known.set(cost.value.currency, (known.get(cost.value.currency) ?? 0n) + BigInt(cost.value.minor));
  }
  const totals = [...known].sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Price overflow');
    return { currency, minor: Number(value) };
  });
  const originalDate = before.transactionOn.status === 'known' ? before.transactionOn.value : '';
  const nextDate = date === originalDate ? before.transactionOn : date
    ? { status: 'known' as const, value: date, source: 'user' as const }
    : { status: 'unknown' as const, reason: 'Purchase date cleared by owner' };
  if (priceEdited || nextDate !== before.transactionOn || input.notes !== before.notes) {
    const single = totals.length === 1 ? totals[0] : null;
    const currency = single ? { status: 'known' as const, value: single.currency, source: 'user' as const } : { status: 'unknown' as const, reason: 'No single purchase currency' };
    const total = single && missing === 0 ? { status: 'known' as const, value: single, source: 'user' as const } : { status: 'unknown' as const, reason: 'Mixed currencies or missing card prices' };
    const next: ImportedPurchase = importedPurchaseSchema.parse({
      ...before,
      transactionOn: nextDate,
      notes: input.notes,
      ...(priceEdited ? {
        currency, subtotal: total, payable: total, nativeCardTotals: totals, unpricedCopyCount: missing,
        shipping: single ? { status: 'known', value: { currency: single.currency, minor: 0 }, source: 'user' } : { status: 'unknown', reason: 'Zero additional shipping without a single transaction currency' },
      } : {}),
      revision: before.revision + 1, updatedAt: updateAt,
    });
    addUpdate(purchase, { collection: 'transactions', record: next });
  }
  if (!updates.length) return null;
  const command: PortfolioCommit = { ownerUid: owner, idempotencyKey: 'edit-' + crypto.randomUUID(), creates, updates };
  prepareCommit(owner, command, 450);
  if (updates.length > 20) throw Error('Too many card prices changed at once; save in smaller groups');
  validateImportedPurchaseEdit(command);
  return command;
}
