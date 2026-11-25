import {describe,expect,it,vi} from 'vitest';
import {newScan,runScan,parseBatch,type DealCard,type Batch} from './scan';
const cards:DealCard[]=Array.from({length:9},(_,i)=>({id:'base1-'+(i+1),name:'Card',setName:'Base Set',number:String(i+1),firstEdition:false,finish:'normal'}));
const empty:Batch={items:[],errors:[],fetchedAt:'2026-11-25T00:00:00Z'};
describe('explicit batch scan',()=>{
  it('does no work on initialization and requests only the supplied scope, in order',async()=>{
    const request=vi.fn(async()=>empty);
    const scope=cards.filter((_,i)=>i!==3);
    const state=newScan(scope);
    expect(request).not.toHaveBeenCalled();
    const progress=vi.fn();
    const done=await runScan(state,request,new AbortController().signal,progress,0);
    expect(request.mock.calls).toHaveLength(2);
    expect(done.searched).toBe(8);
    expect(progress).toHaveBeenCalledTimes(2);
  });
  it('stops at rate limits without skipping the batch',async()=>{
    const request=vi.fn(async()=>({...empty,errors:[{cardId:'base1-1',error:'HTTP 429'}]}));
    const done=await runScan(newScan(cards),request,new AbortController().signal,()=>{},0);
    expect(done.throttled).toBe(true);
    expect(done.searched).toBe(0);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('does not publish a response after cancellation',async()=>{
    const abort=new AbortController();
    const progress=vi.fn();
    await expect(runScan(newScan(cards),async()=>{abort.abort();return empty;},abort.signal,progress,0)).rejects.toThrow();
    expect(progress).not.toHaveBeenCalled();
  });
});

 it('distinguishes rejected listing data from marketplace failures without retaining raw values',()=>{
  const result=parseBatch({items:[{url:'https://untrusted.example/itm/123'}],errors:[{cardId:cards[0]!.id,error:'HTTP 503'}],fetchedAt:empty.fetchedAt},cards);
  expect(result.items).toEqual([]);
  expect(result.errors[0]).toEqual({cardId:cards[0]!.id,error:'HTTP 503'});
  expect(result.errors[1]).toMatchObject({error:'Invalid listing response',invalidFields:expect.arrayContaining(['url','itemId'])});
  expect(JSON.stringify(result.errors)).not.toContain('untrusted.example');
 });
