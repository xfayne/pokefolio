import {describe,expect,it} from 'vitest';
import {readerSpread} from './reader-spread';

function sequence(total:number,landscape=true) {
  const result:number[][]=[];
  let page:number|null=0;
  while(page!==null) {
    const spread:ReturnType<typeof readerSpread>=readerSpread(page,total,landscape);
    result.push(Array.from({length:spread.count},(_,i)=>spread.first+i+1));
    if(spread.previous!==null) expect(readerSpread(spread.previous,total,landscape).next).toBe(spread.first);
    page=spread.next;
  }
  return result;
}
describe('binder reader covers',()=>{
  it('shows both covers individually and every interior page once',()=>{
    expect(sequence(1)).toEqual([[1]]);
    expect(sequence(2)).toEqual([[1],[2]]);
    expect(sequence(3)).toEqual([[1],[2],[3]]);
    expect(sequence(4)).toEqual([[1],[2,3],[4]]);
    expect(sequence(5)).toEqual([[1],[2,3],[4],[5]]);
    const forty=sequence(40);
    expect(forty[0]).toEqual([1]);
    expect(forty.slice(1,-1)).toEqual(Array.from({length:19},(_,i)=>[2+i*2,3+i*2]));
    expect(forty.at(-1)).toEqual([40]);
  });
  it('keeps single-page navigation and selected page on orientation changes',()=>{
    expect(sequence(5,false)).toEqual([[1],[2],[3],[4],[5]]);
    expect(readerSpread(2,40,true)).toEqual({first:1,count:2,previous:0,next:3});
    expect(readerSpread(2,40,false)).toEqual({first:2,count:1,previous:1,next:3});
    expect(readerSpread(39,40,true)).toEqual({first:39,count:1,previous:37,next:null});
  });
});
