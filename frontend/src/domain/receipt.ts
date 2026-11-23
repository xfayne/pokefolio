import { receiveCopy } from './lifecycle';
import { prepareCommit, type PortfolioCommit, type PortfolioRecord } from './persistence';
import { revisionSchema, type Shipment } from './schema';

export function auditedUpdate(before: PortfolioRecord, after: PortfolioRecord, operation: 'delivery' | 'edit'): PortfolioCommit {
  return {
    ownerUid: before.record.ownerUid, idempotencyKey: `update-${crypto.randomUUID()}`,
    updates: [{ before, after }], creates: [{ collection: 'revisions', record: revisionSchema.parse({
      schemaVersion: 1, id: `audit-${crypto.randomUUID()}`, ownerUid: before.record.ownerUid, actorUid: before.record.ownerUid,
      revision: 1, createdAt: after.record.updatedAt, updatedAt: after.record.updatedAt, recordId: before.record.id,
      operation, reason: operation === 'delivery' ? 'Purchase received manually' : 'Tracking updated', before: before.record, after: after.record,
    }) }],
  };
}
export function updateShipment(before: Shipment, patch: Partial<Shipment>, at: string) {
  return auditedUpdate({ collection: 'shipments', record: before }, { collection: 'shipments', record: { ...before, ...patch, revision: before.revision + 1, updatedAt: at } }, 'edit');
}

// Bounded audited commits support large purchases without exceeding the existing
// 20-audit rules limit. Already received copies are skipped on recovery/retry.
export function receivePurchase(owner: string, id: string, records: readonly PortfolioRecord[], at: string): PortfolioCommit[] {
  const purchase = records.find(e => e.collection === 'transactions' && e.record.id === id);
  if (!purchase || purchase.record.ownerUid !== owner || purchase.collection !== 'transactions' || purchase.record.kind !== 'purchase') throw Error('Purchase unavailable');
  const copies = records.filter(e => e.collection === 'copies' && !e.record.removedFromImport && e.record.acquisition.kind === 'purchase' && e.record.acquisition.transactionId === id);
  if (!copies.length) throw Error('Purchase has no copies');
  if (copies.some(e => e.collection === 'copies' && e.record.possession === 'unknown')) throw Error('Unknown possession requires an inventory correction');
  const changes = copies.flatMap(e => {
    if (e.collection !== 'copies') return [];
    const change = receiveCopy(owner, e.record, at);
    return change ? [auditedUpdate(e, { collection: 'copies', record: change.after }, 'delivery')] : [];
  });
  const result: PortfolioCommit[] = [];
  for (let i = 0; i < changes.length; i += 20) {
    const batch = changes.slice(i, i + 20);
    result.push(prepareCommit(owner, { ownerUid: owner, idempotencyKey: `receive-${crypto.randomUUID()}`, creates: batch.flatMap(c => c.creates), updates: batch.flatMap(c => c.updates) }, 450));
  }
  return result;
}

// Receipt commands may change possession and revision metadata only. They cannot
// rewrite costs, acquisition, disposition, shipments or organization records.
export function validateReceiptCommit(command: PortfolioCommit): boolean {
  const changes = command.updates.filter(u => u.before.collection === 'copies' && u.after.collection === 'copies' && u.before.record.possession !== u.after.record.possession);
  if (!changes.length) return false;
  if (changes.length !== command.updates.length || command.creates.length !== changes.length || command.creates.some(e => e.collection !== 'revisions' || e.record.operation !== 'delivery')) throw Error('Invalid receipt write set');
  let purchaseId: string | null = null;
  for (const { before, after } of changes) {
    if (before.collection !== 'copies' || after.collection !== 'copies') throw Error('Invalid receipt');
    const expected = receiveCopy(command.ownerUid, before.record, after.record.updatedAt)?.after;
    if (!expected || JSON.stringify(expected) !== JSON.stringify(after.record) || before.record.acquisition.kind !== 'purchase') throw Error('Receipt cannot change copy costs or identity');
    const id = before.record.acquisition.transactionId;
    if (purchaseId && purchaseId !== id) throw Error('Receipt belongs to one purchase');
    purchaseId = id;
  }
  return true;
}
