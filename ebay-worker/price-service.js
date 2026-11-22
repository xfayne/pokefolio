import {fetchJustTcg,isFresh,priceKey,RETAIN_SECONDS} from './market-prices.js';

// One coordinator per provider credential/quota account, reached only on misses.
// KV alone cannot atomically reserve global quota. Durable storage owns this atom.
// Pure service is dependency-injected for existing node:test suite and runtime tests.
export class PriceService {
 constructor(storage,cache,key,{now=Date.now,fetcher=fetch}={}) {
  this.storage=storage; this.cache=cache; this.key=key; this.now=now; this.fetcher=fetcher;
  this.tail=Promise.resolve();
 }
 load(input) {
  const work=this.tail.then(()=>this.run(input));
  this.tail=work.catch(()=>{});
  return work;
 }
 prune() {
  const work=this.tail.then(()=>this.pruneNow());
  this.tail=work.catch(()=>{});
  return work;
 }
 async pruneNow() {
  // Cleanup only; this never calls a provider or collects daily measurements.
  let startAfter, next=null;
  for (;;) {
   const page=await this.storage.list({prefix:'market:',limit:128,...(startAfter?{startAfter}:{})});
   const expired=[];
   for(const [key,entry] of page) {
    const expires=entry.fetchedAt+RETAIN_SECONDS*1000;
    if(expires<=this.now())expired.push(key);else next=next===null?expires:Math.min(next,expires);
    startAfter=key;
   }
   if(expired.length)await this.storage.delete(expired);
   if(page.size<128)break;
  }
  return next;
 }
 async run({products,period}) {
  const now=this.now();
  const entries=[],misses=[];
  for(const product of products) {
   // Strongly consistent short-lived mirror bridges KV negative/old edge reads.
   const local=await this.storage.get(priceKey(product,period));
   const cached=isFresh(local,now)?local:await this.cache.get(priceKey(product,period),'json');
   if(isFresh(cached,now))entries.push(cached); else misses.push(product);
  }
  if(!misses.length)return {entries,error:null,retryAfter:null};
  const state=await this.storage.get('budget') ?? {calls:[],blockedUntil:0};
  const calls=state.calls.filter(t=>t>now-31*86400_000);
  const day=new Date(now).toISOString().slice(0,10);
  let retryAt=state.blockedUntil;
  // Reserve headroom for manual evaluations; a rolling 31-day window is conservative
  // across the provider's account-specific monthly reset date.
  if(calls.length>=900)retryAt=Math.max(retryAt,calls[0]+31*86400_000);
  if(calls.filter(t=>new Date(t).toISOString().slice(0,10)===day).length>=90)retryAt=Math.max(retryAt,Date.parse(day)+86400_000);
  if(calls.filter(t=>t>now-60_000).length>=9)retryAt=Math.max(retryAt,calls.filter(t=>t>now-60_000)[0]+60_000);
  if(retryAt>now)return {entries,error:'PRICE_BUDGET_LIMIT',retryAfter:Math.ceil((retryAt-now)/1000)};
  // Durable reservation precedes the external call; failures conservatively count.
  await this.storage.put('budget',{calls:[...calls,now],blockedUntil:0});
  let loaded;
  try {loaded=await fetchJustTcg(misses,period,this.key,now,this.fetcher);}
  catch(error) {
   const retryAfter=error.message==='PROVIDER_AUTH_FAILED'?3600:(error.retryAfter ?? 120);
   await this.storage.put('budget',{calls:[...calls,now],blockedUntil:now+retryAfter*1000});
   return {entries,error:['PROVIDER_AUTH_FAILED','PROVIDER_RATE_LIMITED'].includes(error.message)?error.message:'PROVIDER_UNAVAILABLE',retryAfter};
  }
  for(const entry of loaded) {
   // Persist mirror first, and await KV writes within the request lifetime.
   await this.storage.put(priceKey(entry.productId,period),entry);
   await this.cache.put(priceKey(entry.productId,period),JSON.stringify(entry),{expirationTtl:RETAIN_SECONDS});
   entries.push(entry);
  }
  return {entries,error:null,retryAfter:null};
 }
}
