import {describe,expect,it} from 'vitest';
import {readExclusions,saveExclusions,selectedIds} from './scope';
describe('Deals scope',()=>{
  it('defaults to all, retains order, selects new cards, isolates accounts',()=>{
    const values=new Map<string,string>();
    const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
    expect(selectedIds(['base1-1','base1-2'],readExclusions(storage,'a'))).toEqual(['base1-1','base1-2']);
    expect(saveExclusions(storage,'a',['base1-1'])).toBe(true);
    expect(selectedIds(['base1-2','base1-1','base1-3'],readExclusions(storage,'a'))).toEqual(['base1-2','base1-3']);
    expect(readExclusions(storage,'b')).toEqual([]);
  });
  it('recovers from corrupt or blocked storage',()=>{
    const storage={getItem:()=>'{',setItem:()=>{throw Error('blocked');}};
    expect(readExclusions(storage,'a')).toEqual([]);
    expect(saveExclusions(storage,'a',['base1-1'])).toBe(false);
  });
});
