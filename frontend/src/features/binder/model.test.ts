import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { binderSchema, emptyBinder, placePocket, reservePocket, removePocket, movePage, projectBinder, encodePublic, decodePublic, pocketKey } from './model';
import type { BinderPocket } from '@/domain/inventory';
import {createSampleCopies,sampleOwner} from '@/features/inventory/sample';
import {decodeBinder} from './storage';
const c=(copyId:string):BinderPocket=>({kind:'copy',copyId});
const hole=(token:string):BinderPocket=>({kind:'empty',token});
const normalize=(list:BinderPocket[])=>list.map(p=>p.kind==='empty'?'_':pocketKey(p));
describe('legacy page and pocket invariants',()=>{
  it('compares React moves with the retained legacy controller for all 2-page source/target pairs',()=>{
    const source=[c('a'),hole('one'),c('b'),c('c'),c('d'),hole('two'),c('e'),c('f'),c('g'),c('h'),c('i')];
    for(let from=0;from<source.length;from++) for(let to=0;to<source.length;to++) {
      if(source[from]!.kind==='empty')continue;
      const state={cards:source.filter(p=>p.kind==='copy').map(p=>({id:pocketKey(p)})),owned:Object.fromEntries(source.filter(p=>p.kind==='copy').map(p=>[pocketKey(p),true])),ownedAddedAt:{},wish:{},removedWish:{},pendingPurchase:{},binderExcluded:{},binderOrder:source.map(p=>p.kind==='empty'?`__binder_empty__:${p.token}`:pocketKey(p)),wishOrder:[]};
      const window:Record<string,unknown>={};
      runInNewContext(readFileSync('../js/collection-ordering.js','utf8'),{window,crypto});
      const api=(window.VintageCollectionOrdering as {create:(options:unknown)=>{reorder:(kind:string,from:number,to:number)=>void}}).create({state,ensureCloudEdit:()=>true,save:()=>{}});
      api.reorder('binder',from,to);
      expect(normalize(placePocket(source,source[from]!,to))).toEqual(state.binderOrder.map(p=>p.startsWith('__binder_empty__:')?'_':p));
    }
  });
  it('swaps a reserved gap and inserts into an occupied pocket without changing copy identity',()=>{
    const original=[c('a'),hole('gap'),c('b')];
    expect(placePocket(original,c('b'),1)).toEqual([c('a'),c('b'),hole('gap')]);
    expect(placePocket(original,c('new'),1)).toEqual([c('a'),c('new'),c('b')]);
    expect(placePocket(original,c('new'),0)).toEqual([c('new'),...original]);
    expect(original).toEqual([c('a'),hole('gap'),c('b')]);
  });
  it('preserves exact implicit gaps and partial pages moved into the middle',()=>{
    const inserted=placePocket([c('a')],c('b'),8);
    expect(inserted).toHaveLength(9);expect(inserted[8]).toEqual(c('b'));
    const result=movePage([...inserted,c('last')],1,0);
    expect(result).toHaveLength(18);expect(result[0]).toEqual(c('last'));expect(result[9]).toEqual(c('a'));expect(result[17]).toEqual(c('b'));
    expect(result.slice(1,9).every(p=>p.kind==='empty')).toBe(true);
    expect(new Set(result.map(pocketKey)).size).toBe(result.length);
  });
  it('reserves and explicitly clears holes, validates bounds and rejects duplicates',()=>{
    const original=[c('a'),c('b')],reserved=reservePocket(original,1);
    expect(removePocket(reserved,1)).toEqual(original);
    expect(reservePocket(reserved,1)).toEqual(reserved);
    expect(()=>placePocket(original,c('c'),9)).toThrow();
    expect(()=>movePage(original,0,1)).toThrow();
    expect(()=>binderSchema.parse({...emptyBinder('alice'),pockets:[c('a'),c('a')]})).toThrow();
    expect(()=>decodeBinder({schemaVersion:1,ownerUid:'bob',revision:1,pockets:'[]',includeWish:true},'alice')).toThrow();
  });
  it('never replaces sold, missing or pending copy pointers and strips all private fields from sharing',()=>{
    const copies=createSampleCopies();
    const binder={...emptyBinder(sampleOwner),pockets:[c('charizard-a'),c('charizard-b'),c('gengar-pending'),c('missing'),hole('gap'),{kind:'wish' as const,cardId:'neo2-13'}]};
    copies[0]={...copies[0]!,disposition:'sold'};
    const projected=projectBinder(binder,copies);
    expect(projected).toEqual([null,{cardId:'base1-4',kind:'owned'},{cardId:'base3-5',kind:'pending'},null,null,{cardId:'neo2-13',kind:'wish'}]);
    expect(decodePublic(encodePublic(projected))).toEqual(projected);
    expect(projectBinder({...binder,includeWish:false},copies)[5]).toBeNull();
    expect(binder.pockets[0]).toEqual(c('charizard-a'));
    expect(projectBinder({...emptyBinder(sampleOwner),pockets:[c('charizard-b')]},copies.map(copy=>({...copy,possession:'unknown' as const})))).toEqual([null]);
    expect(()=>decodePublic('o:private-secret')).toThrow();
    expect(()=>decodePublic('o:base1-4;copy:secret')).toThrow();
  });
});
