import type { PreparedPurchaseDraft, PurchaseDraft } from './purchase-draft';
import { preparePurchaseDraft } from './purchase-draft';
import type { PortfolioCommit, PortfolioRecord } from './persistence';
import { revisionSchema } from './schema';
export function purchaseRecords(
  value: PreparedPurchaseDraft,
): PortfolioRecord[] {
  return [
    { collection: 'transactions', record: value.plan.purchase },
    ...value.plan.lines.map((record) => ({
      collection: 'lines' as const,
      record,
    })),
    ...value.plan.copies.map((record) => ({
      collection: 'copies' as const,
      record,
    })),
    ...(value.lot ? [{ collection: 'lots' as const, record: value.lot }] : []),
    ...(value.shipment
      ? [{ collection: 'shipments' as const, record: value.shipment }]
      : []),
    ...value.memberships.map((record) => ({
      collection: 'memberships' as const,
      record,
    })),
  ];
}
export function purchaseCommit(
  owner: string,
  draft: PurchaseDraft,
  at: string,
  existing: readonly PortfolioRecord[] = [],
): PortfolioCommit {
  const records = purchaseRecords(preparePurchaseDraft(owner, draft, at));
  const previous = existing.find(
    (e) => e.collection === 'transactions' && e.record.id === draft.id,
  );
  if (!previous)
    return {
      ownerUid: owner,
      idempotencyKey: draft.id,
      creates: records,
      updates: [],
    };
  if (
    previous.collection !== 'transactions' ||
    previous.record.kind !== 'purchase' ||
    'origin' in previous.record ||
    previous.record.settlement !== 'unknown'
  )
    throw Error('This purchase requires a separate correction workflow');
  const oldCopies = existing.filter(
    (e) =>
      e.collection === 'copies' &&
      e.record.acquisition.kind === 'purchase' &&
      e.record.acquisition.transactionId === draft.id,
  );
  if (
    oldCopies.length !== draft.cards.length ||
    oldCopies.some(
      (e) =>
        !draft.cards.some((c) => c.id === e.record.id) ||
        e.collection !== 'copies' ||
        e.record.disposition !== 'held',
    )
  )
    throw Error('Cannot add/remove copies or edit disposed purchases');
  if (previous.record.pricingMode !== draft.pricingMode)
    throw Error('Cannot change pricing mode on an existing purchase');
  const oldShipment = existing.find(e => e.collection === 'shipments' && e.record.id === `${draft.id}-shipment`);
  if (oldShipment?.collection === 'shipments' && !records.some(e => e.collection === 'shipments')) records.push({collection:'shipments',record:{...oldShipment.record,trackingNumber:null,carrier:null,revision:1,updatedAt:at}});
  const command: PortfolioCommit = {
    ownerUid: owner,
    idempotencyKey: `edit-${crypto.randomUUID()}`,
    creates: [],
    updates: [],
  };
  for (const entry of records) {
    const before = existing.find(
      (e) =>
        e.collection === entry.collection && e.record.id === entry.record.id,
    );
    if (!before) {
      if (entry.collection === 'shipments' || entry.collection === 'memberships') { command.creates.push(entry); continue; }
      throw Error('Purchase references changed');
    }
    const after = {
      ...entry,
      record: {
        ...entry.record,
        createdAt: before.record.createdAt,
        revision: before.record.revision + 1,
      },
    } as PortfolioRecord;
    if (before.collection === 'copies' && after.collection === 'copies') {
      after.record = {
        ...after.record,
        possession: before.record.possession,
        notes: before.record.notes,
      };
    }
    if (before.collection === 'shipments' && after.collection === 'shipments') {
      const unchanged = before.record.trackingNumber === after.record.trackingNumber && before.record.carrier === after.record.carrier;
      after.record = { ...after.record, deliveredOn: before.record.deliveredOn, notes: before.record.notes,
        ...(unchanged && before.record.tracking ? { tracking: before.record.tracking } : {}) };
      if (!unchanged) delete after.record.tracking;
    }
    const audit = revisionSchema.parse({
      schemaVersion: 1,
      id: `audit-${crypto.randomUUID()}`,
      ownerUid: owner,
      actorUid: owner,
      revision: 1,
      createdAt: at,
      updatedAt: at,
      recordId: before.record.id,
      operation: 'edit',
      reason: 'Purchase edited',
      before: before.record,
      after: after.record,
    });
    command.updates.push({ before, after });
    command.creates.push({ collection: 'revisions', record: audit });
  }
  return command;
}
export function draftFromPurchase(
  records: readonly PortfolioRecord[],
  id: string,
): PurchaseDraft {
  const entry = records.find(
    (e) => e.collection === 'transactions' && e.record.id === id,
  );
  if (
    !entry ||
    entry.collection !== 'transactions' ||
    entry.record.kind !== 'purchase' ||
    'origin' in entry.record
  )
    throw Error('Purchase unavailable');
  const p = entry.record;
  const shipment = records.find(
    (e) => e.collection === 'shipments' && e.record.id === `${id}-shipment`,
  );
  return {
    id,
    date: p.transactionOn,
    source: p.source.kind,
    seller: p.source.seller ?? '',
    currency: p.currency,
    pricingMode: p.pricingMode,
    shipping:
      p.shipping.status === 'known'
        ? (p.shipping.value.minor / 100).toFixed(2)
        : '',
    lotTotal:
      p.subtotal.status === 'known'
        ? (p.subtotal.value.minor / 100).toFixed(2)
        : '',
    listingUrl: p.source.listingUrl ?? '',
    itemReference: p.source.itemReference ?? '',
    trackingNumber:
      shipment?.collection === 'shipments'
        ? (shipment.record.trackingNumber ?? '')
        : '',
    carrier:
      shipment?.collection === 'shipments'
        ? (shipment.record.carrier ?? '')
        : '',
    cards: records
      .filter((e) => e.collection === 'lines' && e.record.transactionId === id)
      .sort((a, b) =>
        a.collection === 'lines' &&
        b.collection === 'lines' &&
        'ordinal' in a.record &&
        'ordinal' in b.record
          ? a.record.ordinal - b.record.ordinal
          : 0,
      )
      .flatMap((line) =>
        records.flatMap((e) =>
          e.collection === 'copies' &&
          e.record.acquisition.kind === 'purchase' &&
          e.record.acquisition.lineId === line.record.id
            ? [
                {
                  id: e.record.id,
                  catalog: e.record.catalog,
                  condition:
                    e.record.condition.status === 'known'
                      ? e.record.condition.value
                      : ('unknown' as const),
                  amount:
                    e.record.cardCost.status === 'exact'
                      ? (e.record.cardCost.value.minor / 100).toFixed(2)
                      : '',
                },
              ]
            : [],
        ),
      ),
  };
}
