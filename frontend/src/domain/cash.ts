import { cashMovementSchema, type CashMovement, type Money } from './schema';
import { safeInteger } from './money';

export type CashMonth = Readonly<{ month: string; currency: Money['currency']; netMinor: number; purchaseSpendMinor: number; saleReceiptsMinor: number; unclassifiedExpenseMinor: number }>;
export type CashReport = Readonly<{ months: readonly CashMonth[]; undated: readonly CashMovement[] }>;

/** Ledger facts only; no inventory timestamps, FX guesses or market values. */
export function summarizeCash(ownerUid: string, inputs: readonly unknown[]): CashReport {
  const movements = inputs.map((input) => cashMovementSchema.parse(input));
  const ids = new Set<string>(), keys = new Set<string>();
  const grouped = new Map<string, { month: string; currency: Money['currency']; net: bigint; purchase: bigint; sale: bigint; unclassified: bigint }>();
  const undated: CashMovement[] = [];
  for (const movement of movements) {
    if (movement.ownerUid !== ownerUid || ids.has(movement.id) || keys.has(movement.idempotencyKey)) throw new Error('Cash ledger owner or duplicate mismatch');
    ids.add(movement.id); keys.add(movement.idempotencyKey);
    if (movement.effectiveOn.status === 'unknown') { undated.push(movement); continue; }
    const month = movement.effectiveOn.value.slice(0, 7), currency = movement.money.currency, key = `${month}:${currency}`;
    const bucket = grouped.get(key) ?? { month, currency, net: 0n, purchase: 0n, sale: 0n, unclassified: 0n };
    const amount = BigInt(movement.money.minor);
    bucket.net += movement.direction === 'in' ? amount : -amount;
    if (movement.purpose === 'purchase' || movement.purpose === 'purchase-expense') bucket.purchase += amount;
    if (movement.purpose === 'purchase-refund') bucket.purchase -= amount;
    if (movement.purpose === 'sale') bucket.sale += amount;
    if (movement.purpose === 'sale-refund') bucket.sale -= amount;
    if (movement.purpose === 'sale-expense') bucket.sale -= amount;
    if (movement.purpose === 'expense') bucket.unclassified += amount;
    grouped.set(key, bucket);
  }
  return { months: [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency)).map((bucket) => ({
    month: bucket.month, currency: bucket.currency, netMinor: safeInteger(bucket.net), purchaseSpendMinor: safeInteger(bucket.purchase),
    saleReceiptsMinor: safeInteger(bucket.sale), unclassifiedExpenseMinor: safeInteger(bucket.unclassified),
  })), undated };
}
