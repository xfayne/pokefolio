import { validateReceiptCommit } from '@/domain/receipt';
import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import {
  prepareCommit,
  portfolioRecordSchema,
  type PortfolioCommit,
  type PortfolioRecord,
} from '@/domain/persistence';
import { validateSaleCommit } from '@/domain/sale';
import { validateImportedPurchaseEdit } from '@/domain/imported-purchase-edit';
import { planPurchase } from '@/domain/purchase';
import { idSchema } from '@/domain/schema';

export function portfolioPath(owner: string, entry: PortfolioRecord) {
  idSchema.parse(owner);
  const r = entry.record;
  if (entry.collection === 'lines')
    return `users/${owner}/transactions/${entry.record.transactionId}/lines/${r.id}`;
  if (entry.collection === 'memberships')
    return `users/${owner}/shipments/${entry.record.shipmentId}/memberships/${r.id}`;
  return `users/${owner}/${entry.collection}/${r.id}`;
}
const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(sort(a)) === JSON.stringify(sort(b));
function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sort(v)]),
    );
  return value;
}
export async function commitPortfolio(
  db: Firestore,
  owner: string,
  raw: PortfolioCommit,
) {
  const command = prepareCommit(owner, raw, 450);
  // Firestore rules permit at most 20 distinct audit getAfter lookups per
  // transaction. One grouped revision can safely audit many writes atomically.
  const auditFor = (update: PortfolioCommit['updates'][number]) => command.creates.find(entry => {
    if (entry.collection !== 'revisions') return false;
    const detail = entry.record.recordId === update.before.record.id
      ? {before:entry.record.before,after:entry.record.after}
      : entry.record.additional?.[update.before.record.id];
    return !!detail && same(detail.before,update.before.record) && same(detail.after,update.after.record);
  });
  const auditIds = new Set(command.updates.map(update=>auditFor(update)?.record.id));
  if (auditIds.has(undefined) || auditIds.size > 20)
    throw Error('This edit exceeds the atomic audit limit');
  const receiptCommand = validateReceiptCommit(command);
  const saleCommand = receiptCommand ? false : validateSaleCommit(owner, command);
  const importedEdit = validateImportedPurchaseEdit(command);
  // New financial records must describe complete purchases, not orphan copies.
  const writes = [...command.creates, ...command.updates.map(u => u.after)];
  const purchases = writes.filter(
    (e) => e.collection === 'transactions' && e.record.kind === 'purchase',
  );
  for (const entry of purchases) {
    if (
      entry.collection !== 'transactions' ||
      entry.record.kind !== 'purchase' ||
      'origin' in entry.record
    ) {
      if (importedEdit && entry.collection === 'transactions' && 'origin' in entry.record) continue;
      throw Error('Only ordinary purchases can be created here');
    }
    const purchase = entry.record;
    const lines = writes.flatMap((e) =>
      e.collection === 'lines' && e.record.transactionId === purchase.id
        ? [e.record]
        : [],
    );
    const copies = writes.flatMap((e) =>
      e.collection === 'copies' &&
      !e.record.removedFromImport && !e.record.removedFromPurchase &&
      e.record.acquisition.kind === 'purchase' &&
      e.record.acquisition.transactionId === purchase.id
        ? [e.record]
        : [],
    );
    const plan = planPurchase(
      owner,
      {...purchase, revision:1},
      lines.map(l => ({...l,revision:1})),
      copies.map((c) => {
        if (c.acquisition.kind !== 'purchase' || c.possession !== 'pending')
          throw Error('New purchases must be pending');
        return {
          id: c.id,
          lineId: c.acquisition.lineId,
          unitOrdinal: c.acquisition.unitOrdinal,
          condition: c.condition,
          possession: c.possession,
          notes: c.notes,
        };
      }),
      null,
    );
    // Existing physical copies retain their original acquisition date even if the transaction date is corrected.
    const expectedCopies = plan.copies.map(copy => {
      const original = command.updates.find(update => update.before.collection === 'copies' && update.before.record.id === copy.id);
      return original?.before.collection === 'copies' ? { ...copy, acquiredOn: original.before.record.acquiredOn } : copy;
    });
    if (!same(expectedCopies.sort((a,b)=>a.id.localeCompare(b.id)), copies.map(c => ({...c,revision:1,createdAt:purchase.createdAt,updatedAt:purchase.updatedAt})).sort((a,b)=>a.id.localeCompare(b.id))))
      throw Error('Purchase copy costs or references do not reconcile');
  }
  if (
    command.creates.some(
      (e) =>
        e.collection === 'copies' &&
        (e.record.acquisition.kind !== 'purchase' ||
          !purchases.some(
            (p) =>
              p.record.id ===
              (e.record.acquisition.kind === 'purchase'
                ? e.record.acquisition.transactionId
                : ''),
          )),
    )
  )
    throw Error('Orphan purchase copy');
  for (const update of command.updates) {
    if (
      update.before.collection === 'copies' &&
      update.after.collection === 'copies' &&
      (!same(
        update.before.record.acquisition,
        update.after.record.acquisition,
      ) ||
        (!saleCommand && update.before.record.disposition !== update.after.record.disposition))
    )
      throw Error('Copy acquisition and disposition cannot be edited here');
  }
  const fingerprint = JSON.stringify(sort(command));
  if (new TextEncoder().encode(fingerprint).length > 700_000)
    throw Error('Purchase is too large to save atomically');
  const receipt = doc(db, `users/${owner}/receipts/${command.idempotencyKey}`);
  return runTransaction(db, async (tx) => {
    const previous = await tx.get(receipt);
    if (previous.exists()) {
      if (previous.data().fingerprint !== fingerprint)
        throw Error('Conflicting save');
      return;
    }
    const entries = [
      ...command.creates,
      ...command.updates.map((u) => u.after),
    ];
    const snapshots = await Promise.all(
      entries.map((e) => tx.get(doc(db, portfolioPath(owner, e)))),
    );
    // All reads precede writes, including optimistic concurrency checks.
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!,
        snapshot = snapshots[i]!;
      const update = command.updates.find(
        (u) => portfolioPath(owner, u.after) === snapshot.ref.path,
      );
      if (
        update
          ? !snapshot.exists() ||
            !same(snapshot.data().record, update.before.record)
          : snapshot.exists()
      )
        throw Error('Record changed. Reload before saving.');
      const audit = update ? auditFor(update) : null;
      tx.set(snapshot.ref, {
        record: entry.record,
        auditId: audit?.record.id ?? null,
        committedAt: serverTimestamp(),
      });
    }
    tx.set(receipt, { fingerprint, committedAt: serverTimestamp() });
  });
}
export async function readPortfolio(
  db: Firestore,
  owner: string,
): Promise<PortfolioRecord[]> {
  idSchema.parse(owner);
  const roots = ['transactions', 'copies', 'lots', 'shipments'] as const;
  const records = (
    await Promise.all(
      roots.map(async (name) =>
        (await getDocs(collection(db, `users/${owner}/${name}`))).docs.map(
          (d) =>
            portfolioRecordSchema.parse({
              collection: name,
              record: d.data().record,
            }),
        ),
      ),
    )
  ).flat();
  const nested = await Promise.all(
    records.flatMap((e) =>
      e.collection === 'transactions' || e.collection === 'shipments'
        ? [
            (async () => {
              const name =
                e.collection === 'transactions' ? 'lines' : 'memberships';
              return (
                await getDocs(
                  collection(db, `${portfolioPath(owner, e)}/${name}`),
                )
              ).docs.map((d) =>
                portfolioRecordSchema.parse({
                  collection: name,
                  record: d.data().record,
                }),
              );
            })(),
          ]
        : [],
    ),
  );
  const all = [...records, ...nested.flat()];
  if (all.some((e) => e.record.ownerUid !== owner))
    throw Error('Foreign portfolio record');
  return all;
}
