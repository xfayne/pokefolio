import { z } from 'zod';
import { cardCopySchema, cashMovementSchema, idSchema, purchaseLineSchema, purchaseSchema, type CardCopy, type CashMovement, type Cost, type Purchase, type PurchaseLine } from './schema';
import { splitMoney, sumMoney } from './money';

// Memory bound for pure planning, NOT a promise about Firestore commit capacity.
export const MAX_PLANNED_COPIES = 10_000;
const seedSchema = z.strictObject({
  id: idSchema, lineId: idSchema, unitOrdinal: z.number().int().nonnegative().max(MAX_PLANNED_COPIES),
  condition: cardCopySchema.shape.condition, possession: z.enum(['pending', 'received']), notes: z.string().max(2000),
});
const overrideSchema = z.array(z.strictObject({ copyId: idSchema, cost: cardCopySchema.shape.cardCost })).max(MAX_PLANNED_COPIES);
const optionsSchema = z.strictObject({
  lotCardCosts: overrideSchema.optional(), taxCosts: overrideSchema.optional(), feeCosts: overrideSchema.optional(),
});
export type PurchaseAllocations = z.infer<typeof optionsSchema>;
export type CopySeed = z.infer<typeof seedSchema>;
export type PurchasePlan = Readonly<{
  purchase: Purchase; lines: readonly PurchaseLine[]; copies: readonly CardCopy[]; payment: CashMovement | null;
}>;

