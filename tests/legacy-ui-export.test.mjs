import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewLegacyUiExport } from '../scripts/legacy-ui-export.mjs';

const fixture = () => ({
  app: 'pokemon-vintage-binder', version: 4, date: '2026-11-23T14:12:06.337Z',
  owned: { 'base1-1': true }, wish: { 'base1-2': true },
  pendingPurchase: { 'base1-3': { wasWish: false } }, removedWish: {},
  conditions: { 'base1-3': 'LP' }, notes: {},
  purchasePrices: { 'base1-3': { amount: 12, currency: 'GBP' } },
  firstEdition: {}, ownedAddedAt: {},
  shipments: [{ id: 'parcel', cardIds: ['base1-3'], purchaseDate: '2026-11-21' }],
  analyticsSnapshots: [{ date: '2026-11-21', totalValue: 100 }],
  binderExcluded: {}, binderIncludeWish: true,
  binderOrder: ['base1-1', 'base1-2', 'base1-3'],
  wishOrder: ['base1-2'],
});
const options = { ownerUid: 'preview-only', catalogIds: ['base1-1', 'base1-2', 'base1-3'] };

test('accepts v4 menu backup without mutation or fake live-source verification', () => {
  const source = fixture(), before = structuredClone(source);
  const result = previewLegacyUiExport(source, options);
  assert.equal(result.kind, 'legacy-ui-export-preview');
  assert.equal(result.verifiedLiveSource, false);
  assert.equal(result.canApply, false);
  assert.equal(result.report.status, 'PASS');
  assert.deepEqual(result.report.counts, { received: 1, pending: 1, unknownCardCost: 1 });
  assert.deepEqual(result.report.binderReferences.map(r => r.token), source.binderOrder);
  assert.deepEqual(result.report.preservedProgress.analyticsSnapshots, source.analyticsSnapshots);
  assert.deepEqual(source, before);
  assert.deepEqual(previewLegacyUiExport(source, options), result);
});

test('flags mixed-currency parcels without converting or losing original prices', () => {
  const source = fixture();
  source.owned['base1-4'] = true;
  source.purchasePrices['base1-4'] = { amount: 5, currency: 'USD' };
  source.shipments[0].cardIds.push('base1-4');
  const r = previewLegacyUiExport(source, { ...options, catalogIds: [...options.catalogIds, 'base1-4'] });
  assert.equal(r.report.status, 'BLOCKED');
  assert.ok(r.report.exceptions.some(x => x.code === 'MIXED_TRANSACTION_CURRENCY'));
  assert.equal(r.report.transactions[0].lines.length, 2);
});

test('rejects malformed or incomplete exports rather than silently discarding state', () => {
  const source = fixture();
  assert.throws(() => previewLegacyUiExport({ ...source, version: 3 }, options), /INVALID/);
  assert.throws(() => previewLegacyUiExport({ ...source, date: 'not-a-date' }, options), /INVALID/);
  const partial = structuredClone(source);
  delete partial.binderOrder;
  assert.throws(() => previewLegacyUiExport(partial, options), /INCOMPLETE/);
  assert.throws(() => previewLegacyUiExport(source, { ...options, ownerUid: '' }), /OWNER/);
});
