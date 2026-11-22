import { describe, expect, it } from 'vitest';
import { acquisitionRecordSchema, cardCopySchema, cashMovementSchema, costSchema, dateSchema, fxEvidenceSchema, moneySchema, purchaseSchema, revisionSchema } from './schema';
import { copy, gbp, known, metadata, purchase, unknown } from './fixtures.test-support';

describe('private portfolio contracts', () => {
  it('retains exact zero, unknown, unallocated and estimated costs as different states', () => {
    const costs = [copy.feeCost, unknown, { status: 'unallocated', lotId: 'lot' }, { status: 'estimated', value: gbp(0), method: 'User estimate' }];
    expect(costs.map((cost) => costSchema.parse(cost).status)).toEqual(['exact', 'unknown', 'unallocated', 'estimated']);
  });
  it.each([1.1, -1, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])('rejects unsafe minor money %s', (minor) => {
    expect(moneySchema.safeParse(gbp(minor)).success).toBe(false);
  });
  it.each(['2026-02-29', '2026-11-31', '0000-01-01', '2026-1-01'])('rejects invalid civil date %s', (date) => {
    expect(dateSchema.safeParse(date).success).toBe(false);
  });
  it('accepts leap days and requires explicit missing dates for opening inventory', () => {
    expect(dateSchema.parse('2024-02-29')).toBe('2024-02-29');
    expect(acquisitionRecordSchema.parse({ ...metadata, id: 'opening', kind: 'opening-inventory', effectiveOn: unknown, reason: 'Existing childhood card', legacyReference: null }).effectiveOn).toEqual(unknown);
    expect(cardCopySchema.parse({ ...copy, acquisition: { kind: 'opening-inventory', recordId: 'opening' }, acquiredOn: unknown, cardCost: unknown }).acquiredOn).toEqual(unknown);
  });
  it('rejects extra fields, invalid versions, missing disposition and currency mismatch', () => {
    expect(cardCopySchema.safeParse({ ...copy, binderOrder: [] }).success).toBe(false);
    expect(cardCopySchema.safeParse({ ...copy, schemaVersion: 2 }).success).toBe(false);
    expect(cardCopySchema.safeParse({ ...copy, disposition: 'sold' }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...purchase, shipping: known({ currency: 'USD', minor: 100 }) }).success).toBe(false);
  });
  it('reconciles complete totals and retains incomplete breakdowns without zero filling', () => {
    expect(purchaseSchema.parse(purchase)).toEqual(purchase);
    expect(purchaseSchema.safeParse({ ...purchase, payable: gbp(7101) }).success).toBe(false);
    expect(purchaseSchema.parse({ ...purchase, taxes: unknown }).taxes).toEqual(unknown);
    expect(purchaseSchema.safeParse({ ...purchase, shipping: unknown, payable: gbp(6999) }).success).toBe(false);
  });
  it('rejects reversed purchase payment direction', () => {
    const payment = { ...metadata, id: 'payment', transactionId: 'purchase', direction: 'out', purpose: 'purchase', money: gbp(7100), effectiveOn: known('2026-11-20'), idempotencyKey: 'initial-payment', relatedRecordId: null };
    expect(cashMovementSchema.parse(payment)).toEqual(payment);
    expect(cashMovementSchema.safeParse({ ...payment, direction: 'in' }).success).toBe(false);
  });
  it('requires a positive historical FX rate and identifies reference estimates', () => {
    const fx = { from: 'GBP', to: 'USD', rateDecimal: '1.25', effectiveOn: '2026-11-20', observedAt: metadata.createdAt, source: 'Synthetic reference', quality: 'historical-reference' };
    expect(fxEvidenceSchema.parse(fx).quality).toBe('historical-reference');
    expect(fxEvidenceSchema.safeParse({ ...fx, rateDecimal: '0.0' }).success).toBe(false);
    expect(fxEvidenceSchema.safeParse({ ...fx, to: 'GBP' }).success).toBe(false);
  });
  it('keeps revision ownership and record identity stable', () => {
    const revision = { ...metadata, id: 'revision', recordId: copy.id, actorUid: 'owner', operation: 'edit', reason: 'Condition inspected', before: copy, after: { ...copy, revision: 2, condition: known('MP') } };
    expect(revisionSchema.parse(revision).after.revision).toBe(2);
    expect(revisionSchema.safeParse({ ...revision, actorUid: 'foreign' }).success).toBe(false);
    expect(revisionSchema.safeParse({ ...revision, after: { ...copy, revision: 2, id: 'other' } }).success).toBe(false);
  });
});
