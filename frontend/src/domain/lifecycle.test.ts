import { describe, expect, it } from 'vitest';
import { auditCopyChange, planSale, planShippingRefund, receiveCopy, reverseSaleCopy } from './lifecycle';
import { summarizeCash } from './cash';
import { copy, gbp, known, lines, metadata, purchase, unknown } from './fixtures.test-support';
import type { CashMovement } from './schema';

const later = '2026-12-01T10:00:00Z';
const sale = { ...metadata, id: 'sale', kind: 'sale', transactionOn: '2026-11-21', currency: 'GBP', source: purchase.source, notes: '',
  cardProceeds: known(gbp(3000)), buyerShipping: known(gbp(300)), sellingFees: known(gbp(200)), sellerShipping: known(gbp(400)), sellingTaxes: known(gbp(0)) };
const saleLine = { ...metadata, id: 'sale-line', transactionId: 'sale', copyId: copy.id,
  proceeds: { status: 'exact', value: gbp(3300), evidenceRef: 'sale' }, expenses: { status: 'exact', value: gbp(600), evidenceRef: 'sale' } };
const payment: CashMovement = { ...metadata, id: 'payment', transactionId: 'purchase', direction: 'out', purpose: 'purchase', money: gbp(7100), effectiveOn: known('2026-11-20'), idempotencyKey: 'initial-payment', relatedRecordId: null };
const refund = { ...metadata, id: 'refund', transactionId: 'purchase', cashMovementId: 'refund-cash', scope: 'shipping', amount: gbp(100), effectiveOn: '2026-12-01', reason: 'Combined shipping refund' };
const refundCash: CashMovement = { ...payment, id: 'refund-cash', purpose: 'purchase-refund', direction: 'in', money: gbp(100), effectiveOn: known('2026-12-01'), idempotencyKey: 'refund-key', relatedRecordId: 'refund' };
const allCopies = [
  copy,
  { ...copy, id: 'copy-b', acquisition: { kind: 'purchase' as const, transactionId: 'purchase', lineId: 'line-a', unitOrdinal: 1 }, shippingCost: { status: 'exact' as const, value: gbp(33), evidenceRef: 'purchase' } },
  { ...copy, id: 'copy-c', acquisition: { kind: 'purchase' as const, transactionId: 'purchase', lineId: 'line-b', unitOrdinal: 0 }, shippingCost: { status: 'exact' as const, value: gbp(33), evidenceRef: 'purchase' } },
];

