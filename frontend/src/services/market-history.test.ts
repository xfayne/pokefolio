import {beforeEach,expect,it,vi} from 'vitest';
import {renderHook,waitFor} from '@testing-library/react';
import type {CatalogRef} from '@/domain/schema';
const mocks=vi.hoisted(()=>({post:vi.fn()}));
vi.mock('./api',()=>({createApiClient:()=>({post:mocks.post})}));
vi.mock('./environment',()=>({getEnvironment:()=>({workerUrl:'https://pokefolio-api-staging.xfayne.workers.dev'})}));
import {fetchMarketHistory,selectMarketVariant,useMarketHistory,type MarketResult} from './market-history';
import {publicPriceClient} from './public-price-client';
const catalog:CatalogRef={kind:'identified',cardId:'base3-5',edition:'unlimited',language:{status:'known',source:'user',value:'English'},finish:{status:'known',source:'user',value:'holo'}};
const variant={condition:'LP' as const,printing:'Unlimited Holofoil',language:'English',currency:'USD' as const,current:1234,observedAt:'2026-11-21T00:00:00Z',status:'current' as const,history:[{date:'2026-11-20',minor:1000}]};
const result:MarketResult={productId:'106521',cache:'fresh',error:null,retryAfter:null,data:{schemaVersion:1,provider:'justtcg',source:'JustTCG',productId:'106521',currency:'USD',period:'1y',fetchedAt:1,variants:[variant,{...variant,printing:'1st Edition Holofoil',current:3000}]}};
beforeEach(()=>{mocks.post.mockReset();publicPriceClient.clear();});
it('uses only the Worker endpoint and verifies product/window response membership',async()=>{
 mocks.post.mockResolvedValue({data:{schemaVersion:1,results:[result]}});
 expect(await fetchMarketHistory('owner',['106521','106521'],'1y')).toEqual([result]);
 expect(mocks.post).toHaveBeenCalledWith('/api/market/prices',{products:['106521'],period:'1y'},{});
 await expect(fetchMarketHistory('owner',['999'],'1y')).rejects.toThrow('Mismatched');
 mocks.post.mockResolvedValue({data:{schemaVersion:1,results:[result,result]}});
 await expect(fetchMarketHistory('owner',['106521'],'1y')).rejects.toThrow('Mismatched');
});
it('selects exact language, condition, edition and finish without price fallback',()=>{
 expect(selectMarketVariant(result,catalog,'LP')?.current).toBe(1234);
 expect(selectMarketVariant(result,{...catalog,edition:'first-edition'},'LP')?.current).toBe(3000);
 expect(selectMarketVariant(result,catalog,'NM')).toBeNull();
 expect(selectMarketVariant(result,{...catalog,edition:'unknown'},'LP')).toBeNull();
 expect(selectMarketVariant(result,{...catalog,language:{status:'unknown',reason:'missing'}},'LP')).toBeNull();
 expect(selectMarketVariant(result,{...catalog,finish:{status:'known',source:'user',value:'normal'}},'LP')).toBeNull();
 expect(selectMarketVariant({...result,data:{...result.data!,variants:[variant,variant]}},catalog,'LP')).toBeNull();
});
it('preserves stale/error/missing states instead of turning them into zero prices',async()=>{
 const missing={productId:'106521',cache:'unavailable',data:null,error:'PRICE_BUDGET_LIMIT',retryAfter:600};
 mocks.post.mockResolvedValue({data:{schemaVersion:1,results:[missing]}});
 expect((await fetchMarketHistory('owner',['106521'],'1y'))[0]?.data).toBeNull();
 expect(selectMarketVariant(missing as MarketResult,catalog,'LP')).toBeNull();
});
it('reuses fresh public responses across remounts/accounts without exposing results while signed out',async()=>{
 const fresh={...result,data:{...result.data!,fetchedAt:Date.now()}};
 mocks.post.mockResolvedValue({data:{schemaVersion:1,results:[fresh]}});
 const first=renderHook(()=>useMarketHistory('owner',['106521'],'1y'));
 await waitFor(()=>expect(first.result.current.results).toHaveLength(1));first.unmount();
 const second=renderHook(()=>useMarketHistory('other-owner',['106521'],'1y'));
 await waitFor(()=>expect(second.result.current.results).toHaveLength(1));
 expect(mocks.post).toHaveBeenCalledTimes(1);second.unmount();
 const signedOut=renderHook(()=>useMarketHistory(undefined,['106521'],'1y'));
 expect(signedOut.result.current.results).toEqual([]);expect(signedOut.result.current.loading).toBe(false);
});
