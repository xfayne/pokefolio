import { vi, it, expect, beforeEach } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { purchaseCommit } from '@/domain/purchase-commit';
import { createPurchaseDraft } from '@/features/transactions/purchase-draft-seed';
const state = vi.hoisted(() => ({ store: new Map<string, unknown>() }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  serverTimestamp: () => 'SERVER_TIME',
  collection: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: async (_db: unknown, run: (tx: unknown) => Promise<void>) => {
    const staged = new Map<string, unknown>();
    let wrote = false;
    await run({
      get: async (ref: { path: string }) => {
        if (wrote) throw Error('read after write');
        return {
          ref,
          exists: () => state.store.has(ref.path),
          data: () => state.store.get(ref.path),
        };
      },
      set: (ref: { path: string }, data: unknown) => {
        wrote = true;
        staged.set(ref.path, data);
      },
    });
    staged.forEach((v, k) => state.store.set(k, v));
  },
}));
import { commitPortfolio } from './portfolio';
const db = {} as Firestore;
beforeEach(() => state.store.clear());
it('commits all records and a receipt atomically and replays identical retries', async () => {
  const command = purchaseCommit(
    'owner',
    createPurchaseDraft(true),
    '2026-11-21T00:00:00Z',
  );
  await commitPortfolio(db, 'owner', command);
  const original = new Map(state.store);
  await commitPortfolio(db, 'owner', command);
  expect(state.store).toEqual(original);
  await expect(
    commitPortfolio(db, 'owner', {
      ...command,
      creates: command.creates.map((e) =>
        e.collection === 'transactions'
          ? { ...e, record: { ...e.record, notes: 'changed' } }
          : e,
      ),
    }),
  ).rejects.toThrow('Conflicting');
  expect(state.store).toEqual(original);
});
it('rejects stale edits atomically, even when earlier records could have been written', async () => {
  const draft = createPurchaseDraft(true);
  const command = purchaseCommit('owner', draft, '2026-11-21T00:00:00Z');
  await commitPortfolio(db, 'owner', command);
  const edit = purchaseCommit(
    'owner',
    { ...draft, shipping: '1.00' },
    '2026-11-21T01:00:00Z',
    command.creates,
  );
  await commitPortfolio(db, 'owner', edit);
  const original = new Map(state.store);
  await expect(
    commitPortfolio(db, 'owner', {
      ...edit,
      idempotencyKey: 'another-attempt',
    }),
  ).rejects.toThrow('Record changed');
  expect(state.store).toEqual(original);
  await expect(commitPortfolio(db, 'foreign', command)).rejects.toThrow();
});

import { copy } from '@/domain/fixtures.test-support';
import { newSaleDraft, saleCommit, reverseSaleCommit, editSaleCommit, draftFromSale } from '@/domain/sale';
import type { PortfolioRecord } from '@/domain/persistence';
it('atomically sells a received copy once, rejects competing sales, and replays a reversal without duplicating inventory', async () => {
  state.store.set(`users/owner/copies/${copy.id}`, {record:copy,auditId:null,committedAt:'SERVER_TIME'});
  const draft={...newSaleDraft(),id:'sale-a',date:'2026-11-21',buyer:'Buyer',currency:'GBP' as const,cards:[{copyId:copy.id,amount:'30'}]};
  const first=saleCommit('owner',draft,[copy],'2026-11-22T00:00:00Z');
  const competing=saleCommit('owner',{...draft,id:'sale-b'},[copy],'2026-11-22T00:00:00Z');
  await commitPortfolio(db,'owner',first);
  const sold=new Map(state.store);
  await commitPortfolio(db,'owner',first);
  expect(state.store).toEqual(sold);
  await expect(commitPortfolio(db,'owner',competing)).rejects.toThrow('Record changed');
  expect(state.store).toEqual(sold);
  const records=[...first.creates,...first.updates.map(u=>u.after)];
  const edit=editSaleCommit('owner',{...draftFromSale(records,'sale-a'),sellingFees:'1'},records,'2026-11-23T00:00:00Z');
  await commitPortfolio(db,'owner',edit);
  await expect(commitPortfolio(db,'owner',reverseSaleCommit('owner','sale-a',records,'2026-11-24T00:00:00Z'))).rejects.toThrow('Record changed');
  const updated=new Map(records.map(e=>[`${e.collection}/${e.record.id}`,e]));
  for(const u of edit.updates) updated.set(`${u.after.collection}/${u.after.record.id}`,u.after);
  const reversal=reverseSaleCommit('owner','sale-a',[...updated.values()] as PortfolioRecord[],'2026-11-24T00:00:00Z');
  await commitPortfolio(db,'owner',reversal);
  const restored=new Map(state.store);
  await commitPortfolio(db,'owner',reversal);
  expect(state.store).toEqual(restored);
  expect(state.store.get(`users/owner/copies/${copy.id}`)).toMatchObject({record:{id:copy.id,disposition:'held',dispositionRecordId:null}});
  expect([...state.store.keys()].filter(k=>k.startsWith('users/owner/copies/'))).toHaveLength(1);
});
