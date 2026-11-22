import { beforeEach,it,expect,vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import {emptyBinder} from './model';
const mock=vi.hoisted(()=>({stored:null as Record<string,unknown>|null,writes:[] as {path:string;data:Record<string,unknown>}[],pending:[] as {path:string;data:Record<string,unknown>}[]}));
vi.mock('firebase/firestore',()=>({
  doc:(_db:unknown,path:string)=>({path}),serverTimestamp:()=>'<server timestamp>',
  getDocFromServer:vi.fn(async()=>({exists:()=>!!mock.stored,data:()=>mock.stored})),
  runTransaction:vi.fn(async(_db:unknown,fn:(tx:unknown)=>Promise<unknown>)=>fn({get:async()=>({exists:()=>!!mock.stored,data:()=>mock.stored}),set:(ref:{path:string},data:Record<string,unknown>)=>mock.writes.push({path:ref.path,data})})),
  writeBatch:()=>({set:(ref:{path:string},data:Record<string,unknown>)=>mock.pending.push({path:ref.path,data}),commit:async()=>{mock.writes.push(...mock.pending);mock.pending=[];}}),
}));
import {readBinder,saveBinder,publishBinder,disableSharing} from './storage';
import {createSampleCopies,sampleOwner} from '@/features/inventory/sample';
const db=null as unknown as Firestore;
beforeEach(()=>{mock.stored=null;mock.writes=[];mock.pending=[];});
it('reads a missing owner layout without creating or normalizing data, and saves only its exact layout',async()=>{
  const before=await readBinder(db,'alice');expect(before).toEqual(emptyBinder('alice'));expect(mock.writes).toEqual([]);
  const next={...before,pockets:[{kind:'empty' as const,token:'reserved'}]};
  const saved=await saveBinder(db,'alice',before,next);
  expect(saved.revision).toBe(1);
  expect(mock.writes).toEqual([{path:'users/alice/binders/main',data:{...saved,pockets:JSON.stringify(saved.pockets),updatedAt:'<server timestamp>'}}]);
});
it('rejects stale layouts and owner changes before any writes',async()=>{
  const before=emptyBinder('alice');
  mock.stored={...before,revision:1,pockets:'[]'};
  await expect(saveBinder(db,'alice',before,before)).rejects.toThrow('Binder changed');
  await expect(saveBinder(db,'bob',before,before)).rejects.toThrow('Foreign binder');
  expect(mock.writes).toEqual([]);
});
it('publishes only catalog kinds atomically with matching opt-in and disables the same link without touching private records',async()=>{
  const id='00000000-0000-4000-8000-000000000001';
  const binder={...emptyBinder(sampleOwner),pockets:[{kind:'copy' as const,copyId:'charizard-b'},{kind:'empty' as const,token:'secret-token'}]};
  await publishBinder(db,binder,createSampleCopies(),id);
  expect(mock.writes).toEqual([
    {path:`sharedBinders/${id}`,data:{schemaVersion:2,ownerUid:sampleOwner,pockets:'o:base1-4;_',includeWish:true,updatedAt:'<server timestamp>'}},
    {path:`users/${sampleOwner}/sharing/settings`,data:{shareId:id,enabled:true,includeWish:true}},
  ]);
  mock.writes=[];
  await disableSharing(db,sampleOwner,id,true);
  expect(mock.writes).toEqual([{path:`users/${sampleOwner}/sharing/settings`,data:{shareId:id,enabled:false,includeWish:true}}]);
});
