import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchJustTcg,normalizeProduct,parsePriceRequest,priceKey,pricesApi,FRESH_MS} from './market-prices.js';
import {PriceService} from './price-service.js';
import worker from './index.js';
const now=Date.parse('2026-11-21T12:00:00Z');
const variant=(patch={})=>({condition:'Lightly Played',printing:'Unlimited Holofoil',language:'English',price:12.34,priceStatus:'current',lastUpdated:Math.floor(now/1000),priceHistory:[{p:10,t:Math.floor((now-86400_000)/1000)},{p:12.34,t:Math.floor(now/1000)}],...patch});
const product=(id='106521',variants=[variant()])=>({tcgplayerId:id,variants});
const entry=(id='106521',at=now)=>normalizeProduct(product(id),id,'1y',at);
class Store {
 data=new Map();
 async get(key,type){ const v=this.data.get(key); return type==='json'&&typeof v==='string'?JSON.parse(v):structuredClone(v); }
 async put(key,value){this.data.set(key,structuredClone(value));}
 async list({prefix,startAfter='',limit}){return new Map([...this.data].filter(([k])=>k.startsWith(prefix)&&k>startAfter).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit));}
 async delete(keys){for(const key of keys)this.data.delete(key);}
}
const setup=()=>{
 const storage=new Store(),cache=new Store(),calls=[];
 const service=new PriceService(storage,cache,'fake-secret',{now:()=>now,fetcher:async(url,options)=>{calls.push({url,options});return Response.json({data:JSON.parse(options.body).map(x=>product(x.tcgplayerId))});}});
 return {service,storage,cache,calls};
};
test('validates bounded input, canonicalizes duplicates and separates provider windows',()=>{
 assert.deepEqual(parsePriceRequest({products:['2','1','2'],period:'1y'}),{products:['1','2'],period:'1y'});
 for(const input of [{products:[],period:'1y'},{products:['https://host'],period:'1y'},{products:['1'],period:'all'},{products:Array(21).fill('1'),period:'7d'}])assert.throws(()=>parsePriceRequest(input));
 assert.notEqual(priceKey('1','7d'),priceKey('1','1y'));
});
test('preserves exact printing/condition/language identity and missing days; rejects conflicting histories',()=>{
 const value=normalizeProduct(product('1',[variant(),variant({condition:'Near Mint',printing:'1st Edition Holofoil',priceStatus:'expired'})]),'1','1y',now);
 assert.equal(value.variants[0].current,1234); assert.equal(value.variants[0].history.length,2);
 assert.equal(value.variants[1].current,null);
 assert.throws(()=>normalizeProduct(product('1',[variant(),variant()]),'1','1y',now),/AMBIGUOUS/);
 assert.throws(()=>normalizeProduct(product('1',[variant({priceHistory:[{p:1,t:now/1000},{p:2,t:now/1000}]})]),'1','1y',now),/AMBIGUOUS/);
 const invalid=normalizeProduct(product('1',[variant({priceHistory:[{p:-1,t:now/1000},{p:2,t:now/1000+86400}],price:-1})]),'1','1y',now);
 assert.equal(invalid.variants[0].history.length,0);assert.equal(invalid.variants[0].current,null);
});
test('POST batches put history duration on each lookup, use only the fixed host, and sanitize errors',async()=>{
 let payload;
 const result=await fetchJustTcg(['1','2'],'1y','secret',now,async(url,options)=>{assert.equal(url,'https://api.justtcg.com/v1/cards');payload=JSON.parse(options.body);return Response.json({data:[product('1'),product('2')]});});
 assert.deepEqual(payload,[{tcgplayerId:'1',priceHistoryDuration:'1y'},{tcgplayerId:'2',priceHistoryDuration:'1y'}]);assert.equal(result.length,2);
 await assert.rejects(fetchJustTcg(['1'],'1y','secret',now,async()=>new Response('secret upstream body',{status:401})),{message:'PROVIDER_AUTH_FAILED'});
});
test('overlapping requests coalesce, cache all variants, and survive coordinator restart and KV propagation gaps',async()=>{
 const {service,storage,cache,calls}=setup();
 const [a,b]=await Promise.all([service.load({products:['1','2'],period:'1y'}),service.load({products:['2','3'],period:'1y'})]);
 assert.equal(a.entries.length,2);assert.equal(b.entries.length,2);assert.equal(calls.length,2);
 assert.deepEqual(JSON.parse(calls[1].options.body).map(x=>x.tcgplayerId),['3']);
 cache.data.clear();
 const restarted=new PriceService(storage,cache,'fake',{now:()=>now,fetcher:()=>{throw Error('must not fetch');}});
 assert.equal((await restarted.load({products:['2'],period:'1y'})).entries.length,1);
});
test('reserves shared rolling monthly/daily/minute budgets before calls and survives restart',async()=>{
 for(const calls of [Array(900).fill(now-86400_000),Array(90).fill(now-3600_000),Array(9).fill(now-1000)]){
  const setupValue=setup();await setupValue.storage.put('budget',{calls,blockedUntil:0});
  const result=await setupValue.service.load({products:['1'],period:'1y'});
  assert.equal(result.error,'PRICE_BUDGET_LIMIT');assert.ok(result.retryAfter>0);assert.equal(setupValue.calls.length,0);
 }
 const {service,storage}=setup();await service.load({products:['1'],period:'1y'});assert.equal((await storage.get('budget')).calls.length,1);
});
test('provider 429 uses persisted cooldown without retry loops and refreshes only expired entries',async()=>{
 const {storage,cache}=setup();let calls=0;
 const service=new PriceService(storage,cache,'fake',{now:()=>now,fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'600'}});}});
 await storage.put(priceKey('1','1y'),entry('1',now-FRESH_MS));
 assert.equal((await service.load({products:['1'],period:'1y'})).error,'PROVIDER_RATE_LIMITED');
 assert.equal((await service.load({products:['1'],period:'1y'})).error,'PRICE_BUDGET_LIMIT');assert.equal(calls,1);
});
test('cleanup expires the durable cache mirror while preserving quota accounting',async()=>{
 const {service,storage}=setup();
 await storage.put(priceKey('1','1y'),entry('1',now-8*86400_000));
 await storage.put(priceKey('2','1y'),entry('2',now));
 await storage.put('budget',{calls:[now],blockedUntil:0});
 assert.equal(await service.prune(),now+7*86400_000);
 assert.equal(await storage.get(priceKey('1','1y')),undefined);
 assert.equal((await storage.get('budget')).calls.length,1);
});
const helpers={reply:(data,status,headers)=>Response.json(data,{status,headers}),verifyFirebaseBearer:async()=>true};
const request=(products=['1'])=>new Request('https://worker/api/market/prices',{method:'POST',body:JSON.stringify({products,period:'1y'})});
test('endpoint shares fresh KV hits without coordinator calls and labels partial/stale/unavailable responses',async()=>{
 const cache=new Store(); await cache.put(priceKey('1','1y'),entry('1',Date.now()));
 await cache.put(priceKey('2','1y'),entry('2',Date.now()-FRESH_MS-1000));
 const env={MARKET_CACHE:cache,JUSTTCG_API_KEY:'fake',PRICE_COORDINATOR:{getByName:()=>({load:async()=>({entries:[],error:'PROVIDER_UNAVAILABLE',retryAfter:120})})}};
 let r=await pricesApi(request(['1','2','3']),env,{},helpers);let body=await r.json();
 assert.deepEqual(body.results.map(r=>r.cache),['fresh','stale','unavailable']);assert.equal(body.results[1].error,'PROVIDER_UNAVAILABLE');assert.equal(body.results[2].data,null);
 env.PRICE_COORDINATOR.getByName=()=>{throw Error('cache hit must bypass coordinator');};
 r=await pricesApi(request(),env,{},helpers);assert.equal(r.status,200);
});
test('origin/auth/method gates protect provider budget; no secret in public health or auth errors',async()=>{
 const req=new Request('https://worker/api/market/prices',{method:'POST',headers:{origin:'https://xfayne.github.io'},body:'{}'});
 const response=await worker.fetch(req,{ALLOWED_ORIGIN:'https://xfayne.github.io',JUSTTCG_API_KEY:'never-expose'});
 assert.equal(response.status,403);assert.equal((await response.text()).includes('never-expose'),false);
 const denied=await pricesApi(request(),{}, {},{...helpers,verifyFirebaseBearer:async()=>false});assert.equal(denied.status,403);
});
