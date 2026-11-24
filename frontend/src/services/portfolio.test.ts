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

import { receivePurchase } from '@/domain/receipt';
it('persists manual receipt with immutable audits, stable copy IDs, retry receipts and stale-write rejection', async()=>{
  const draft=createPurchaseDraft(true);
  const created=purchaseCommit('owner',draft,'2026-11-21T01:00:00Z');
  await commitPortfolio(db,'owner',created);
  const command=receivePurchase('owner',draft.id,created.creates,'2026-11-21T02:00:00Z')[0]!;
  await commitPortfolio(db,'owner',command);
  const received=new Map(state.store);
  await commitPortfolio(db,'owner',command);
  expect(state.store).toEqual(received);
  await expect(commitPortfolio(db,'owner',{...command,idempotencyKey:'competing-receipt'})).rejects.toThrow('Record changed');
  expect([...state.store.keys()].filter(p=>p.includes('/copies/'))).toHaveLength(3);
  for(const copy of created.creates.filter(e=>e.collection==='copies')) expect(state.store.get(`users/owner/copies/${copy.record.id}`)).toMatchObject({record:{...copy.record,possession:'received',revision:2,updatedAt:'2026-11-21T02:00:00Z'}});
  const noCopies=created.creates.filter(e=>e.collection!=='copies');
  for(const e of noCopies) if(e.collection==='transactions') expect(state.store.get(`users/owner/transactions/${e.record.id}`)).toMatchObject({record:e.record});
});

it('adds an exact copy to a pending purchase, reallocates shipping and retains identities on retry',async()=>{
 const draft={...createPurchaseDraft(true),trackingNumber:'TEST123456',shipping:'12.00'};
 const initial=purchaseCommit('owner',draft,'2026-11-21T00:00:00Z');
 await commitPortfolio(db,'owner',initial);
 const next={...draft,cards:[...draft.cards,{...draft.cards[0]!,id:'added-copy',amount:'10.00'}]};
 const edit=purchaseCommit('owner',next,'2026-11-21T01:00:00Z',initial.creates);
 await commitPortfolio(db,'owner',edit);
 const saved=new Map(state.store);
 await commitPortfolio(db,'owner',edit);
 expect(state.store).toEqual(saved);
 expect([...state.store.keys()].filter(p=>p.includes('/copies/'))).toHaveLength(4);
 for(const c of next.cards) expect(state.store.get(`users/owner/copies/${c.id}`)).toMatchObject({record:{possession:'pending',shippingCost:{value:{minor:300}}}});
 expect(state.store.get(`users/owner/shipments/${draft.id}-shipment/memberships/added-copy-membership`)).toMatchObject({record:{copyId:'added-copy',transactionId:draft.id}});
 expect(state.store.get(`users/owner/transactions/${draft.id}`)).toMatchObject({record:{payable:{minor:15200}}});
});

it('commits 21 distinct copy corrections atomically through one grouped immutable audit, with idempotent replay', async()=>{
  const template=createPurchaseDraft(true);
  const many={...template,id:'bulk-edit-purchase',cards:Array.from({length:21},(_,i)=>({
    ...template.cards[0]!,id:'bulk-copy-'+i,amount:'1.00',
  }))};
  const originals=purchaseCommit('owner',many,'2026-11-21T08:00:00Z');
  await commitPortfolio(db,'owner',originals);
  const copies=originals.creates.filter(e=>e.collection==='copies');
  const at='2026-11-24T08:00:00Z';
  const updates=copies.map(entry=>{
    if(entry.collection!=='copies')throw Error('Unexpected copy');
    return {before:entry,after:{collection:'copies' as const,record:{
      ...entry.record,notes:'Bulk verified',revision:entry.record.revision+1,updatedAt:at,
    }}};
  });
  const first=updates[0]!;
  const revisions=await import('@/domain/schema');
  const grouped=revisions.revisionSchema.parse({
    schemaVersion:1,id:'audit-bulk-21',ownerUid:'owner',actorUid:'owner',
    revision:1,createdAt:at,updatedAt:at,recordId:first.before.record.id,
    operation:'edit',reason:'Synthetic grouped correction',
    before:first.before.record,after:first.after.record,
    additional:Object.fromEntries(updates.slice(1).map(e=>[e.before.record.id,{
      before:e.before.record,after:e.after.record,
    }])),
  });
  const command={
    ownerUid:'owner',idempotencyKey:'grouped-bulk-21',
    creates:[{collection:'revisions' as const,record:grouped}],updates,
  };
  await commitPortfolio(db,'owner',command);
  const saved=new Map(state.store);
  await commitPortfolio(db,'owner',command);
  expect(state.store).toEqual(saved);
  for(const entry of copies) {
    const value=state.store.get('users/owner/copies/'+entry.record.id);
    expect(value).toMatchObject({auditId:'audit-bulk-21',record:{
      id:entry.record.id,notes:'Bulk verified',revision:2,
      acquiredOn:entry.record.acquiredOn,
    }});
  }
  await expect(commitPortfolio(db,'owner',{...command,idempotencyKey:'other-grouped-attempt'}))
    .rejects.toThrow('Record changed');
  expect(state.store).toEqual(saved);
});

