import { z } from 'zod';
import { acquisitionRecordSchema, cardCopySchema, shipmentSchema, shipmentMembershipSchema, idSchema, importedPurchaseSchema, importedPurchaseLineSchema, dateSchema } from './schema';

// Offline draft materialization only: recordedAt is a planning timestamp.
// A future adapter must supply authoritative server timestamps on commit.
const reportSchema = z.object({
  mappingVersion: z.literal(1), status: z.literal('PASS'),
  source: z.object({ ownerUid: idSchema }),
  copies: z.array(z.object({
    id: idSchema, cardId: idSchema, possession: z.enum(['pending', 'received']),
    condition: cardCopySchema.shape.condition,
    edition: z.enum(['unlimited', 'first-edition', 'unknown']),
    acquiredOn: cardCopySchema.shape.acquiredOn,
    cardCost: z.discriminatedUnion('status', [
      z.object({ status: z.literal('exact'), value: cardCopySchema.shape.cardCost.options[0]!.shape.value, sourcePath: z.string() }),
      z.object({ status: z.literal('unknown'), reason: z.string() }),
    ]),
  })),
  memberships: z.array(z.object({ parcelIndex: z.number().int().nonnegative(), ordinal: z.number().int().nonnegative(), cardId: idSchema, copyId: idSchema })),
  preservedProgress: z.record(z.string(), z.unknown()),
  transactions: z.array(z.object({ id: idSchema, sourceParcelIndex: z.number().int().nonnegative() })),
});
const unknown = (reason: string) => ({ status: 'unknown' as const, reason });

