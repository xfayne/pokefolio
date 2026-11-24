import type { PortfolioCommit } from '@/domain/persistence';

/** Excludes all edits (including added copies), sales, receipts, and imports. */
export function isNewPurchase(command: PortfolioCommit): boolean {
  return command.updates.length === 0 && command.creates.some(entry =>
    entry.collection === 'transactions' && entry.record.kind === 'purchase' &&
    !('origin' in entry.record) && entry.record.id === command.idempotencyKey);
}