const purchasePrefs = 'users/owner/preferences/purchases';
const wishlistPath = 'users/owner/wishlists/main';
const binderPath = 'users/owner/binders/main';
function seedOrganization(id: string, enabled?: boolean) {
  if (enabled !== undefined) state.store.set(purchasePrefs,{autoFulfillWishlist:enabled});
  state.store.set(wishlistPath,{schemaVersion:1,ownerUid:'owner',revision:7,ids:'neo2-13;'+id+';basep-9'});
  const pockets=[{kind:'empty',token:'first-gap'},{kind:'wish',cardId:id},{kind:'copy',copyId:'existing-copy'},{kind:'wish',cardId:'neo2-13'}];
  state.store.set(binderPath,{schemaVersion:1,ownerUid:'owner',revision:9,pockets:JSON.stringify(pockets),includeWish:false});
  return pockets;
}
it('fulfills wishes and replaces only reserved pockets atomically using the first new pending copy',async()=>{
  const draft=createPurchaseDraft(true);
  const first=draft.cards[0]!;
  if(first.catalog.kind!=='identified') throw Error('Expected catalog fixture');
  const id=first.catalog.cardId;
  const pockets=seedOrganization(id,true);
  const command=purchaseCommit('owner',{...draft,cards:[first,{...first,id:'duplicate-copy'}]},'2026-11-24T00:00:00Z');
  await commitPortfolio(db,'owner',command);
  expect(state.store.get(wishlistPath)).toMatchObject({revision:8,ids:'neo2-13;basep-9'});
  expect(state.store.get(binderPath)).toMatchObject({revision:10,includeWish:false,pockets:JSON.stringify([pockets[0],{kind:'copy',copyId:first.id},pockets[2],pockets[3]])});
  expect(state.store.get('users/owner/copies/'+first.id)).toMatchObject({record:{possession:'pending'}});
  const saved=new Map(state.store);
  await commitPortfolio(db,'owner',command);
  expect(state.store).toEqual(saved);
});
it.each([false,undefined])('does not change layouts when preference is %s',async enabled=>{
  const draft=createPurchaseDraft(true);
  const first=draft.cards[0]!;
  if(first.catalog.kind!=='identified') throw Error('Expected catalog fixture');
  seedOrganization(first.catalog.cardId,enabled);
  const wishlist=state.store.get(wishlistPath),binder=state.store.get(binderPath);
  await commitPortfolio(db,'owner',purchaseCommit('owner',draft,'2026-11-24T00:00:00Z'));
  expect(state.store.get(wishlistPath)).toEqual(wishlist);
  expect(state.store.get(binderPath)).toEqual(binder);
});
it('never fulfills wishes on edits or retries, and rejects invalid layout atomically',async()=>{
  const draft=createPurchaseDraft(true);
  const first=draft.cards[0]!;
  if(first.catalog.kind!=='identified') throw Error('Expected catalog fixture');
  seedOrganization(first.catalog.cardId,false);
  const command=purchaseCommit('owner',draft,'2026-11-24T00:00:00Z');
  await commitPortfolio(db,'owner',command);
  state.store.set(purchasePrefs,{autoFulfillWishlist:true});
  const wishlist=state.store.get(wishlistPath),binder=state.store.get(binderPath);
  await commitPortfolio(db,'owner',command);
  await commitPortfolio(db,'owner',purchaseCommit('owner',{...draft,shipping:'1.00'},'2026-11-24T01:00:00Z',command.creates));
  expect(state.store.get(wishlistPath)).toEqual(wishlist);
  expect(state.store.get(binderPath)).toEqual(binder);
  state.store.set(binderPath,{invalid:true});
  const before=new Map(state.store);
  await expect(commitPortfolio(db,'owner',purchaseCommit('owner',createPurchaseDraft(true),'2026-11-24T02:00:00Z'))).rejects.toThrow();
  expect(state.store).toEqual(before);
});
