import { z } from 'zod';
import { useQueries, type Query } from '@tanstack/react-query';
import { conditionSchema, dateSchema, type CatalogRef } from '@/domain/schema';
import { publicPriceClient } from './public-price-client';
import { createApiClient } from './api';
import { getEnvironment } from './environment';
import { getFirebaseServices, getIdToken } from './firebase';

export const marketPeriodSchema=z.enum(['7d','30d','90d','180d','1y']);
export type MarketPeriod=z.infer<typeof marketPeriodSchema>;
const minor=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const marketVariantSchema=z.object({
 condition:conditionSchema, printing:z.string().min(1).max(100),language:z.string().max(40),currency:z.literal('USD'),
 current:minor.nullable(), observedAt:z.iso.datetime().nullable(),status:z.enum(['current','expired','unpriced']),
 history:z.array(z.object({date:dateSchema,minor})).max(400),
});
const entrySchema=z.object({schemaVersion:z.literal(1),provider:z.literal('justtcg'),source:z.string(),productId:z.string().regex(/^[1-9]\d{0,9}$/),currency:z.literal('USD'),period:marketPeriodSchema,fetchedAt:z.number().int().nonnegative(),variants:z.array(marketVariantSchema).max(500)});
const resultSchema=z.object({productId:z.string(),cache:z.enum(['fresh','stale','unavailable']),data:entrySchema.nullable(),error:z.string().nullable(),retryAfter:z.number().positive().nullable()});
const responseSchema=z.object({schemaVersion:z.literal(1),results:z.array(resultSchema).max(20)});
export type MarketResult=z.infer<typeof resultSchema>;
export const marketHistoryKey=(productId:string,period:MarketPeriod)=>['market-history','v1',productId,period] as const;

export async function fetchMarketHistory(owner:string,products:readonly string[],period:MarketPeriod,signal?:AbortSignal):Promise<MarketResult[]> {
 const ids=[...new Set(products)].sort();
 if(!ids.length || ids.length>20 || ids.some(id=>!entrySchema.shape.productId.safeParse(id).success))throw Error('Invalid market products');
 const env=getEnvironment();
 if(!env?.workerUrl)throw Error('Price service unavailable');
 const client=createApiClient(env.workerUrl,async()=>{
  if(getFirebaseServices()?.auth.currentUser?.uid!==owner)throw Error('Sign in before loading market history');
  return getIdToken();
 });
 const response=responseSchema.parse((await client.post('/api/market/prices',{products:ids,period},signal?{signal}:{})).data);
 if(response.results.length!==ids.length || new Set(response.results.map(r=>r.productId)).size!==ids.length || response.results.some(r=>!ids.includes(r.productId) || (r.data && (r.data.productId!==r.productId || r.data.period!==period))))throw Error('Mismatched market response');
 return response.results;
}

// Each canonical batch is shared across renders. Only public market responses enter
// this QueryClient; no portfolio records, owner IDs or tokens are cached in it.
export function useMarketHistory(owner:string|undefined,products:readonly string[],period:MarketPeriod) {
 const ids=[...new Set(products)].sort();
 const batches=Array.from({length:Math.ceil(ids.length/20)},(_,i)=>ids.slice(i*20,i*20+20));
 const queries=useQueries({queries:batches.map(batch=>({
  queryKey:['market-history-batch','v1',period,...batch],enabled:!!owner,
  queryFn:({signal}:{signal:AbortSignal})=>fetchMarketHistory(owner!,batch,period,signal),
  staleTime:(query:Query<MarketResult[]>)=>{
   const rows=query.state.data;
   if(!rows)return 0;
   if(rows.some(r=>r.cache!=='fresh'))return Math.min(120,...rows.map(r=>r.retryAfter??30))*1000;
   return Math.max(0,Math.min(...rows.map(r=>(r.data?.fetchedAt??0)+24*3600_000))-query.state.dataUpdatedAt);
  },gcTime:24*3600_000,retry:false,
  // Stale fallback/errors are useful for display but must not become fresh for 24h.
  refetchOnWindowFocus:false,
 }))},publicPriceClient);
 return {results:owner?queries.flatMap(q=>q.data??[]):[],loading:!!owner&&queries.some(q=>q.isPending),failed:queries.some(q=>q.isError),retry:()=>Promise.all(queries.map(q=>q.refetch()))};
}

export function selectMarketVariant(result:MarketResult,catalog:CatalogRef,condition:z.infer<typeof conditionSchema>) {
 if(!result.data || catalog.kind!=='identified' || catalog.edition==='unknown' || catalog.language.status!=='known' || catalog.language.value!=='English' || catalog.finish.status!=='known')return null;
 const finish=catalog.finish.value;
 if(!['normal','holo','shining','reverse'].includes(finish))return null;
 const matches=result.data.variants.filter(v=>{
  const printing=v.printing.toLowerCase();
  const suffix=finish==='holo'||finish==='shining'?'holofoil':finish==='reverse'?'reverse holofoil':'';
  const accepted=catalog.edition==='first-edition'?[`1st edition ${suffix}`.trim(),`first edition ${suffix}`.trim()]:suffix?[suffix,`unlimited ${suffix}`]:['normal','unlimited'];
  return v.language==='English' && v.condition===condition && accepted.includes(printing);
 });
 return matches.length===1?matches[0]!:null;
}
