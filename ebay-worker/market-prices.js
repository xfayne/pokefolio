// Provider-neutral public market DTOs. No owner, portfolio or credential data.
export const HISTORY_WINDOWS = ['7d', '30d', '90d', '180d', '1y'];
export const FRESH_MS = 24 * 3600_000;
export const RETAIN_SECONDS = 7 * 86400; // bounded stale fallback, not an archive
export function parsePriceRequest(raw) {
 if (!raw || !Array.isArray(raw.products) || !raw.products.length || raw.products.length > 20 || !HISTORY_WINDOWS.includes(raw.period)) throw Error('INVALID_PRICE_REQUEST');
 if (raw.products.some(id => typeof id !== 'string' || !/^[1-9]\d{0,9}$/.test(id))) throw Error('INVALID_PRICE_REQUEST');
 return { products: [...new Set(raw.products)].sort(), period: raw.period };
}
// Each product envelope contains ALL exact variants/conditions. Windows, currency,
// provider and schema version are separated; presentation never substitutes siblings.
export const priceKey = (product, period) => `market:v1:justtcg:USD:${product}:${period}`;
export function usableEntry(entry, now) {
 return !!entry && entry.schemaVersion === 1 && Number.isFinite(entry.fetchedAt) && entry.fetchedAt <= now && now - entry.fetchedAt < RETAIN_SECONDS * 1000 && Array.isArray(entry.variants);
}
export const isFresh = (entry, now) => usableEntry(entry, now) && now - entry.fetchedAt < FRESH_MS;
const conditions = { 'Near Mint': 'NM', 'Lightly Played': 'LP', 'Moderately Played': 'MP', 'Heavily Played': 'HP', Damaged: 'DAMAGED' };
function minor(value) {
 if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) return null;
 return Math.round(value * 100);
}
function timestamp(value, now) {
 if (!Number.isSafeInteger(value) || value < 0 || value * 1000 > now) return null;
 return new Date(value * 1000).toISOString();
}
export function normalizeProduct(card, product, period, now) {
 if (!card || String(card.tcgplayerId) !== product || !Array.isArray(card.variants) || card.variants.length > 500) throw Error('INVALID_PROVIDER_RESPONSE');
 const days = period === '1y' ? 365 : Number(period.slice(0, -1));
 const from = new Date(now).setUTCHours(0, 0, 0, 0) - days * 86400_000;
 const variants = [], identities = new Set();
 for (const v of card.variants) {
  const condition = conditions[v.condition];
  if (!condition || typeof v.printing !== 'string' || !v.printing || v.printing.length > 100 || typeof v.language !== 'string' || v.language.length > 40) continue;
  const identity = JSON.stringify([v.language, v.printing, condition]);
  if (identities.has(identity)) throw Error('AMBIGUOUS_PROVIDER_VARIANT');
  identities.add(identity);
  const observedAt = timestamp(v.lastUpdated, now);
  const status = ['current','expired','unpriced'].includes(v.priceStatus) ? v.priceStatus : 'unpriced';
  if (v.priceHistory != null && (!Array.isArray(v.priceHistory) || v.priceHistory.length > 400)) throw Error('INVALID_PROVIDER_HISTORY');
  const points = new Map();
  for (const point of v.priceHistory ?? []) {
   const at = timestamp(point.t, now), amount = minor(point.p);
   if (!at || amount === null || Date.parse(at) < from) continue;
   const date = at.slice(0,10);
   if (points.has(date) && points.get(date) !== amount) throw Error('AMBIGUOUS_PROVIDER_HISTORY');
   points.set(date, amount);
  }
  variants.push({ condition, printing:v.printing, language:v.language, currency:'USD',
   current:status === 'current' && observedAt ? minor(v.price) : null, observedAt, status,
   history:[...points].sort(([a],[b])=>a.localeCompare(b)).map(([date,minor])=>({date,minor})) });
 }
 return { schemaVersion:1, provider:'justtcg', source:'JustTCG', productId:product, currency:'USD', period, fetchedAt:now, variants };
}
async function boundedJson(response, maxBytes=12_000_000) {
 const reader = response.body?.getReader();
 if (!reader) throw Error('INVALID_PROVIDER_RESPONSE');
 const chunks = []; let size = 0;
 try {
  for (;;) {
   const {done,value} = await reader.read(); if (done) break;
   size += value.byteLength;
   if (size > maxBytes) { await reader.cancel(); throw Error('PROVIDER_RESPONSE_TOO_LARGE'); }
   chunks.push(value);
  }
 } finally { reader.releaseLock(); }
 const bytes = new Uint8Array(size); let offset=0;
 for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
 return JSON.parse(new TextDecoder().decode(bytes));
}
export async function fetchJustTcg(products, period, apiKey, now, fetcher=fetch) {
 const response = await fetcher('https://api.justtcg.com/v1/cards', {
  method:'POST', headers:{'content-type':'application/json','x-api-key':apiKey},
  signal:AbortSignal.timeout(15_000),
  // POST requires the history duration on EACH lookup, not on the URL.
  body:JSON.stringify(products.map(tcgplayerId=>({tcgplayerId,priceHistoryDuration:period})))
 });
 if (!response.ok) {
  const error = new Error(response.status===429?'PROVIDER_RATE_LIMITED':response.status===401||response.status===403?'PROVIDER_AUTH_FAILED':'PROVIDER_UNAVAILABLE');
  const retry = Number(response.headers.get('retry-after'));
  error.retryAfter = Number.isFinite(retry) && retry>0 ? Math.min(86400,Math.ceil(retry)) : 120;
  // Never return upstream bodies, request headers or credentials.
  throw error;
 }
 const data = await boundedJson(response);
 if (!Array.isArray(data.data) || data.data.length > 20) throw Error('INVALID_PROVIDER_RESPONSE');
 return products.map(product => {
  const cards=data.data.filter(c=>String(c.tcgplayerId)===product);
  if (cards.length>1) throw Error('AMBIGUOUS_PROVIDER_PRODUCT');
  return cards.length ? normalizeProduct(cards[0],product,period,now) : {schemaVersion:1,provider:'justtcg',source:'JustTCG',productId:product,currency:'USD',period,fetchedAt:now,variants:[]};
 });
}

