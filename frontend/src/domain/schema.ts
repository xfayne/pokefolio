import { z } from 'zod';

// These are private domain DTOs, not Firestore converters or write permissions.
export const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const minorSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const currencySchema = z.enum(['ILS', 'USD', 'EUR', 'GBP']);
export type Currency = z.infer<typeof currencySchema>;
export const conditionSchema = z.enum(['NM', 'LP', 'MP', 'HP', 'DAMAGED']);
export type Condition = z.infer<typeof conditionSchema>;
export const moneySchema = z.strictObject({ currency: currencySchema, minor: minorSchema });
export type Money = z.infer<typeof moneySchema>;
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const time = Date.parse(`${value}T00:00:00Z`);
  return value.slice(0, 4) !== '0000' && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const timestampSchema = z.iso.datetime();
const reasonSchema = z.string().trim().min(1).max(1000);
export function evidenceSchema<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('known'), value, source: z.enum(['user', 'legacy', 'provider']) }),
    z.strictObject({ status: z.literal('unknown'), reason: reasonSchema }),
  ]);
}
export const amountEvidenceSchema = evidenceSchema(moneySchema);
export const costSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('exact'), value: moneySchema, evidenceRef: idSchema }),
  z.strictObject({ status: z.literal('estimated'), value: moneySchema, method: reasonSchema }),
  z.strictObject({ status: z.literal('unallocated'), lotId: idSchema }),
  z.strictObject({ status: z.literal('unknown'), reason: reasonSchema }),
]);
export type Cost = z.infer<typeof costSchema>;
export const catalogRefSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('identified'), cardId: idSchema,
    edition: z.enum(['unlimited', 'first-edition', 'unknown']),
    language: evidenceSchema(z.string().min(1).max(30)),
    finish: evidenceSchema(z.string().min(1).max(50)),
  }),
  z.strictObject({ kind: z.literal('unidentified'), description: reasonSchema }),
]);
export type CatalogRef = z.infer<typeof catalogRefSchema>;
const acquisitionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('purchase'), transactionId: idSchema, lineId: idSchema, unitOrdinal: minorSchema }),
  z.strictObject({ kind: z.enum(['opening-inventory', 'gift', 'adjustment']), recordId: idSchema }),
]);
const metadata = {
  schemaVersion: z.literal(1), id: idSchema, ownerUid: idSchema,
  revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  createdAt: timestampSchema, updatedAt: timestampSchema,
};
export const cardCopySchema = z.strictObject({
  ...metadata, catalog: catalogRefSchema,
  condition: evidenceSchema(conditionSchema),
  acquisition: acquisitionSchema, acquiredOn: evidenceSchema(dateSchema),
  possession: z.enum(['pending', 'received', 'unknown']),
  disposition: z.enum(['held', 'sold', 'returned', 'gifted', 'lost']),
  cardCost: costSchema, shippingCost: costSchema, taxCost: costSchema, feeCost: costSchema,
  dispositionRecordId: idSchema.nullable(), notes: z.string().max(2000),
}).refine((copy) => (copy.disposition === 'held') === (copy.dispositionRecordId === null), 'Disposition must have its own record');
export type CardCopy = z.infer<typeof cardCopySchema>;
const sourceSchema = z.strictObject({
  kind: z.enum(['manual', 'ebay', 'other']), seller: z.string().max(200).nullable(),
  listingUrl: z.url().max(2000).refine((url) => /^https?:\/\//.test(url)).nullable(),
  itemReference: z.string().max(200).nullable(),
});
const transactionFields = {
  ...metadata, transactionOn: dateSchema, currency: currencySchema,
  source: sourceSchema, notes: z.string().max(2000),
};
export const purchaseSchema = z.strictObject({
  ...transactionFields, kind: z.literal('purchase'),
  pricingMode: z.enum(['per-copy', 'lot-total']),
  lotId: idSchema.nullable(), subtotal: amountEvidenceSchema,
  shipping: amountEvidenceSchema, taxes: amountEvidenceSchema, fees: amountEvidenceSchema,
  payable: moneySchema, settlement: z.enum(['unpaid', 'paid', 'partial', 'unknown']),
}).superRefine((purchase, ctx) => {
  if ((purchase.pricingMode === 'lot-total') !== (purchase.lotId !== null)) {
    ctx.addIssue({ code: 'custom', message: 'Only lot purchases require a lot ID' });
  }
  const components = [purchase.subtotal, purchase.shipping, purchase.taxes, purchase.fees];
  if (purchase.payable.currency !== purchase.currency || components.some((component) => component.status === 'known' && component.value.currency !== purchase.currency)) {
    ctx.addIssue({ code: 'custom', message: 'Purchase components must use the original currency' });
  }
  const knownTotal = components.reduce((sum, value) => sum + (value.status === 'known' ? BigInt(value.value.minor) : 0n), 0n);
  if (knownTotal > BigInt(purchase.payable.minor) || (components.every((x) => x.status === 'known') && knownTotal !== BigInt(purchase.payable.minor))) {
    ctx.addIssue({ code: 'custom', message: 'Purchase components must reconcile to payable total' });
  }
});
export type Purchase = z.infer<typeof purchaseSchema>;
export const purchaseLineSchema = z.strictObject({
  ...metadata, transactionId: idSchema, ordinal: minorSchema,
  quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), catalog: catalogRefSchema,
  pricing: z.discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('per-copy'), unitPrice: moneySchema }),
    z.strictObject({ mode: z.literal('lot-total'), lotId: idSchema }),
  ]),
});
export type PurchaseLine = z.infer<typeof purchaseLineSchema>;
// Imported history records may lack dates/prices. Ordinary purchase confirmation
// remains strict. The imported total is the recorded card-price sum, not evidence
// that shipping/tax/fees were separately recorded or zero.
export const importedPurchaseSchema = z.strictObject({
  ...metadata, kind: z.literal('purchase'), origin: z.literal('legacy-import'),
  transactionOn: evidenceSchema(dateSchema), currency: evidenceSchema(currencySchema),
  sourceParcelId: z.string().min(1).max(128), notes: z.string().max(2000),
  subtotal: amountEvidenceSchema, payable: amountEvidenceSchema,
  totalBasis: z.literal('recorded-card-prices'),
  shipping: amountEvidenceSchema, taxes: amountEvidenceSchema, fees: amountEvidenceSchema,
  settlement: z.literal('unknown'),
}).superRefine((record, ctx) => {
  if (record.subtotal.status !== record.payable.status ||
      (record.subtotal.status === 'known' && record.payable.status === 'known' &&
       (record.subtotal.value.currency !== record.payable.value.currency || record.subtotal.value.minor !== record.payable.value.minor))) {
    ctx.addIssue({ code: 'custom', message: 'Imported total must equal recorded card subtotal' });
  }
  const amounts = [record.subtotal, record.payable, record.shipping, record.taxes, record.fees];
  if (amounts.some(a => a.status === 'known' && (record.currency.status !== 'known' || a.value.currency !== record.currency.value))) {
    ctx.addIssue({ code: 'custom', message: 'Imported amount currency mismatch' });
  }
});
export type ImportedPurchase = z.infer<typeof importedPurchaseSchema>;
export const importedPurchaseLineSchema = z.strictObject({
  ...metadata, origin: z.literal('legacy-import'), transactionId: idSchema,
  ordinal: minorSchema, quantity: z.literal(1), catalog: catalogRefSchema,
  pricing: z.strictObject({ mode: z.literal('per-copy'), unitPrice: amountEvidenceSchema }),
});
export type ImportedPurchaseLine = z.infer<typeof importedPurchaseLineSchema>;
export const lotSchema = z.strictObject({
  ...metadata, transactionId: idSchema, subtotal: amountEvidenceSchema,
  totalCopyCount: evidenceSchema(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
  allocation: z.enum(['unallocated', 'estimated', 'exact']), description: z.string().max(1000),
});
export type Lot = z.infer<typeof lotSchema>;
export const saleSchema = z.strictObject({
  ...transactionFields, kind: z.literal('sale'),
  copyIds: z.array(idSchema).min(1).max(9).optional(),
  reversedAt: timestampSchema.optional(),
  cardProceeds: amountEvidenceSchema, buyerShipping: amountEvidenceSchema,
  sellingFees: amountEvidenceSchema, sellerShipping: amountEvidenceSchema,
  sellingTaxes: amountEvidenceSchema,
}).refine((sale) => [sale.cardProceeds, sale.buyerShipping, sale.sellingFees, sale.sellerShipping, sale.sellingTaxes].every((x) => x.status === 'unknown' || x.value.currency === sale.currency), 'Sale currency mismatch');
export type Sale = z.infer<typeof saleSchema>;
export const saleLineSchema = z.strictObject({
  ...metadata, transactionId: idSchema, copyId: idSchema,
  proceeds: costSchema, expenses: costSchema,
  basisCosts: z.array(costSchema).length(4).optional(),
});
export type SaleLine = z.infer<typeof saleLineSchema>;
export const cashMovementSchema = z.strictObject({
  ...metadata, transactionId: idSchema,
  direction: z.enum(['in', 'out']),
  purpose: z.enum(['purchase', 'sale', 'purchase-refund', 'sale-refund', 'purchase-expense', 'sale-expense', 'expense']),
  money: moneySchema, effectiveOn: evidenceSchema(dateSchema), idempotencyKey: idSchema,
  relatedRecordId: idSchema.nullable(),
}).refine((movement) => (movement.purpose !== 'purchase' || movement.direction === 'out') &&
  (movement.purpose !== 'sale' || movement.direction === 'in') &&
  (movement.purpose !== 'purchase-refund' || movement.direction === 'in') &&
  (movement.purpose !== 'sale-refund' || movement.direction === 'out') &&
  (!['expense', 'purchase-expense', 'sale-expense'].includes(movement.purpose) || movement.direction === 'out'), 'Invalid cash direction');
export type CashMovement = z.infer<typeof cashMovementSchema>;
export const acquisitionRecordSchema = z.strictObject({
  ...metadata, kind: z.enum(['opening-inventory', 'gift', 'adjustment']),
  effectiveOn: evidenceSchema(dateSchema), reason: reasonSchema,
  legacyReference: z.string().max(300).nullable(),
});
export type AcquisitionRecord = z.infer<typeof acquisitionRecordSchema>;
export const refundSchema = z.strictObject({
  ...metadata, transactionId: idSchema, cashMovementId: idSchema,
  scope: z.enum(['shipping', 'item', 'other']), amount: moneySchema,
  effectiveOn: dateSchema, reason: reasonSchema,
});
export type Refund = z.infer<typeof refundSchema>;
export const trackingEventSchema = z.strictObject({
  id: idSchema, time: z.string().max(40), description: z.string().max(240),
  location: z.string().max(90), stage: z.string().max(60),
});
export const trackingStateSchema = z.strictObject({
  registered: z.boolean(), carrier: z.number().int().positive().nullable(),
  status: z.string().max(40), events: z.array(trackingEventSchema).max(150),
  seenEventIds: z.array(idSchema).max(1000), initialized: z.boolean(),
});
export type TrackingState = z.infer<typeof trackingStateSchema>;
export const shipmentSchema = z.strictObject({
  ...metadata, carrier: z.string().max(200).nullable().optional(), trackingNumber: z.string().max(100).nullable(),
  deliveredOn: evidenceSchema(dateSchema), notes: z.string().max(2000),
  tracking: trackingStateSchema.optional(),
});
export type Shipment = z.infer<typeof shipmentSchema>;
export const shipmentMembershipSchema = z.strictObject({
  ...metadata, shipmentId: idSchema, transactionId: idSchema.nullable(),
  copyId: idSchema, ordinal: minorSchema,
});
export type ShipmentMembership = z.infer<typeof shipmentMembershipSchema>;
export const fxEvidenceSchema = z.strictObject({
  from: currencySchema, to: currencySchema,
  rateDecimal: z.string().max(40).regex(/^(0|[1-9]\d*)(\.\d+)?$/).refine((rate) => /[1-9]/.test(rate), 'FX must be positive'),
  effectiveOn: dateSchema, observedAt: timestampSchema, source: reasonSchema,
  quality: z.enum(['actual', 'historical-reference']),
}).refine((fx) => fx.from !== fx.to, 'FX pair must differ');
export type FxEvidence = z.infer<typeof fxEvidenceSchema>;

// Immutable audit snapshots are bounded at the adapter boundary; never an expanding
// array on the portfolio root. A typed snapshot prevents unchecked arbitrary maps.
export const revisionSnapshotSchema = z.union([
  importedPurchaseSchema, importedPurchaseLineSchema,
  cardCopySchema, purchaseSchema, purchaseLineSchema, saleSchema, saleLineSchema,
  cashMovementSchema, lotSchema, acquisitionRecordSchema, refundSchema, shipmentSchema, shipmentMembershipSchema,
]);
export const revisionSchema = z.strictObject({
  ...metadata, recordId: idSchema, actorUid: idSchema,
  operation: z.enum(['edit', 'reverse', 'basis-correction', 'delivery']),
  reason: reasonSchema, before: revisionSnapshotSchema, after: revisionSnapshotSchema,
}).refine((revision) => revision.ownerUid === revision.actorUid &&
  revision.before.ownerUid === revision.ownerUid && revision.after.ownerUid === revision.ownerUid &&
  revision.recordId === revision.before.id && revision.recordId === revision.after.id &&
  revision.after.revision === revision.before.revision + 1, 'Invalid revision identity or version');
export type Revision = z.infer<typeof revisionSchema>;
