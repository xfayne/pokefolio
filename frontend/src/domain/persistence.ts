import { z } from 'zod';
import { acquisitionRecordSchema, cardCopySchema, cashMovementSchema, idSchema, lotSchema, purchaseLineSchema, purchaseSchema, refundSchema, revisionSchema, saleLineSchema, saleSchema, shipmentMembershipSchema, shipmentSchema } from './schema';

export const portfolioRecordSchema = z.discriminatedUnion('collection', [
  z.strictObject({ collection: z.literal('copies'), record: cardCopySchema }),
  z.strictObject({ collection: z.literal('transactions'), record: z.union([purchaseSchema, saleSchema]) }),
  z.strictObject({ collection: z.literal('lines'), record: z.union([purchaseLineSchema, saleLineSchema]) }),
  z.strictObject({ collection: z.literal('lots'), record: lotSchema }),
  z.strictObject({ collection: z.literal('cashMovements'), record: cashMovementSchema }),
  z.strictObject({ collection: z.literal('acquisitions'), record: acquisitionRecordSchema }),
  z.strictObject({ collection: z.literal('refunds'), record: refundSchema }),
  z.strictObject({ collection: z.literal('shipments'), record: shipmentSchema }),
  z.strictObject({ collection: z.literal('memberships'), record: shipmentMembershipSchema }),
  z.strictObject({ collection: z.literal('revisions'), record: revisionSchema }),
]);
export type PortfolioRecord = z.infer<typeof portfolioRecordSchema>;
const commitSchema = z.strictObject({
  ownerUid: idSchema, idempotencyKey: idSchema,
  creates: z.array(portfolioRecordSchema).max(10_000),
  updates: z.array(z.strictObject({ before: portfolioRecordSchema, after: portfolioRecordSchema })).max(10_000),
});
export type PortfolioCommit = z.infer<typeof commitSchema>;
export type CommitReceipt = Readonly<{ idempotencyKey: string; status: 'committed' | 'replayed' }>;

export function recordKey(entry: PortfolioRecord): string {
  const scope = 'transactionId' in entry.record && entry.collection === 'lines' ? `${entry.record.transactionId}/` :
    entry.collection === 'memberships' ? `${entry.record.shipmentId}/` : '';
  return `${entry.collection}/${scope}${entry.record.id}`;
}

/** Validate against a capacity VERIFIED by the eventual adapter, never a guessed
 * Firestore limit. The adapter must enforce atomicity/auth/reference checks too. */
export function prepareCommit(ownerUid: string, raw: unknown, maxWrites: number): PortfolioCommit {
  const commit = commitSchema.parse(raw);
  if (!Number.isSafeInteger(maxWrites) || maxWrites < 1 || commit.ownerUid !== ownerUid) throw new Error('Commit policy/owner mismatch');
  const writes = commit.creates.length + commit.updates.length;
  // Reserve one atomic write for the idempotency receipt as well as the records.
  if (!writes || writes + 1 > maxWrites) throw new Error('Commit exceeds verified atomic capacity');
  const keys = new Set<string>();
  for (const entry of [...commit.creates, ...commit.updates.map((update) => update.after)]) {
    const key = recordKey(entry);
    if (entry.record.ownerUid !== ownerUid || keys.has(key)) throw new Error('Foreign or duplicate record write');
    keys.add(key);
  }
  if (commit.creates.some((entry) => entry.record.revision !== 1)) throw new Error('New records start at revision one');
  for (const update of commit.updates) {
    const before = update.before.record, after = update.after.record;
    if (update.before.collection !== update.after.collection || recordKey(update.before) !== recordKey(update.after) || before.ownerUid !== ownerUid || after.revision !== before.revision + 1 || before.createdAt !== after.createdAt || Date.parse(after.updatedAt) < Date.parse(before.updatedAt) || update.after.collection === 'revisions') throw new Error('Invalid immutable identity or expected revision');
    if (('kind' in before ? before.kind : null) !== ('kind' in after ? after.kind : null)) throw new Error('Record kind is immutable');
    const audit = commit.creates.find((entry) => entry.collection === 'revisions' && entry.record.recordId === before.id && JSON.stringify(entry.record.before) === JSON.stringify(before) && JSON.stringify(entry.record.after) === JSON.stringify(after));
    if (!audit) throw new Error('Every update requires a matching immutable audit record');
  }
  return commit;
}

/** An authenticated adapter must scope EVERY read/write to its owner, reject
 * missing/stale references and creation conflicts, and commit all-or-nothing.
 * Reusing a key with the SAME payload returns the original receipt; a different
 * payload is a conflict. Save the key atomically with the records. Updates compare
 * stored snapshots/revisions, sales check current eligibility and reversals check
 * dependent activity. No implementation, cloud permissions or live IO here. */
export interface OwnerPortfolioRepository {
  readonly ownerUid: string;
  readonly maxAtomicWrites: number;
  get(collection: PortfolioRecord['collection'], id: string, parentId?: string): Promise<PortfolioRecord | null>;
  commit(command: PortfolioCommit): Promise<CommitReceipt>;
}
