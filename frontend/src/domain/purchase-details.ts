import { z } from 'zod';
import { idSchema, type Cost, type Money } from './schema';
import { selectHistory, type HistoryData } from './transaction-history';
import { costBasis, safeInteger } from './money';

// Read-only presentation snapshots, not Firestore records or provider commands.
export const purchaseShipmentSchema = z.strictObject({
  id: idSchema, ownerUid: idSchema, transactionId: idSchema,
  copyIds: z.array(idSchema).min(1), carrier: z.string().min(1).max(200),
  trackingNumber: z.string().min(1).max(100).nullable(),
  status: z.enum(['inTransit', 'received', 'pending', 'unknown']),
  providerStatus: z.string().max(40).optional(), unreadCount: z.number().int().nonnegative().optional(),
  events: z.array(z.strictObject({
    id: idSchema, code: z.enum(['departed', 'accepted', 'registered', 'other']),
    description: z.string().min(1).max(1000), occurredAt: z.iso.datetime().nullable(),
  })).max(1000),
});
export type PurchaseShipment = z.infer<typeof purchaseShipmentSchema>;

export function selectPurchaseDetails(data: HistoryData, transactionId: string, snapshots: readonly PurchaseShipment[]) {
  const history = selectHistory(data); // Full validation, including owner and duplicate checks.
  idSchema.parse(transactionId);
  const transaction = data.transactions.find(p => p.id === transactionId);
  if (!transaction || transaction.kind !== 'purchase') return null;
  const row = history.find(p => p.id === transaction.id)!;
  const catalog = new Map(data.catalog.map(c => [c.id, c]));
  const copies = data.copies.filter(c => c.acquisition.kind === 'purchase' && c.acquisition.transactionId === transactionId)
    .map(copy => ({ copy, card: copy.catalog.kind === 'identified' ? catalog.get(copy.catalog.cardId) ?? null : null,
      basis: row.currency ? costBasis([copy.cardCost, copy.shippingCost, copy.taxCost, copy.feeCost], row.currency) : { status: 'unavailable' as const, reason: 'Currency unknown' },
    }));
  const shipments = snapshots.map(s => purchaseShipmentSchema.parse(s));
  if (shipments.some(s => s.ownerUid !== data.ownerUid) || new Set(shipments.map(s => s.id)).size !== shipments.length) throw Error('Foreign or duplicate shipment');
  const linkedShipments = shipments.filter(s => s.transactionId === transactionId).map(s => {
    if (new Set(s.copyIds).size !== s.copyIds.length || s.copyIds.some(id => !copies.some(c => c.copy.id === id))) throw Error('Shipment copy belongs to another purchase');
    if (new Set(s.events.map(e => e.id)).size !== s.events.length) throw Error('Duplicate tracking event');
    return { ...s, events: [...s.events].sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '') || a.id.localeCompare(b.id)) };
  });
  const matches = (costs: readonly Cost[], total: typeof transaction.shipping) => {
    if (!costs.length || total.status !== 'known' || costs.some(c => c.status !== 'exact' || c.value.currency !== total.value.currency)) return false;
    return costs.reduce((sum, c) => sum + (c.status === 'exact' ? BigInt(c.value.minor) : 0n), 0n) === BigInt(total.value.minor);
  };
  const shippingCosts = copies.map(c => c.copy.shippingCost);
  const shippingAmounts = matches(shippingCosts, transaction.shipping)
    ? shippingCosts.flatMap(c => c.status === 'exact' ? [c.value.minor] : []) : [];
  const shippingRange = shippingAmounts.length && transaction.shipping.status === 'known' ? {
    currency: transaction.shipping.value.currency,
    min: shippingAmounts.reduce((a, b) => Math.min(a, b)), max: shippingAmounts.reduce((a, b) => Math.max(a, b)),
  } : null;
  const exactCards = copies.flatMap(c => c.copy.cardCost.status === 'exact' && c.copy.cardCost.value.currency === row.currency ? [c.copy.cardCost.value] : []);
  const cardSum: Money | null = row.currency && exactCards.length === copies.length && copies.length
    ? { currency: row.currency, minor: safeInteger(exactCards.reduce((sum, c) => sum + BigInt(c.minor), 0n)) } : null;
  return { transaction, row, copies, shipments: linkedShipments, shippingRange,
    cardCostMismatch: cardSum !== null && transaction.subtotal.status === 'known' && cardSum.minor !== transaction.subtotal.value.minor };
}
export type PurchaseDetailsView = NonNullable<ReturnType<typeof selectPurchaseDetails>>;