describe('physical copy lifecycle', () => {
  it('receives the same copy once without changing its cost or identity', () => {
    const change = receiveCopy('owner', { ...copy, possession: 'pending' }, later)!;
    expect(change.after).toEqual({ ...copy, revision: 2, updatedAt: later });
    expect(receiveCopy('owner', change.after, later)).toBeNull();
    expect(() => receiveCopy('foreign', copy, later)).toThrow();
    expect(() => receiveCopy('owner', { ...copy, possession: 'unknown' }, later)).toThrow();
  });
  it('sells only the selected received copy and reverses to the same ID', () => {
    const other = { ...copy, id: 'copy-other' };
    const plan = planSale('owner', sale, [saleLine], [copy], later);
    const sold = plan.changes[0]!.after;
    expect(sold).toEqual({ ...copy, disposition: 'sold', dispositionRecordId: 'sale', revision: 2, updatedAt: later });
    expect(other).toEqual({ ...copy, id: 'copy-other' });
    expect(() => planSale('owner', sale, [saleLine], [sold], later)).toThrow();
    expect(reverseSaleCopy('owner', 'sale', sold, later).after).toEqual({ ...copy, revision: 3, updatedAt: later });
    expect(() => reverseSaleCopy('owner', 'wrong-sale', sold, later)).toThrow();
    const audit = auditCopyChange(plan.changes[0]!, 'sale-audit', 'Recorded sale', 'edit');
    expect(audit.before.id).toBe(audit.after.id);
  });
  it('rejects pending copies, foreign ownership, duplicates and unreconciled sales', () => {
    expect(() => planSale('owner', sale, [saleLine], [{ ...copy, possession: 'pending' }], later)).toThrow();
    expect(() => planSale('owner', sale, [saleLine], [{ ...copy, ownerUid: 'foreign' }], later)).toThrow();
    expect(() => planSale('owner', sale, [saleLine, { ...saleLine, id: 'other-line' }], [copy, copy], later)).toThrow();
    expect(() => planSale('owner', sale, [{ ...saleLine, proceeds: { status: 'exact', value: gbp(9999), evidenceRef: 'sale' } }], [copy], later)).toThrow();
    expect(() => planSale('owner', { ...sale, transactionOn: '2026-11-19' }, [saleLine], [copy], later)).toThrow();
  });
  it('refunds shipping without deleting cards or implying a physical return', () => {
    const before = structuredClone(allCopies);
    const changes = planShippingRefund('owner', purchase, lines, [...allCopies].reverse(), refund, refundCash, later);
    expect(changes.map((change) => change.after.shippingCost)).toEqual(Array(3).fill({ status: 'exact', value: gbp(0), evidenceRef: 'refund' }));
    expect(changes.map((change) => change.after.disposition)).toEqual(['held', 'held', 'held']);
    expect(allCopies).toEqual(before);
    expect(() => planShippingRefund('owner', purchase, lines, changes.map((change) => change.after), refund, refundCash, later)).toThrow();
    expect(() => planShippingRefund('owner', purchase, lines, allCopies.slice(1), refund, refundCash, later)).toThrow();
    expect(() => planShippingRefund('owner', purchase, lines, [{ ...copy, disposition: 'sold', dispositionRecordId: 'sale' }, ...allCopies.slice(1)], refund, refundCash, later)).toThrow();
    expect(() => planShippingRefund('owner', purchase, lines, allCopies, refund, { ...refundCash, money: gbp(1) }, later)).toThrow();
  });
  it('reconciles successive penny refunds in canonical physical-copy order', () => {
    const first = { ...refund, amount: gbp(1) }, firstCash = { ...refundCash, money: gbp(1) };
    const afterFirst = planShippingRefund('owner', purchase, lines, [...allCopies].reverse(), first, firstCash, later).map((change) => change.after);
    expect(afterFirst.map((c) => c.shippingCost.status === 'exact' && c.shippingCost.value.minor)).toEqual([33, 33, 33]);
    const second = { ...first, id: 'refund-2', cashMovementId: 'refund-cash-2' };
    const secondCash = { ...firstCash, id: 'refund-cash-2', relatedRecordId: 'refund-2', idempotencyKey: 'refund-2-key' };
    const afterSecond = planShippingRefund('owner', purchase, lines, afterFirst, second, secondCash, later).map((change) => change.after);
    expect(afterSecond.map((c) => c.shippingCost.status === 'exact' && c.shippingCost.value.minor)).toEqual([33, 33, 32]);
  });
});

describe('cash history without retrospective guesses', () => {
  it('puts refunds in their actual month and keeps cash flow separate from profit', () => {
    const saleCash: CashMovement = { ...payment, id: 'sale-cash', transactionId: 'sale', purpose: 'sale', direction: 'in', money: gbp(3300), idempotencyKey: 'sale-payment' };
    const saleExpense: CashMovement = { ...payment, id: 'postage', transactionId: 'sale', purpose: 'sale-expense', money: gbp(600), idempotencyKey: 'sale-postage' };
    const report = summarizeCash('owner', [payment, refundCash, saleCash, saleExpense]);
    expect(report.months).toEqual([
      { month: '2026-11', currency: 'GBP', netMinor: -4400, purchaseSpendMinor: 7100, saleReceiptsMinor: 2700, unclassifiedExpenseMinor: 0 },
      { month: '2026-12', currency: 'GBP', netMinor: 100, purchaseSpendMinor: -100, saleReceiptsMinor: 0, unclassifiedExpenseMinor: 0 },
    ]);
  });
  it('retains undated entries and separates currencies rather than guessing FX', () => {
    const undated = { ...payment, id: 'undated', idempotencyKey: 'undated-key', effectiveOn: unknown };
    const report = summarizeCash('owner', [payment, undated, { ...payment, id: 'usd', idempotencyKey: 'usd-key', money: { currency: 'USD', minor: 10 } }]);
    expect(report.undated).toEqual([undated]);
    expect(report.months.map((row) => row.currency)).toEqual(['GBP', 'USD']);
    expect(() => summarizeCash('foreign', [payment])).toThrow();
    expect(() => summarizeCash('owner', [payment, payment])).toThrow();
  });
});
