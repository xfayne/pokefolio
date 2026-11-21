import {useMemo} from 'react';
import {useQueries} from '@tanstack/react-query';
import {useSearchParams} from 'react-router';
import {usePortfolio} from '@/hooks/use-portfolio';
import {catalogCards} from '@/features/catalog/catalog';
import {resolveMarketProduct} from '@/features/catalog/market-prices';
import {useDemoTransactionData} from '@/features/transactions/demo-data';
import {useDemoPortfolio} from '@/features/transactions/demo-context';
import {cardCopySchema,type CardCopy,type Currency} from '@/domain/schema';
import {catalogIdentity} from '@/domain/inventory';
import {selectPerformance,type PriceSeries,type FxRow} from '@/domain/performance';
import type {PortfolioRecord} from '@/domain/persistence';
import {useHistoricalFx} from '@/services/historical-fx';
import {usePortfolioAudit} from '@/services/portfolio-audit';
import {publicPriceClient} from '@/services/public-price-client';
import {selectMarketVariant,useMarketHistory} from '@/services/market-history';
import {useDisplayCurrency} from '@/services/display-currency';

export function useDashboard(month:string){
 const account=usePortfolio(),demo=useDemoTransactionData(),adapter=useDemoPortfolio();
 const [params]=useSearchParams();
 const preview=params.get('dashboard')==='sample';
 const today=new Date().toISOString().slice(0,10),asOf=new Date().toISOString();
 const from=new Date(Date.parse(`${today}T00:00:00Z`)-365*86400_000).toISOString().slice(0,10);
 const audit=usePortfolioAudit(preview?undefined:account.owner,from);
 const currency=useDisplayCurrency()?.currency??'USD';
 const records:readonly PortfolioRecord[]=useMemo(()=>preview?[
  ...demo.history.transactions.map(record=>({collection:'transactions' as const,record})),
  ...demo.history.copies.map(record=>({collection:'copies' as const,record})),
  ...demo.history.saleLines.map(record=>({collection:'lines' as const,record})),
  ...adapter.saleCommands.flatMap(c=>c.creates.filter(e=>e.collection==='revisions')),
 ]:[...account.records,...(audit.data?.audits??[]).map(record=>({collection:'revisions' as const,record}))],[preview,demo.history,adapter.saleCommands,account.records,audit.data]);
 const copies=records.flatMap(e=>e.collection==='copies'?[e.record]:[]);
 const states=[...copies,...records.flatMap(e=>e.collection==='revisions'?[e.record.before,e.record.after].flatMap(raw=>{const p=cardCopySchema.safeParse(raw);return p.success?[p.data]:[];}):[])];
 const relevant=states.filter(c=>c.possession==='received'&&c.disposition==='held'&&c.catalog.kind==='identified'&&c.condition.status==='known'&&c.catalog.kind==='identified'&&c.catalog.edition!=='unknown'&&c.catalog.language.status==='known'&&['en','english'].includes(c.catalog.language.value.toLowerCase())&&c.catalog.finish.status==='known'&&(preview||['normal','holo','shining','reverse'].includes(c.catalog.finish.value)));
 const ids=[...new Set(relevant.flatMap(c=>c.catalog.kind==='identified'?[c.catalog.cardId]:[]))].sort();
 const productQueries=useQueries({queries:ids.map(id=>({queryKey:['catalog-product-id',id],enabled:!preview&&!!account.owner,staleTime:7*86400_000,retry:false,queryFn:async({signal}:{signal:AbortSignal})=>{
  const card=catalogCards.find(c=>c.id===id);return card?resolveMarketProduct(card,signal):null;
 }}))},publicPriceClient);
 const products=new Map(ids.map((id,i)=>[id,productQueries[i]?.data?.productId]));
 const market=useMarketHistory(preview?undefined:account.owner,[...new Set([...products.values()].filter((p):p is string=>!!p))],'1y');
 const dates=[...new Set([...copies.flatMap(c=>c.acquiredOn.status==='known'?[c.acquiredOn.value]:[]),...records.flatMap(e=>e.collection==='transactions'?typeof e.record.transactionOn==='string'?[e.record.transactionOn]:e.record.transactionOn.status==='known'?[e.record.transactionOn.value]:[]:[])])];
 const needsFx=currency!=='USD'||records.some(e=>e.collection==='transactions'&&e.record.currency!=='USD')||copies.some(c=>[c.cardCost,c.shippingCost,c.taxCost,c.feeCost].some(v=>(v.status==='exact'||v.status==='estimated')&&v.value.currency!=='USD'));
 const fx=useHistoricalFx(dates,today,!preview&&!!account.owner&&records.length>0&&needsFx);
 const series=new Map<string,PriceSeries>();
 for(const copy of relevant){
  if(copy.catalog.kind!=='identified'||copy.condition.status!=='known')continue;
  const key=`${catalogIdentity(copy.catalog)}:${copy.condition.value}`;
  if(series.has(key))continue;
  if(preview){series.set(key,sampleSeries(copy,today));continue;}
  const id=products.get(copy.catalog.cardId),result=market.results.find(r=>r.productId===id);
  const variant=result?selectMarketVariant(result,copy.catalog,copy.condition.value):null;
  if(!result||!variant)continue;
  series.set(key,{catalog:copy.catalog,condition:copy.condition.value,currency:variant.currency,current:variant.current!==null&&variant.observedAt?{minor:variant.current,observedAt:variant.observedAt}:null,history:variant.history,source:result.data!.source,stale:result.cache==='stale'});
 }
 const loading=!preview&&(account.loading||!!account.owner&&(audit.isPending||productQueries.some(q=>q.isPending)||market.loading||fx.loading));
 let result:ReturnType<typeof selectPerformance>|null=null,error:unknown=account.error;
 try {if(!loading)result=selectPerformance({owner:preview?demo.history.ownerUid:account.owner??'disconnected',records,catalog:catalogCards,prices:[...series.values()],fx:preview?sampleFx(today):fx.rows,currency,asOf,month});}
 catch(e){error=e;}
 return {result,currency,preview,owner:account.owner,loading,error,
  priceFailure:!preview&&(market.failed||productQueries.some(q=>q.isError)||market.results.some(r=>r.cache!=='fresh')),
  historyFailure:!preview&&(audit.isError||audit.data?.truncated===true),fxFailure:fx.failed,
  sourceDate:[...series.values()].flatMap(s=>s.current?[s.current.observedAt.slice(0,10)]:[]).sort()[0]??null,
  retry:async()=>{await Promise.all([market.retry(),fx.retry(),...productQueries.filter(q=>q.isError).map(q=>q.refetch()),...(account.owner?[audit.refetch()]:[])]);},
 };
}
function sampleSeries(copy:CardCopy,today:string):PriceSeries {
 const cost=copy.cardCost.status==='exact'||copy.cardCost.status==='estimated'?copy.cardCost.value.minor:3000;
 const amount=Math.max(1,Math.round(cost*1.5));
 return {catalog:copy.catalog,condition:copy.condition.status==='known'?copy.condition.value:'LP',currency:'USD',current:{minor:amount,observedAt:`${today}T00:00:00Z`},source:'Synthetic demo',stale:false,
  history:Array.from({length:366},(_,i)=>{const date=new Date(Date.parse(`${today}T00:00:00Z`)-(365-i)*86400_000).toISOString().slice(0,10);return {date,minor:Math.round(amount*(0.65+0.35*i/365+0.025*Math.sin(i/8)))};})};
}
function sampleFx(today:string):FxRow[]{
 return Array.from({length:373},(_,i)=>{const date=new Date(Date.parse(`${today}T00:00:00Z`)-i*86400_000).toISOString().slice(0,10);return ([['GBP',0.8],['EUR',0.9],['ILS',3.7]] as [Currency,number][]).map(([quote,rate])=>({date,quote,rate}));}).flat();
}
