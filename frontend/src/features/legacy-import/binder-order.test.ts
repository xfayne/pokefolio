import {expect,it} from 'vitest';
import {normalizeImportedBinderOrder} from './binder-order';
import {capacity,pageCount} from '@/features/binder/model';
import type {BinderPocket} from '@/domain/inventory';
const copy=(i:number):BinderPocket=>({kind:'copy',copyId:`copy-${i}`});
it('swaps only physical left/right positions across all 40 pages',()=>{
  const original=Array.from({length:360},(_,i)=>copy(i));
  const before=structuredClone(original);
  const fixed=normalizeImportedBinderOrder(original);
  expect(pageCount(fixed)).toBe(40);
  for(let i=0;i<360;i++)expect(fixed[i]).toEqual(original[i-i%3+2-i%3]);
  expect(original).toEqual(before);
});
it('keeps explicit holes, wish references and partial final rows at physical positions',()=>{
  const hole:BinderPocket={kind:'empty',token:'import-row-gap:3'};
  const wish:BinderPocket={kind:'wish',cardId:'base1-1'};
  expect(normalizeImportedBinderOrder([copy(0),hole,wish,copy(3)])).toEqual([
    wish,hole,copy(0),{kind:'empty',token:'import-row-gap:3:gap'},
    {kind:'empty',token:'import-row-gap:4'},copy(3),
  ]);
  expect(normalizeImportedBinderOrder([])).toEqual([]);
  expect(()=>normalizeImportedBinderOrder(Array.from({length:capacity},(_,i)=>copy(i)))).toThrow('CAPACITY');
});
