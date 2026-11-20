import { cardCopySchema, cashMovementSchema, dateSchema, idSchema, purchaseLineSchema, purchaseSchema, refundSchema, revisionSchema, saleLineSchema, saleSchema, type CardCopy, type Revision, type Sale, type SaleLine } from './schema';
import { safeInteger, splitMoney, sumMoney } from './money';

export type CopyChange = Readonly<{ before: CardCopy; after: CardCopy }>;
function ownedCopy(ownerUid: string, raw: unknown): CardCopy {
  idSchema.parse(ownerUid);
  const copy = cardCopySchema.parse(raw);
  if (copy.ownerUid !== ownerUid) throw new Error('Copy owner mismatch');
  return copy;
}
function changeCopy(before: CardCopy, patch: Partial<CardCopy>, at: string): CopyChange {
  const after = cardCopySchema.parse({ ...before, ...patch, revision: safeInteger(BigInt(before.revision) + 1n), updatedAt: at });
  if (Date.parse(after.updatedAt) < Date.parse(before.updatedAt)) throw new Error('Recorded timestamp cannot move backwards');
  return { before, after };
}
export function receiveCopy(ownerUid: string, raw: unknown, at: string): CopyChange | null {
  const copy = ownedCopy(ownerUid, raw);
  if (copy.possession === 'received' || copy.disposition !== 'held') return null;
  if (copy.possession !== 'pending') throw new Error('Unknown possession needs an explicit inventory correction');
  return changeCopy(copy, { possession: 'received' }, at);
}
export type SalePlan = Readonly<{ sale: Sale; lines: readonly SaleLine[]; changes: readonly CopyChange[] }>;
export function planSale(ownerUid: string, rawSale: unknown, rawLines: readonly unknown[], rawCopies: readonly unknown[], at: string): SalePlan {
  const sale = saleSchema.parse(rawSale);
  if (sale.ownerUid !== ownerUid || sale.revision !== 1) throw new Error('New sale owner/revision mismatch');
  const lines = rawLines.map((line) => saleLineSchema.parse(line));
  const copies = rawCopies.map((copy) => ownedCopy(ownerUid, copy));
  if (!copies.length || copies.length !== lines.length || new Set(copies.map((copy) => copy.id)).size !== copies.length || new Set(lines.map((line) => line.id)).size !== lines.length || new Set(lines.map((line) => line.copyId)).size !== lines.length) throw new Error('Sale needs distinct explicitly selected copies');
  if (lines.some((line) => line.ownerUid !== ownerUid || line.transactionId !== sale.id || line.revision !== 1)) throw new Error('Sale line reference mismatch');
  const byId = new Map(copies.map((copy) => [copy.id, copy]));
  for (const line of lines) {
    const copy = byId.get(line.copyId);
    if (!copy || copy.disposition !== 'held' || copy.possession !== 'received') throw new Error('Only held, received copies can be sold');
    if (copy.acquiredOn.status === 'known' && sale.transactionOn < copy.acquiredOn.value) throw new Error('Sale cannot precede acquisition');
  }
  const checkAllocation = (field: 'proceeds' | 'expenses', components: Sale['cardProceeds'][]) => {
    const costs = lines.map((line) => line[field]);
    const known = costs.flatMap((cost) => cost.status === 'exact' || cost.status === 'estimated' ? [cost.value] : []);
    const allocated = sumMoney(known, sale.currency);
    if (components.every((x) => x.status === 'known')) {
      const total = sumMoney(components.flatMap((x) => x.status === 'known' ? [x.value] : []), sale.currency);
      if (allocated.minor > total.minor || (known.length === costs.length && allocated.minor !== total.minor)) throw new Error('Sale allocations must reconcile');
    }
  };
  checkAllocation('proceeds', [sale.cardProceeds, sale.buyerShipping]);
  checkAllocation('expenses', [sale.sellingFees, sale.sellerShipping, sale.sellingTaxes]);
  return { sale, lines, changes: copies.map((copy) => changeCopy(copy, { disposition: 'sold', dispositionRecordId: sale.id }, at)) };
}
export function reverseSaleCopy(ownerUid: string, saleId: string, raw: unknown, at: string): CopyChange {
  idSchema.parse(saleId);
  const copy = ownedCopy(ownerUid, raw);
  if (copy.disposition !== 'sold' || copy.dispositionRecordId !== saleId) throw new Error('Copy is not disposed by this sale');
  return changeCopy(copy, { disposition: 'held', dispositionRecordId: null }, at);
}
export function auditCopyChange(change: CopyChange, auditId: string, reason: string, operation: Revision['operation']): Revision {
  return revisionSchema.parse({
    schemaVersion: 1, id: auditId, ownerUid: change.before.ownerUid, actorUid: change.before.ownerUid,
    revision: 1, createdAt: change.after.updatedAt, updatedAt: change.after.updatedAt,
    recordId: change.before.id, operation, reason, before: change.before, after: change.after,
  });
}