export function materializeLegacyDraft(report: unknown, ownerUid: string, recordedAt: string) {
  const input = reportSchema.parse(report);
  if (ownerUid !== input.source.ownerUid) throw Error('OWNER_MISMATCH');
  const meta = (id: string) => ({ schemaVersion: 1 as const, id, ownerUid, revision: 1, createdAt: recordedAt, updatedAt: recordedAt });
  const notes = input.preservedProgress.notes;
  const noteMap = notes && typeof notes === 'object' && !Array.isArray(notes) ? notes as Record<string, unknown> : {};
  const rawParcels = z.array(z.object({ id: z.string().min(1).max(128), number: z.string().optional(), note: z.string().optional(), purchaseDate: dateSchema.optional(), cardIds: z.array(idSchema) })).parse(input.preservedProgress.shipments ?? []);
  if (new Set(rawParcels.map(p => p.id)).size !== rawParcels.length || input.transactions.length !== rawParcels.length || new Set(input.transactions.map(t => t.id)).size !== rawParcels.length || new Set(input.transactions.map(t => t.sourceParcelIndex)).size !== rawParcels.length) throw Error('INVALID_TRANSACTION_MAPPING');
  if (new Set(input.memberships.map(m => m.copyId)).size !== input.memberships.length) throw Error('AMBIGUOUS_MEMBERSHIP');
  const transactionFor = (index: number) => {
    const transaction = input.transactions.find(t => t.sourceParcelIndex === index);
    if (!transaction || !rawParcels[index]) throw Error('INVALID_TRANSACTION_REFERENCE');
    return transaction;
  };
  for (const [index, parcel] of rawParcels.entries()) {
    transactionFor(index);
    const links = input.memberships.filter(m => m.parcelIndex === index);
    if (!parcel.cardIds.length || links.length !== parcel.cardIds.length || parcel.cardIds.some((id, ordinal) => !links.some(m => m.ordinal === ordinal && m.cardId === id))) throw Error('INCOMPLETE_PARCEL_MEMBERSHIP');
  }
  const acquisitions = input.copies.filter(c => !input.memberships.some(m => m.copyId === c.id)).map(c => acquisitionRecordSchema.parse({ ...meta(`opening-${c.id}`), kind: 'opening-inventory', effectiveOn: c.acquiredOn, reason: 'Imported opening inventory without parcel purchase evidence', legacyReference: c.cardId }));
  const copies = input.copies.map(c => {
    const membership = input.memberships.find(m => m.copyId === c.id);
    const transaction = membership ? transactionFor(membership.parcelIndex) : null;
    const evidenceRef = transaction?.id ?? `opening-${c.id}`;
    return cardCopySchema.parse({
    ...meta(c.id), catalog: { kind: 'identified', cardId: c.cardId, edition: c.edition, language: unknown('No explicit source language'), finish: unknown('No explicit source finish') },
    condition: c.condition, acquiredOn: c.acquiredOn,
    acquisition: transaction && membership ? { kind: 'purchase', transactionId: transaction.id, lineId: `${transaction.id}-line-${membership.ordinal}`, unitOrdinal: 0 } : { kind: 'opening-inventory', recordId: evidenceRef },
    possession: c.possession, disposition: 'held', dispositionRecordId: null,
    cardCost: c.cardCost.status === 'exact' ? { status: 'exact', value: c.cardCost.value, evidenceRef } : c.cardCost,
    shippingCost: unknown('Not evidenced'), taxCost: unknown('Not evidenced'), feeCost: unknown('Not evidenced'),
    notes: Object.hasOwn(noteMap, c.cardId) ? noteMap[c.cardId] : '',
    });
  });
  if (new Set(copies.map(c => c.id)).size !== copies.length || new Set(copies.map(c => c.catalog.kind === 'identified' ? c.catalog.cardId : '')).size !== copies.length) throw Error('DUPLICATE_LEGACY_IDENTITY');
  // Index identity is stable within the immutable, approved report; raw parcel IDs
  // and provider metadata remain preserved outside these private finance DTOs.
  const shipments = rawParcels.map((p, i) => shipmentSchema.parse({ ...meta(`legacy-parcel-${i}`), trackingNumber: p.number || null, deliveredOn: unknown('Raw delivery timestamp retained; civil date not inferred'), notes: p.note ?? '' }));
  const memberships = input.memberships.map((m, i) => {
    if (!shipments[m.parcelIndex] || !copies.some(c => c.id === m.copyId && c.catalog.kind === 'identified' && c.catalog.cardId === m.cardId)) throw Error('INVALID_MEMBERSHIP_REFERENCE');
    return shipmentMembershipSchema.parse({ ...meta(`legacy-membership-${i}`), shipmentId: shipments[m.parcelIndex]!.id, transactionId: transactionFor(m.parcelIndex).id, copyId: m.copyId, ordinal: m.ordinal });
  });
  if (new Set(memberships.map(m => m.copyId)).size !== memberships.length) throw Error('AMBIGUOUS_MEMBERSHIP');
  const lines = input.memberships.map(m => {
    const copy = copies.find(c => c.id === m.copyId)!;
    const transaction = transactionFor(m.parcelIndex);
    return importedPurchaseLineSchema.parse({ ...meta(`${transaction.id}-line-${m.ordinal}`), origin: 'legacy-import', transactionId: transaction.id, ordinal: m.ordinal, quantity: 1, catalog: copy.catalog, pricing: { mode: 'per-copy', unitPrice: copy.cardCost.status === 'exact' ? { status: 'known', value: copy.cardCost.value, source: 'legacy' } : unknown('No original card price') } });
  });
  const transactions = rawParcels.map((parcel, index) => {
    const transaction = transactionFor(index);
    const prices = lines.filter(l => l.transactionId === transaction.id).map(l => l.pricing.unitPrice);
    const currencies = [...new Set(prices.flatMap(p => p.status === 'known' ? [p.value.currency] : []))];
    if (currencies.length > 1) throw Error('MIXED_TRANSACTION_CURRENCY');
    const sum = prices.reduce((total, p) => total + (p.status === 'known' ? BigInt(p.value.minor) : 0n), 0n);
    if (sum > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('UNSAFE_TOTAL');
    const total = prices.every(p => p.status === 'known') && currencies[0] ? { status: 'known' as const, value: { currency: currencies[0], minor: Number(sum) }, source: 'legacy' as const } : unknown('Incomplete card prices');
    return importedPurchaseSchema.parse({ ...meta(transaction.id), kind: 'purchase', origin: 'legacy-import', sourceParcelId: parcel.id, notes: parcel.note ?? '',
      transactionOn: parcel.purchaseDate ? { status: 'known', value: parcel.purchaseDate, source: 'legacy' } : unknown('No original purchase date'),
      currency: currencies[0] ? { status: 'known', value: currencies[0], source: 'legacy' } : unknown('No original currency'),
      subtotal: total, payable: total, totalBasis: 'recorded-card-prices', shipping: unknown('Not separately recorded'), taxes: unknown('Not separately recorded'), fees: unknown('Not separately recorded'), settlement: 'unknown' });
  });
  return { copies, acquisitions, shipments, memberships, lines, preservedProgress: structuredClone(input.preservedProgress), transactions, cashMovements: [] };
}
