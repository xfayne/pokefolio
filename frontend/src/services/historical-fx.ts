import {useQueries} from '@tanstack/react-query';
import {z} from 'zod';
import {currencySchema,dateSchema} from '@/domain/schema';
import type {FxRow} from '@/domain/performance';
import {publicPriceClient} from './public-price-client';
const rowSchema=z.object({base:z.literal('USD'),quote:currencySchema,date:dateSchema,rate:z.number().finite().positive()});
export async function fetchHistoricalFx(from:string,to:string,signal:AbortSignal):Promise<FxRow[]> {
 dateSchema.parse(from);dateSchema.parse(to);
 const params=new URLSearchParams({base:'USD',quotes:'GBP,EUR,ILS',...(from===to?{date:from}:{from,to})});
 const response=await fetch(`https://api.frankfurter.dev/v2/rates?${params}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(13000)]),credentials:'omit'});
 if(!response.ok)throw Error('Historical reference FX unavailable');
 return z.array(rowSchema).max(5000).parse(await response.json()).map(({quote,date,rate})=>({quote,date,rate}));
}
export function useHistoricalFx(dates:readonly string[],today:string,enabled:boolean){
 const from=new Date(Date.parse(`${today}T00:00:00Z`)-372*86400_000).toISOString().slice(0,10);
 const older=[...new Set(dates.filter(d=>d<from))].sort();
 const windows=[{from,to:today},...older.map(d=>({from:d,to:d}))];
 const queries=useQueries({queries:windows.map(w=>({queryKey:['historical-reference-fx','v2',w.from,w.to],enabled,queryFn:({signal}:{signal:AbortSignal})=>fetchHistoricalFx(w.from,w.to,signal),staleTime:24*3600_000,retry:false}))},publicPriceClient);
 const rows=new Map<string,FxRow>();
 for(const result of queries)for(const row of result.data??[])rows.set(`${row.date}:${row.quote}`,row);
 return {rows:[...rows.values()],loading:enabled&&queries.some(q=>q.isPending),failed:enabled&&queries.some(q=>q.isError),retry:()=>Promise.all(queries.filter(q=>q.isError).map(q=>q.refetch()))};
}
