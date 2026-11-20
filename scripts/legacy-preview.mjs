import { validateBackup, cloneJson, digest, backupCoverage } from './legacy-backup.mjs';

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const unknown = reason => ({ status: 'unknown', reason });
const own = (o, k) => Object.hasOwn(o, k);

// Intermediate read-only mapping, deliberately NOT persistence-ready domain DTOs.
// Exact raw organization/source data accompanies reference sidecars. No old
// normalizer, catalog pruning, transaction reconstruction or cloud SDK is used.
export function previewLegacy(backup, { rootPath, catalogIds, requiredPaths }) {
  validateBackup(backup);
  if (!Array.isArray(catalogIds) || !catalogIds.every(x => typeof x === 'string') || !Array.isArray(requiredPaths) || !requiredPaths.includes(rootPath)) throw Error('INVALID_PREVIEW_SCOPE');
  const root = backup.payload.documents[rootPath];
  if (!object(root?.progress)) throw Error('MISSING_PROGRESS');
  const p = cloneJson(root.progress), exceptions = [], copies = [], memberships = [];
  const issue = (path, code, raw) => exceptions.push({ path, code, raw: cloneJson(raw) });
  const maps = {};
  for (const key of ['owned', 'pendingPurchase', 'purchasePrices', 'conditions', 'firstEdition', 'notes', 'wish', 'removedWish', 'ownedAddedAt', 'binderExcluded']) {
    if (own(p, key) && !object(p[key])) issue(key, 'EXPECTED_MAP', p[key]);
    maps[key] = object(p[key]) ? p[key] : {};
  }
  for (const key of ['binderOrder', 'wishOrder', 'shipments', 'analyticsSnapshots']) if (own(p, key) && !Array.isArray(p[key])) issue(key, 'EXPECTED_ARRAY', p[key]);
  const parcels = Array.isArray(p.shipments) ? p.shipments : [];
  const parcelIds = new Set();
  for (const [i, parcel] of parcels.entries()) {
    if (!object(parcel) || typeof parcel.id !== 'string' || !parcel.id || !Array.isArray(parcel.cardIds) || parcel.cardIds.some(id => typeof id !== 'string') || parcelIds.has(parcel.id)) {
      issue(`shipments[${i}]`, 'INVALID_OR_DUPLICATE_PARCEL', parcel); continue;
    }
    parcelIds.add(parcel.id);
  }
  const validDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  const byCatalog = new Map();
  for (const [id, value] of Object.entries(maps.owned)) if (typeof value !== 'boolean') issue(`owned.${id}`, 'INVALID_OWNERSHIP_MARKER', value);
  for (const [id, value] of Object.entries(maps.pendingPurchase)) if (!object(value)) issue(`pendingPurchase.${id}`, 'INVALID_PENDING_METADATA', value);
  const ids = [...new Set([...Object.keys(maps.owned), ...Object.keys(maps.pendingPurchase)])].sort();
  for (const cardId of ids) {
    const received = !!maps.owned[cardId], pending = !!maps.pendingPurchase[cardId];
    if (!received && !pending) continue;
    if (received && pending) { issue(`owned.${cardId}`, 'OWNED_PENDING_CONFLICT', { owned: maps.owned[cardId], pending: maps.pendingPurchase[cardId] }); continue; }
    if (!catalogIds.includes(cardId)) issue(`inventory.${cardId}`, 'UNKNOWN_CATALOG_ID', cardId);
    const copyId = 'legacy-' + digest({ source: backup.sha256, cardId, mapping: 1 });
    const linked = parcels.filter(s => object(s) && Array.isArray(s.cardIds) && s.cardIds.includes(cardId));
    if (linked.length > 1) issue(`shipments.${cardId}`, 'AMBIGUOUS_COPY_MEMBERSHIP', linked);
    const dates = [...new Set(linked.map(s => s.purchaseDate).filter(v => v !== undefined))];
    if (dates.some(v => !validDate(v)) || dates.length > 1) issue(`purchaseDate.${cardId}`, 'INVALID_OR_CONFLICTING_DATE', dates);
    if (pending && linked.some(s => s.deliveredAt)) issue(`shipments.${cardId}`, 'PENDING_DELIVERED_CONFLICT', linked);
    let cardCost = unknown('No original card price');
    if (own(maps.purchasePrices, cardId)) {
      const price = maps.purchasePrices[cardId];
      const amount = price?.amount, minor = typeof amount === 'number' ? Math.round(amount * 100) : NaN;
      if (!object(price) || !['GBP', 'ILS', 'USD', 'EUR'].includes(price.currency) || !Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(minor) || Math.abs(amount * 100 - minor) > 0.0000001) issue(`purchasePrices.${cardId}`, 'INVALID_PRICE', price);
      else cardCost = { status: 'exact', value: { currency: price.currency, minor }, sourcePath: `purchasePrices.${cardId}` };
    }
    const grade = maps.conditions[cardId];
    if (grade !== undefined && !['NM', 'LP', 'MP', 'HP', 'DMG', 'DAMAGED'].includes(grade)) issue(`conditions.${cardId}`, 'UNKNOWN_CONDITION', grade);
    const edition = maps.firstEdition[cardId];
    if (edition !== undefined && typeof edition !== 'boolean') issue(`firstEdition.${cardId}`, 'INVALID_EDITION', edition);
    const copy = { id: copyId, cardId, acquisition: 'opening-inventory', possession: received ? 'received' : 'pending',
      condition: ['NM', 'LP', 'MP', 'HP', 'DMG', 'DAMAGED'].includes(grade) ? { status: 'known', value: grade === 'DMG' ? 'DAMAGED' : grade } : unknown('No valid original condition'),
      edition: typeof edition === 'boolean' ? edition ? 'first-edition' : 'unlimited' : 'unknown',
      acquiredOn: dates.length === 1 && validDate(dates[0]) && linked.length === 1 ? { status: 'known', value: dates[0], source: 'legacy' } : unknown('No unambiguous purchase date'),
      cardCost, shippingCost: unknown('Not evidenced'), taxCost: unknown('Not evidenced'), feeCost: unknown('Not evidenced') };
    copies.push(copy); byCatalog.set(cardId, copyId);
  }
  for (const [index, parcel] of parcels.entries()) {
    if (!object(parcel) || !Array.isArray(parcel.cardIds)) continue;
    for (const [ordinal, cardId] of parcel.cardIds.entries()) {
      const copyId = byCatalog.get(cardId);
      if (!copyId) issue(`shipments[${index}].cardIds[${ordinal}]`, 'UNRESOLVED_COPY', cardId);
      memberships.push({ parcelIndex: index, ordinal, cardId, copyId: copyId ?? null });
    }
  }
  const binderReferences = (Array.isArray(p.binderOrder) ? p.binderOrder : []).map((token, index) => {
    if (typeof token !== 'string') issue(`binderOrder[${index}]`, 'INVALID_BINDER_TOKEN', token);
    const kind = typeof token === 'string' && token.startsWith('__binder_empty__:') ? 'empty' : byCatalog.has(token) ? 'copy' : typeof token === 'string' && own(maps.wish, token) && maps.wish[token] ? 'wish' : 'unresolved';
    if (kind === 'unresolved') issue(`binderOrder[${index}]`, 'UNRESOLVED_BINDER_REFERENCE', token);
    return { index, token, kind, copyId: byCatalog.get(token) ?? null };
  });
  const missingCoverage = backupCoverage(backup, requiredPaths);
  const amounts = {};
  for (const copy of copies) if (copy.cardCost.status === 'exact') {
    const { currency, minor } = copy.cardCost.value;
    amounts[currency] = (amounts[currency] ?? 0) + minor;
    if (!Number.isSafeInteger(amounts[currency])) issue('totals', 'UNSAFE_TOTAL', currency);
  }
  const result = { mappingVersion: 1, backupDigest: backup.sha256, source: backup.payload.source,
    status: exceptions.length || missingCoverage.length ? 'BLOCKED' : 'PASS', missingCoverage, exceptions,
    copies, memberships, binderReferences, preservedProgress: p, transactions: [], cashMovements: [],
    counts: { received: copies.filter(c => c.possession === 'received').length, pending: copies.filter(c => c.possession === 'pending').length, unknownCardCost: copies.filter(c => c.cardCost.status === 'unknown').length },
    knownCardAmountsMinor: amounts };
  return { ...result, previewDigest: digest(result) };
}
