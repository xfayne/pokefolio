import {useMemo} from 'react';
import {useQueries,useQueryClient} from '@tanstack/react-query';
import {useSearchParams} from 'react-router';
import {usePortfolio} from '@/hooks/use-portfolio';
import {catalogCards} from '@/features/catalog/catalog';
import {resolveMarketProduct} from '@/features/catalog/market-prices';
import {useInventoryPrices} from '@/features/inventory/use-inventory-prices';
import {dashboardPriceSeries} from './dashboard-prices';
import {useDemoTransactionData} from '@/features/transactions/demo-data';
import {useDemoPortfolio} from '@/features/transactions/demo-context';
import {cardCopySchema,type CardCopy,type Currency} from '@/domain/schema';
import {selectPerformance,type PriceSeries,type FxRow} from '@/domain/performance';
import type {PortfolioRecord} from '@/domain/persistence';
import {useHistoricalFx} from '@/services/historical-fx';
import {usePortfolioAudit} from '@/services/portfolio-audit';
import {publicPriceClient} from '@/services/public-price-client';
import {useMarketHistory} from '@/services/market-history';
import {useDisplayCurrency} from '@/services/display-currency';

export function useDashboard(month:string){
 const account=usePortfolio(),demo=useDemoTransactionData(),adapter=useDemoPortfolio();
 const privateClient=useQueryClient();
 const [params]=useSearchParams();
 const preview=params.get('dashboard')==='sample';
 const today=new Date().toISOString().slice(0,10),asOf=new Date().toISOString();
 const from=new Date(Date.parse(`${today}T00:00:00Z`)-365*86400_000).toISOString().slice(0,10);
 const audit=usePortfolioAudit(preview?undefined:account.owner,from);
 const display=useDisplayCurrency();
 const currency=display?.currency??'USD';
 const records:readonly PortfolioRecord[]=useMemo(()=>preview?[
  ...demo.history.transactions.map(record=>({collection:'transactions' as const,record})),
  ...demo.history.copies.map(record=>({collection:'copies' as const,record})),
  ...demo.history.saleLines.map(record=>({collection:'lines' as const,record})),
  ...adapter.saleCommands.flatMap(c=>c.creates.filter(e=>e.collection==='revisions')),
 ]:[...account.records,...(audit.data?.audits??[]).map(record=>({collection:'revisions' as const,record}))],[preview,demo.history,adapter.saleCommands,account.records,audit.data]);
 const copies=records.flatMap(e=>e.collection==='copies'?[e.record]:[]);
 const states=[...copies,...records.flatMap(e=>e.collection==='revisions'?[e.record.before,e.record.after].flatMap(raw=>{const p=cardCopySchema.safeParse(raw);return p.success?[p.data]:[];}):[])];
 const relevant=states.filter(c=>c.possession==='received'&&c.disposition==='held'&&c.catalog.kind==='identified'&&c.condition.status==='known'&&c.catalog.edition!=='unknown'&&c.catalog.finish.status==='known'&&(preview||['normal','holo','shining','reverse'].includes(c.catalog.finish.value)));
 // Copies imported today have no recorded pre-import possession history.
 // Don't exhaust the history provider's quota when a historical chart is impossible.
 const historyPossible=copies.some(c=>c.possession==='received'&&c.disposition==='held'&&c.createdAt.slice(0,10)<today);
 const currentPrices=useInventoryPrices(relevant,!preview&&!!account.owner);
 const ids=[...new Set(relevant.flatMap(c=>c.catalog.kind==='identified'?[c.catalog.cardId]:[]))].sort();
 const productQueries=useQueries({queries:ids.map(id=>({queryKey:['catalog-product-id',id],enabled:!preview&&!!account.owner&&historyPossible,staleTime:7*86400_000,retry:false,queryFn:async({signal}:{signal:AbortSignal})=>{
  const card=catalogCards.find(c=>c.id===id);return card?resolveMarketProduct(card,signal):null;
 }}))},publicPriceClient);
 const products=new Map(ids.map((id,i)=>[id,productQueries[i]?.data?.productId]));
 const market=useMarketHistory(preview||!historyPossible?undefined:account.owner,[...new Set([...products.values()].filter((p):p is string=>!!p))],'1y');
 const dates=[...new Set([...copies.flatMap(c=>c.acquiredOn.status==='known'?[c.acquiredOn.value]:[]),...records.flatMap(e=>e.collection==='transactions'?typeof e.record.transactionOn==='string'?[e.record.transactionOn]:e.record.transactionOn.status==='known'?[e.record.transactionOn.value]:[]:[])])];
 const needsFx=currency!=='USD'||records.some(e=>e.collection==='transactions'&&e.record.currency!=='USD')||copies.some(c=>[c.cardCost,c.shippingCost,c.taxCost,c.feeCost].some(v=>(v.status==='exact'||v.status==='estimated')&&v.value.currency!=='USD'));
 const fx=useHistoricalFx(dates,today,!preview&&!!account.owner&&records.length>0&&needsFx);
 // Current quotes are shared with Collection (same QueryClient/cache key).
 // History is optional and cannot replace missing or unverified current data.
 const currentSeries=dashboardPriceSeries(relevant,products,market.results,currentPrices.quotes);
 const series:PriceSeries[]=preview?[...new Map(relevant.filter(c=>c.catalog.kind==='identified'&&c.condition.status==='known').map(c=>[`${c.catalog.kind==='identified'?c.catalog.cardId:''}:${c.condition.status==='known'?c.condition.value:''}`,sampleSeries(c,today)])).values()]:currentSeries;
 // The existing display currency service supplies a dated reference FX rate.
 // If the 1-year reference request fails, a recent genuine spot observation
 // can still convert today's market value; old purchase costs remain unknown.
 const fxRows=[...fx.rows];
 if(!preview&&display?.date&&display.rates){
  for(const quote of ['GBP','EUR','ILS'] as const){
   const rate=display.rates[quote];
   if(rate&&Number.isFinite(rate)&&rate>0&&!fxRows.some(row=>row.date===display.date&&row.quote===quote))
    fxRows.push({date:display.date,quote,rate});
  }
 }
 const loading=!preview&&(account.loading||!!account.owner&&(audit.isPending||currentPrices.loading||fx.loading||(currentSeries.length===0&&(productQueries.some(q=>q.isPending)||market.loading))));
 const portfolioError=preview?null:account.error;
 let result:ReturnType<typeof selectPerformance>|null=null,error:unknown=portfolioError;
 try {if(!loading&&!portfolioError)result=selectPerformance({owner:preview?demo.history.ownerUid:account.owner??'disconnected',records,catalog:catalogCards,prices:series,fx:preview?sampleFx(today):fxRows,currency,asOf,month});}
 catch(e){error=e;}
 return {result,currency,preview,owner:account.owner,loading,error,
  priceFailure:!preview&&(currentPrices.failed||market.failed||productQueries.some(q=>q.isError)||market.results.some(r=>r.cache!=='fresh')),
  historyFailure:!preview&&(audit.isError||audit.data?.truncated===true),fxFailure:fx.failed,
  sourceDate:series.flatMap(s=>s.current?[s.current.observedAt.slice(0,10)]:[]).sort().at(-1)??null,
  retry:async()=>{currentPrices.retry();await Promise.all([market.retry(),fx.retry(),...productQueries.filter(q=>q.isError).map(q=>q.refetch()),...(account.owner?[privateClient.invalidateQueries({queryKey:['portfolio',account.owner]})]:[])]);},
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