/** Pure record construction: does not receive Binder, Wishlist, a database or auth. */
export function planPurchase(ownerUid: string, rawPurchase: unknown, rawLines: readonly unknown[], rawSeeds: readonly unknown[], rawPayment: unknown | null, rawAllocations: PurchaseAllocations = {}): PurchasePlan {
  idSchema.parse(ownerUid);
  const purchase = purchaseSchema.parse(rawPurchase);
  if (purchase.ownerUid !== ownerUid || purchase.revision !== 1) throw new Error('New purchase owner/revision mismatch');
  if (!rawLines.length || rawLines.length > MAX_PLANNED_COPIES || rawSeeds.length > MAX_PLANNED_COPIES) throw new Error('Invalid purchase size');
  const lines = rawLines.map((line) => purchaseLineSchema.parse(line)).sort((a, b) => a.ordinal - b.ordinal);
  if (new Set(lines.map((x) => x.id)).size !== lines.length || new Set(lines.map((x) => x.ordinal)).size !== lines.length) throw new Error('Duplicate line identity/order');
  if (lines.some((line) => line.ownerUid !== ownerUid || line.revision !== 1 || line.transactionId !== purchase.id || line.pricing.mode !== purchase.pricingMode)) throw new Error('Line purchase/owner mismatch');
  const count = lines.reduce((sum, line) => sum + BigInt(line.quantity), 0n);
  if (count > BigInt(MAX_PLANNED_COPIES) || count !== BigInt(rawSeeds.length)) throw new Error('Every physical copy needs one seed');
  const seeds = rawSeeds.map((seed) => seedSchema.parse(seed));
  if (new Set(seeds.map((seed) => seed.id)).size !== seeds.length) throw new Error('Duplicate physical copy ID');
  const byUnit = new Map<string, CopySeed>();
  for (const seed of seeds) {
    const key = `${seed.lineId}:${seed.unitOrdinal}`;
    if (byUnit.has(key)) throw new Error('Duplicate line unit');
    byUnit.set(key, seed);
  }
  const units = lines.flatMap((line) => Array.from({ length: line.quantity }, (_, unitOrdinal) => {
    const seed = byUnit.get(`${line.id}:${unitOrdinal}`);
    if (!seed) throw new Error('Missing physical line unit');
    return { line, seed };
  }));
  if (purchase.pricingMode === 'per-copy') {
    const amounts = units.map(({ line }) => {
      if (line.pricing.mode !== 'per-copy') throw new Error('Per-copy price required');
      return line.pricing.unitPrice;
    });
    const total = sumMoney(amounts, purchase.currency);
    if (purchase.subtotal.status !== 'known' || total.minor !== purchase.subtotal.value.minor) throw new Error('Per-copy subtotal must reconcile');
  } else if (lines.some((line) => line.pricing.mode !== 'lot-total' || line.pricing.lotId !== purchase.lotId)) {
    throw new Error('Lot identity mismatch');
  }
  const orderedIds = units.map(({ seed }) => seed.id);
  const allocations = optionsSchema.parse(rawAllocations);
  const override = (entries: PurchaseAllocations['taxCosts'], total: Purchase['taxes']): ReadonlyMap<string, Cost> | null => {
    if (!entries) return null;
    if (total.status !== 'known' || entries.length !== orderedIds.length || new Set(entries.map((x) => x.copyId)).size !== entries.length || entries.some((entry) => !orderedIds.includes(entry.copyId))) throw new Error('Explicit costs require every copy and a known component total');
    const amounts = entries.map(({ cost }) => {
      if (cost.status !== 'exact' && cost.status !== 'estimated') throw new Error('Explicit allocations need amounts');
      return cost.value;
    });
    if (sumMoney(amounts, purchase.currency).minor !== total.value.minor) throw new Error('Explicit allocations must reconcile');
    return new Map(entries.map((entry) => [entry.copyId, entry.cost]));
  };
  if (allocations.lotCardCosts && purchase.pricingMode !== 'lot-total') throw new Error('Ordinary card prices come from purchase lines');
  const cardCosts = override(allocations.lotCardCosts, purchase.subtotal);
  const allocate = (component: Purchase['shipping']): ReadonlyMap<string, Cost> => {
    if (component.status === 'unknown') return new Map(orderedIds.map((id) => [id, component]));
    return new Map([...splitMoney(component.value, orderedIds)].map(([id, value]) => [id, { status: 'exact', value, evidenceRef: purchase.id }]));
  };
  const shipping = allocate(purchase.shipping), taxes = override(allocations.taxCosts, purchase.taxes) ?? allocate(purchase.taxes), fees = override(allocations.feeCosts, purchase.fees) ?? allocate(purchase.fees);
  const copies = units.map(({ line, seed }) => cardCopySchema.parse({
    schemaVersion: 1, id: seed.id, ownerUid, revision: 1, createdAt: purchase.createdAt, updatedAt: purchase.updatedAt,
    catalog: line.catalog, condition: seed.condition,
    acquisition: { kind: 'purchase', transactionId: purchase.id, lineId: line.id, unitOrdinal: seed.unitOrdinal },
    acquiredOn: { status: 'known', value: purchase.transactionOn, source: 'user' },
    possession: seed.possession, disposition: 'held', dispositionRecordId: null, notes: seed.notes,
    cardCost: cardCosts?.get(seed.id) ?? (line.pricing.mode === 'per-copy' ? { status: 'exact', value: line.pricing.unitPrice, evidenceRef: purchase.id } : { status: 'unallocated', lotId: line.pricing.lotId }),
    shippingCost: shipping.get(seed.id), taxCost: taxes.get(seed.id), feeCost: fees.get(seed.id),
  }));
  const payment = rawPayment === null ? null : cashMovementSchema.parse(rawPayment);
  if (purchase.settlement === 'paid') {
    if (!payment || payment.ownerUid !== ownerUid || payment.transactionId !== purchase.id || payment.purpose !== 'purchase' || payment.money.currency !== purchase.currency || payment.money.minor !== purchase.payable.minor || payment.revision !== 1) {
      throw new Error('Paid purchase needs its matching initial payment');
    }
  } else if (payment) {
    // Partial settlements need the later cash-ledger workflow; never pretend paid.
    throw new Error('Only fully paid purchases create an initial payment here');
  }
  return { purchase, lines, copies, payment };
}