export async function pricesApi(request,env,headers,{reply,verifyFirebaseBearer}) {
 if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405,headers);
 try {
  if(!(await verifyFirebaseBearer(request,env,env.PRICE_OWNER_EMAIL || env.TRACK17_OWNER_EMAIL)))return reply({error:'PRICE_AUTH_REQUIRED'},403,headers);
 } catch {return reply({error:'PRICE_AUTH_UNAVAILABLE'},503,headers);}
 let input;
 try {
  input=parsePriceRequest(await boundedJson(request,2048));
 } catch {return reply({error:'INVALID_PRICE_REQUEST'},400,headers);}
 if(!env.MARKET_CACHE || !env.PRICE_COORDINATOR || !env.JUSTTCG_API_KEY)return reply({error:'PRICE_SERVICE_UNAVAILABLE'},503,headers);
 try {
  const now=Date.now();
  const cached=await Promise.all(input.products.map(p=>env.MARKET_CACHE.get(priceKey(p,input.period),'json')));
  const misses=input.products.filter((_,i)=>!isFresh(cached[i],now));
  const loaded=misses.length ? await env.PRICE_COORDINATOR.getByName('justtcg-account-v1').load({products:misses,period:input.period}) : {entries:[],error:null,retryAfter:null};
  const responseTime=Date.now();
  const results=input.products.map((product,i)=>{
   const entry=loaded.entries.find(e=>e.productId===product) ?? cached[i];
   const usable=usableEntry(entry,responseTime);
   return {productId:product,cache:usable?(isFresh(entry,responseTime)?'fresh':'stale'):'unavailable',data:usable?entry:null,error:isFresh(entry,responseTime)?null:loaded.error ?? 'PRICE_UNAVAILABLE',retryAfter:isFresh(entry,responseTime)?null:loaded.retryAfter};
  });
  return reply({schemaVersion:1,results},200,headers);
 } catch {return reply({error:'PRICE_SERVICE_UNAVAILABLE'},503,headers);}
}