/** Only held unsold basis is adjusted here. Sold basis needs a separate
 * linked correction in the later workflow; refunds never imply physical returns. */
export function planShippingRefund(ownerUid: string, rawPurchase: unknown, rawLines: readonly unknown[], rawCopies: readonly unknown[], rawRefund: unknown, rawMovement: unknown, at: string): readonly CopyChange[] {
  const purchase = purchaseSchema.parse(rawPurchase), refund = refundSchema.parse(rawRefund), movement = cashMovementSchema.parse(rawMovement);
  if (purchase.ownerUid !== ownerUid || refund.ownerUid !== ownerUid || movement.ownerUid !== ownerUid || refund.scope !== 'shipping' || refund.transactionId !== purchase.id || movement.transactionId !== purchase.id || refund.cashMovementId !== movement.id || movement.purpose !== 'purchase-refund' || movement.relatedRecordId !== refund.id || refund.amount.currency !== purchase.currency || movement.money.currency !== refund.amount.currency || movement.money.minor !== refund.amount.minor || movement.effectiveOn.status !== 'known' || movement.effectiveOn.value !== refund.effectiveOn || refund.effectiveOn < purchase.transactionOn) throw new Error('Refund evidence does not match the purchase and cash movement');
  const lines = rawLines.map((line) => purchaseLineSchema.parse(line)).sort((a, b) => a.ordinal - b.ordinal);
  if (!lines.length || new Set(lines.map((x) => x.id)).size !== lines.length || new Set(lines.map((x) => x.ordinal)).size !== lines.length || lines.some((line) => line.ownerUid !== ownerUid || line.transactionId !== purchase.id)) throw new Error('Refund line mismatch');
  const copies = rawCopies.map((copy) => ownedCopy(ownerUid, copy));
  if (new Set(copies.map((copy) => copy.id)).size !== copies.length || lines.reduce((sum, line) => sum + BigInt(line.quantity), 0n) !== BigInt(copies.length)) throw new Error('Refund needs every purchased physical copy');
  const order = new Map(lines.map((line, index) => [line.id, index]));
  const unitKeys = new Set<string>();
  for (const copy of copies) {
    const acquisition = copy.acquisition;
    if (acquisition.kind !== 'purchase' || acquisition.transactionId !== purchase.id || !order.has(acquisition.lineId) || copy.disposition !== 'held') throw new Error('Refund cannot silently correct disposed or unrelated copies');
    const line = lines[order.get(acquisition.lineId)!]!;
    const key = `${acquisition.lineId}:${acquisition.unitOrdinal}`;
    if (acquisition.unitOrdinal >= line.quantity || unitKeys.has(key)) throw new Error('Refund copy membership mismatch');
    unitKeys.add(key);
  }
  copies.sort((a, b) => {
    if (a.acquisition.kind !== 'purchase' || b.acquisition.kind !== 'purchase') return 0;
    return order.get(a.acquisition.lineId)! - order.get(b.acquisition.lineId)! || a.acquisition.unitOrdinal - b.acquisition.unitOrdinal;
  });
  const previous = copies.map((copy) => {
    if (copy.shippingCost.status !== 'exact') throw new Error('Shipping basis must be known');
    return copy.shippingCost.value;
  });
  const previousTotal = sumMoney(previous, purchase.currency).minor;
  if (purchase.shipping.status !== 'known' || previousTotal > purchase.shipping.value.minor) throw new Error('Shipping basis is not evidenced by the purchase');
  const remaining = previousTotal - refund.amount.minor;
  if (remaining < 0) throw new Error('Refund exceeds remaining shipping basis');
  const shares = splitMoney({ currency: purchase.currency, minor: remaining }, copies.map((copy) => copy.id));
  dateSchema.parse(refund.effectiveOn);
  return copies.map((copy) => changeCopy(copy, { shippingCost: { status: 'exact', value: shares.get(copy.id)!, evidenceRef: refund.id } }, at));
}
