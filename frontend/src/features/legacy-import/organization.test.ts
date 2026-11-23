import { expect, it } from 'vitest';
import { materializeLegacyImport } from '@/domain/legacy-import';
import { materializeLegacyOrganization } from './organization';

const unknown={status:'unknown',reason:'Not evidenced'} as const;
const report=() => ({
  mappingVersion:3,status:'PASS',source:{ownerUid:'owner'},
  copies:[
    {id:'rec',cardId:'base1-1',possession:'received',condition:unknown,edition:'unlimited',acquiredOn:unknown,cardCost:unknown},
    {id:'pend',cardId:'base1-3',possession:'pending',condition:unknown,edition:'unknown',acquiredOn:unknown,cardCost:unknown},
  ],
  transactions:[{id:'purchase',sourceParcelIndex:0}],
  memberships:[{parcelIndex:0,ordinal:0,cardId:'base1-3',copyId:'pend'}],
  preservedProgress:{
    notes:{},shipments:[{id:'parcel',cardIds:['base1-3']}],
    wish:{'base1-2':true},wishOrder:['base1-2'],
    binderOrder:['base1-1','__binder_empty__:original','base1-3','base1-2'],
    binderIncludeWish:true,
  },
  binderReferences:[
    {index:0,token:'base1-1',kind:'copy',copyId:'rec'},
    {index:1,token:'__binder_empty__:original',kind:'empty',copyId:null},
    {index:2,token:'base1-3',kind:'copy',copyId:'pend'},
    {index:3,token:'base1-2',kind:'wish',copyId:null},
  ],
});
it('preserves Wishlist order and every Binder pocket including pending and reserved gaps',()=>{
  const input=report(),before=structuredClone(input);
  const payload=materializeLegacyImport(input,'owner','2026-11-23T00:00:00Z');
  const {binder,wishlist}=materializeLegacyOrganization(input,payload.copies,'owner');
  expect(wishlist.cardIds).toEqual(['base1-2']);
  expect(binder.pockets).toEqual([
    {kind:'copy',copyId:'rec'},
    {kind:'empty',token:'__binder_empty__:original'},
    {kind:'copy',copyId:'pend'},
    {kind:'wish',cardId:'base1-2'},
  ]);
  expect(payload.copies.find(c=>c.id==='pend')?.possession).toBe('pending');
  expect(input).toEqual(before);
});
it('rejects a stale Binder reference or incomplete Wishlist rather than silently adjusting order',()=>{
  const input=report(),payload=materializeLegacyImport(input,'owner','2026-11-23T00:00:00Z');
  expect(()=>materializeLegacyOrganization({...input,binderReferences:input.binderReferences.slice(1)},payload.copies,'owner')).toThrow('BINDER');
  expect(()=>materializeLegacyOrganization({...input,preservedProgress:{...input.preservedProgress,wishOrder:[]}},payload.copies,'owner')).toThrow('WISHLIST');
});
