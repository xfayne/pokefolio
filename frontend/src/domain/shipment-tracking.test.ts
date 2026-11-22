import { expect, it } from 'vitest';
import { shipmentSnapshots, trackingState, unreadTracking } from './shipment-tracking';
import { purchaseCommit } from './purchase-commit';
import { createPurchaseDraft } from '@/features/transactions/purchase-draft-seed';
import type { TrackingState } from './schema';
const at='2026-11-21T15:00:00Z';
const event={id:'event-1',time:at,description:'Arrived',location:'Israel',stage:'InTransit'};
it('initial history is read, new events are unread, and provider delivery never receives copies',()=>{
  const initial=trackingState(undefined,{registered:true,carrier:1,status:'InTransit',events:[event]});
  expect(initial.seenEventIds).toEqual(['event-1']);
  const tracking=trackingState(initial,{...initial,status:'Delivered',events:[{...event,id:'event-2'},event]});
  const records=purchaseCommit('owner',{...createPurchaseDraft(true),trackingNumber:'TEST123456'},at).creates;
  const current=records.map(e=>e.collection==='shipments'?{...e,record:{...e.record,tracking}}:e);
  const s=current.find(e=>e.collection==='shipments')!;
  expect(s.collection==='shipments'&&unreadTracking(s.record)).toBe(1);
  expect(shipmentSnapshots(current)[0]).toMatchObject({status:'inTransit',providerStatus:'Delivered',unreadCount:1});
  expect(current.filter(e=>e.collection==='copies').every(e=>e.collection==='copies'&&e.record.possession==='pending')).toBe(true);
  const received=current.map(e=>e.collection==='copies'?{...e,record:{...e.record,possession:'received' as const}}:e);
  expect(shipmentSnapshots(received)[0]?.status).toBe('received');
});
it('retains delivery, notes and unread metadata on cost edits but resets tracking for a new number',()=>{
  const draft={...createPurchaseDraft(true),trackingNumber:'TEST123456'};
  const tracking:TrackingState={registered:true,carrier:1,status:'InTransit',events:[event],initialized:true,seenEventIds:[]};
  const records=purchaseCommit('owner',draft,at).creates.map(e=>e.collection==='shipments'?{...e,record:{...e.record,tracking,notes:'keep me'}}:e);
  const edit=purchaseCommit('owner',{...draft,shipping:'1'},at,records);
  expect(edit.updates.find(u=>u.after.collection==='shipments')?.after.record).toMatchObject({tracking,notes:'keep me'});
  const changed=purchaseCommit('owner',{...draft,trackingNumber:'TEST987654'},at,records);
  expect(changed.updates.find(u=>u.after.collection==='shipments')?.after.record).not.toHaveProperty('tracking');
});
