import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackup } from '../scripts/legacy-backup.mjs';
import { previewLegacy } from '../scripts/legacy-preview.mjs';
const fixture = (patch = {}) => ({ owned: { a: true, childhood: true }, pendingPurchase: { b: { wasWish: true, wishIndex: 2 } }, purchasePrices: { a: { amount: 20, currency: 'GBP' }, b: { amount: 0, currency: 'GBP' } }, conditions: { a: 'DMG' }, firstEdition: { a: false }, binderOrder: ['a', '__binder_empty__:1', 'b', 'z', 'a'], wish: { z: true }, wishOrder: ['z'], shipments: [{ id: 'parcel', cardIds: ['b'], purchaseDate: '2026-11-12', seenEventIds: ['read'], initialized: true }], analyticsSnapshots: [{ custom: 123 }], ...patch });
function preview(progress) {
  const backup = createBackup({ source: { projectId: 'synthetic', ownerUid: 'test', revision: '1', capturedAt: '2026-11-20T00:00:00Z' }, documents: { root: { progress } }, inventory: [{ path: 'root', status: 'present' }] });
  return previewLegacy(backup, { rootPath: 'root', requiredPaths: ['root'], catalogIds: ['a', 'b', 'childhood', 'z'] });
}
test('opening inventory retains costs, dates, holes, pending positions and all raw state', () => {
  const input = fixture(), before = structuredClone(input), result = preview(input);
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.counts, { received: 2, pending: 1, unknownCardCost: 1 });
  assert.equal(result.copies.find(c => c.cardId === 'a').condition.value, 'DAMAGED');
  assert.equal(result.copies.find(c => c.cardId === 'b').cardCost.value.minor, 0);
  assert.equal(result.copies.find(c => c.cardId === 'childhood').acquiredOn.status, 'unknown');
  assert.deepEqual(result.knownCardAmountsMinor, { GBP: 2000 });
  assert.deepEqual(result.preservedProgress, input);
  assert.deepEqual(input, before);
  assert.equal(result.transactions.length + result.cashMovements.length, 0);
  assert.deepEqual(result.binderReferences.map(r => r.token), input.binderOrder);
  assert.deepEqual(preview(input), result);
});
test('blocks conflicts without inventing duplicate copies or normalizing raw state', () => {
  const input = fixture({ owned: { a: true, b: true }, shipments: [{ id: 'one', cardIds: ['a'] }, { id: 'two', cardIds: ['a'] }] });
  const r = preview(input);
  assert.equal(r.status, 'BLOCKED');
  assert.ok(r.exceptions.some(x => x.code === 'OWNED_PENDING_CONFLICT'));
  assert.ok(r.exceptions.some(x => x.code === 'AMBIGUOUS_COPY_MEMBERSHIP'));
  assert.equal(r.copies.length, 1);
  assert.deepEqual(r.preservedProgress, input);
});
test('rejects malformed price/date and unresolved references', () => {
  const r = preview(fixture({ purchasePrices: { a: { amount: 1.111, currency: 'GBP' } }, shipments: [{ id: 'parcel', cardIds: ['b', 'unknown'], purchaseDate: '2026-02-30' }], binderOrder: ['missing'] }));
  for (const code of ['INVALID_PRICE', 'INVALID_OR_CONFLICTING_DATE', 'UNRESOLVED_COPY', 'UNRESOLVED_BINDER_REFERENCE']) assert.ok(r.exceptions.some(x => x.code === code), code);
  assert.equal(r.status, 'BLOCKED');
});
