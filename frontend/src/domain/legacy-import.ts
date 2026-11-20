import { z } from 'zod';
import { acquisitionRecordSchema, cardCopySchema, shipmentSchema, shipmentMembershipSchema, idSchema } from './schema';

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
  transactionDrafts: z.array(z.unknown()).default([]),
});
const unknown = (reason: string) => ({ status: 'unknown' as const, reason });

export function materializeLegacyDraft(report: unknown, ownerUid: string, recordedAt: string) {
  const input = reportSchema.parse(report);
  if (ownerUid !== input.source.ownerUid) throw Error('OWNER_MISMATCH');
  const meta = (id: string) => ({ schemaVersion: 1 as const, id, ownerUid, revision: 1, createdAt: recordedAt, updatedAt: recordedAt });
  const notes = input.preservedProgress.notes;
  const noteMap = notes && typeof notes === 'object' && !Array.isArray(notes) ? notes as Record<string, unknown> : {};
  const acquisitions = input.copies.map(c => acquisitionRecordSchema.parse({ ...meta(`opening-${c.id}`), kind: 'opening-inventory', effectiveOn: c.acquiredOn, reason: 'Imported opening inventory; no reconstructed purchase or payment', legacyReference: c.cardId }));
  const copies = input.copies.map((c, i) => cardCopySchema.parse({
    ...meta(c.id), catalog: { kind: 'identified', cardId: c.cardId, edition: c.edition, language: unknown('No explicit source language'), finish: unknown('No explicit source finish') },
    condition: c.condition, acquiredOn: c.acquiredOn,
    acquisition: { kind: 'opening-inventory', recordId: acquisitions[i]!.id },
    possession: c.possession, disposition: 'held', dispositionRecordId: null,
    cardCost: c.cardCost.status === 'exact' ? { status: 'exact', value: c.cardCost.value, evidenceRef: acquisitions[i]!.id } : c.cardCost,
    shippingCost: unknown('Not evidenced'), taxCost: unknown('Not evidenced'), feeCost: unknown('Not evidenced'),
    notes: Object.hasOwn(noteMap, c.cardId) ? noteMap[c.cardId] : '',
  }));
  if (new Set(copies.map(c => c.id)).size !== copies.length || new Set(copies.map(c => c.catalog.kind === 'identified' ? c.catalog.cardId : '')).size !== copies.length) throw Error('DUPLICATE_LEGACY_IDENTITY');
  const rawParcels = z.array(z.object({ id: z.string(), number: z.string().optional(), note: z.string().optional() })).parse(input.preservedProgress.shipments ?? []);
  // Index identity is stable within the immutable, approved report; raw parcel IDs
  // and provider metadata remain preserved outside these private finance DTOs.
  const shipments = rawParcels.map((p, i) => shipmentSchema.parse({ ...meta(`legacy-parcel-${i}`), trackingNumber: p.number || null, deliveredOn: unknown('Raw delivery timestamp retained; civil date not inferred'), notes: p.note ?? '' }));
  const memberships = input.memberships.map((m, i) => {
    if (!shipments[m.parcelIndex] || !copies.some(c => c.id === m.copyId && c.catalog.kind === 'identified' && c.catalog.cardId === m.cardId)) throw Error('INVALID_MEMBERSHIP_REFERENCE');
    return shipmentMembershipSchema.parse({ ...meta(`legacy-membership-${i}`), shipmentId: shipments[m.parcelIndex]!.id, transactionId: null, copyId: m.copyId, ordinal: m.ordinal });
  });
  if (new Set(memberships.map(m => m.copyId)).size !== memberships.length) throw Error('AMBIGUOUS_MEMBERSHIP');
  return { copies, acquisitions, shipments, memberships, preservedProgress: structuredClone(input.preservedProgress), transactionDrafts: structuredClone(input.transactionDrafts), transactions: [], cashMovements: [] };
}
