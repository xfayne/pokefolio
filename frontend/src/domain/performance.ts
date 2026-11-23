import {cardCopySchema, currencySchema, dateSchema, idSchema, type CardCopy, type CatalogRef, type Condition, type Cost, type Currency, type Money, type Revision} from './schema';
import {portfolioRecordSchema,recordKey,type PortfolioRecord} from './persistence';
import {catalogIdentity,type InventoryCatalogCard} from './inventory';
import {costBasis,netSaleProceeds,safeInteger,type Metric} from './money';
import {selectHistory,type HistoryData} from './transaction-history';

export type PriceSeries=Readonly<{catalog:CatalogRef;condition:Condition;currency:Currency;current:Readonly<{minor:number;observedAt:string}>|null;history:readonly Readonly<{date:string;minor:number}>[];source:string;stale:boolean}>;
export type FxRow=Readonly<{date:string;quote:Currency;rate:number}>; // USD base, dated reference observations
export type Total=Readonly<{minor:number|null;currency:Currency;covered:number;total:number;estimated:boolean}>;
export type PerformancePoint=Readonly<{date:string;value:Total;held:number;unknownHistory:number;matchedChange:number|null;matchedCount:number}>;
export type PerformanceInput=Readonly<{owner:string;records:readonly PortfolioRecord[];catalog:readonly InventoryCatalogCard[];prices:readonly PriceSeries[];fx:readonly FxRow[];currency:Currency;asOf:string;month?:string}>;
const unavailable=(reason:string):Metric=>({status:'unavailable',reason});
const subtract=(a:Metric,b:Metric):Metric=>a.status==='unavailable'?a:b.status==='unavailable'?b:a.currency!==b.currency?unavailable('Currency mismatch'):{status:a.status==='estimated'||b.status==='estimated'?'estimated':'exact',currency:a.currency,minor:safeInteger(BigInt(a.minor)-BigInt(b.minor))};
export const copyCosts=(copy:CardCopy):readonly Cost[]=>[copy.cardCost,copy.shippingCost,copy.taxCost,copy.feeCost];
const sum=(values:readonly Metric[],currency:Currency):Total=>{
 const known=values.filter(v=>v.status!=='unavailable');
 if(known.some(v=>v.currency!==currency))throw Error('Unconverted performance total');
 return {currency,minor:!known.length&&values.length?null:safeInteger(known.reduce((n,v)=>n+BigInt(v.minor),0n)),covered:known.length,total:values.length,estimated:known.some(v=>v.status==='estimated')};
};
const day=(timestamp:string)=>timestamp.slice(0,10);
const previousDay=(value:string,n=1)=>new Date(Date.parse(`${value}T00:00:00Z`)-n*86400_000).toISOString().slice(0,10);
export function referenceConverter(rows:readonly FxRow[]) {
 const byCurrency=new Map<Currency,FxRow[]>();
 for(const row of rows){
  dateSchema.parse(row.date);currencySchema.parse(row.quote);
  if(!Number.isFinite(row.rate)||row.rate<=0)throw Error('Invalid historical FX');
  const list=byCurrency.get(row.quote)??[];
  const existing=list.find(v=>v.date===row.date);
  if(existing&&existing.rate!==row.rate)throw Error('Ambiguous historical FX');
  if(!existing)list.push(row);byCurrency.set(row.quote,list);
 }
 for(const list of byCurrency.values())list.sort((a,b)=>a.date.localeCompare(b.date));
 const rate=(currency:Currency,date:string)=>currency==='USD'?1:byCurrency.get(currency)?.findLast(r=>r.date<=date && r.date>=previousDay(date,7))?.rate;
 return (money:Money,target:Currency,date:string|null):Metric=>{
  if(money.currency===target)return {...money,status:'exact'};
  if(!date)return unavailable('Historical FX date unknown');
  const a=rate(money.currency,date),b=rate(target,date);
  if(!a||!b)return unavailable('Historical FX unavailable');
  // Integer minor units, one half-up rounding at the conversion boundary.
  const decimal=(b/a).toFixed(12),numerator=BigInt(decimal.replace('.','')),denominator=1_000_000_000_000n;
  const amount=BigInt(money.minor),sign=amount<0n?-1n:1n;
  return {status:'estimated',currency:target,minor:safeInteger(sign*(((amount*sign)*numerator*2n+denominator)/(denominator*2n)))};
 };
}
export function acquisitionBasis(costs:readonly Cost[],date:string|null,currency:Currency,convert:ReturnType<typeof referenceConverter>):Metric {
 if(costs.length!==4 || costs.some(c=>c.status==='unknown'||c.status==='unallocated'))return unavailable('Incomplete cost basis');
 const first=costs[0];
 if(!first||first.status==='unknown'||first.status==='unallocated')return unavailable('Incomplete cost basis');
 const native=costBasis(costs,first.value.currency);
 if(native.status==='unavailable')return native;
 const converted=convert(native,currency,date);
 return converted.status==='unavailable'?converted:{...converted,status:native.status==='estimated'?'estimated':converted.status};
}
const stable=(v:unknown):string=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,JSON.parse(stable(x))])):v);

/** Recorded-time history: receipt never predates its delivery audit. Do not
 * manufacture pre-import possession or replay today's metadata into the past. */
export function copyTimeline(copy:CardCopy,audits:readonly Revision[]) {
 const links=new Map<number,{before:CardCopy;after:CardCopy}>();
 for(const audit of audits){
  if(audit.recordId!==copy.id)continue;
  const before=cardCopySchema.safeParse(audit.before),after=cardCopySchema.safeParse(audit.after);
  if(!before.success||!after.success)continue;
  if(audit.ownerUid!==copy.ownerUid||before.data.ownerUid!==copy.ownerUid||after.data.ownerUid!==copy.ownerUid)throw Error('Foreign copy audit');
  if(after.data.id!==copy.id||before.data.id!==copy.id||after.data.revision!==before.data.revision+1||links.has(after.data.revision))throw Error('Conflicting copy audit');
  links.set(after.data.revision,{before:before.data,after:after.data});
 }
 const versions=[copy];let cursor=copy;
 for(;;){const link=links.get(cursor.revision);if(!link)break;
  if(stable(link.after)!==stable(cursor)||Date.parse(link.before.updatedAt)>Date.parse(cursor.updatedAt))throw Error('Broken copy audit chain');
  cursor=link.before;versions.push(cursor);
 }
 return {versions,at:(date:string):{copy:CardCopy|null;unknown:boolean}=>{
  if(date<day(copy.createdAt))return {copy:null,unknown:false};
  const version=versions.find(v=>day(v.updatedAt)<=date);
  return version?{copy:version,unknown:false}:{copy:null,unknown:true};
 }};
}
const seriesKey=(catalog:CatalogRef,condition:Condition)=>`${catalogIdentity(catalog)}:${condition}`;
export function selectPerformance(input:PerformanceInput) {
 idSchema.parse(input.owner);currencySchema.parse(input.currency);dateSchema.parse(day(input.asOf));
 const records=input.records.map(e=>portfolioRecordSchema.parse(e));
 if(records.some(e=>e.record.ownerUid!==input.owner)||new Set(records.map(recordKey)).size!==records.length)throw Error('Foreign or duplicate portfolio record');
 const copies=records.flatMap(e=>e.collection==='copies'?[e.record]:[]);
 const transactions=records.flatMap(e=>e.collection==='transactions'?[e.record]:[]);
 const saleLines=records.flatMap(e=>e.collection==='lines'&&'copyId' in e.record?[e.record]:[]);
 const audits=records.flatMap(e=>e.collection==='revisions'?[e.record]:[]);
 const data:HistoryData={ownerUid:input.owner,copies,transactions,saleLines,catalog:input.catalog,inTransit:[]};selectHistory(data);
 const currency=input.currency,today=day(input.asOf),convert=referenceConverter(input.fx);
 const prices=new Map<string,PriceSeries>();
 const histories=new Map<string,Map<string,number>>();
 for(const price of input.prices){
  const key=seriesKey(price.catalog,price.condition);
  if(prices.has(key))throw Error('Duplicate performance series');
  const dates=new Set<string>();
  for(const p of price.history){dateSchema.parse(p.date);if(dates.has(p.date)||!Number.isSafeInteger(p.minor)||p.minor<0)throw Error('Invalid price history');dates.add(p.date);}
  if(price.current&&(!Number.isSafeInteger(price.current.minor)||price.current.minor<0||!Number.isFinite(Date.parse(price.current.observedAt))||Date.parse(price.current.observedAt)>Date.parse(input.asOf)))throw Error('Invalid current quote');
  prices.set(key,price);
  histories.set(key,new Map(price.history.map(p=>[p.date,p.minor])));
 }
 const series=(copy:CardCopy)=>copy.condition.status==='known'?prices.get(seriesKey(copy.catalog,copy.condition.value)):undefined;
 const acquired=(copy:CardCopy)=>copy.acquiredOn.status==='known'?copy.acquiredOn.value:null;
 const basis=(copy:CardCopy)=>acquisitionBasis(copyCosts(copy),acquired(copy),currency,convert);
 const quote=(copy:CardCopy,date:string,current=false,fxDate=date):Metric=>{
  const source=series(copy),minor=current?source?.current?.minor:copy.condition.status==='known'?histories.get(seriesKey(copy.catalog,copy.condition.value))?.get(date):undefined;
  if(minor===undefined||!source)return unavailable('Matching market observation unavailable');
  const converted=convert({currency:source.currency,minor},currency,fxDate);
  return converted.status==='unavailable'?converted:{...converted,status:'estimated'};
 };
 const held=copies.filter(c=>c.possession==='received'&&c.disposition==='held');
 const holdings=held.map(copy=>({copy,market:quote(copy,today,true),basis:basis(copy),stale:series(copy)?.stale??false}));
 const value=sum(holdings.map(h=>h.market),currency),knownCost=sum(holdings.map(h=>h.basis),currency);
 const unrealized=sum(holdings.map(h=>subtract(h.market,h.basis)),currency);
 const matchedBasis=sum(holdings.filter(h=>h.market.status!=='unavailable'&&h.basis.status!=='unavailable').map(h=>h.basis),currency);
 const roi=matchedBasis.minor&&unrealized.minor!==null?unrealized.minor/matchedBasis.minor*100:null;
 const activeSales=transactions.filter(t=>t.kind==='sale'&&!t.reversedAt);
 // Use the same audited sale membership and dated FX for all three numbers:
 // net proceeds, frozen acquisition basis, and their difference.
 const saleFigures=activeSales.map(sale=>{
  const lines=saleLines.filter(l=>l.transactionId===sale.id);
  const validMembership=lines.length>0&&(!sale.copyIds||(lines.length===sale.copyIds.length&&lines.every(l=>sale.copyIds!.includes(l.copyId))));
  const costs=validMembership?lines.map(line=>{
   const copy=copies.find(c=>c.id===line.copyId);
   return copy&&line.basisCosts?acquisitionBasis(line.basisCosts,acquired(copy),currency,convert):unavailable('Frozen sale basis unavailable');
  }):[];
  const basisTotal=validMembership&&costs.every(c=>c.status!=='unavailable')?sum(costs,currency):null;
  const basis:Metric=basisTotal?.minor!==null&&basisTotal!==null
   ?{status:basisTotal.estimated?'estimated':'exact',currency,minor:basisTotal.minor}
   :unavailable('Incomplete sale basis');
  const net=netSaleProceeds(sale);
  const proceeds=validMembership?(net.status==='unavailable'?net:convert(net,currency,sale.transactionOn)):unavailable('Incomplete sale membership');
  return {basis,proceeds,profit:subtract(proceeds,basis)};
 });
 const realized=sum(saleFigures.map(s=>s.profit),currency);
 const realizedProceeds=sum(saleFigures.map(s=>s.proceeds),currency);
 const soldCostBasis=sum(saleFigures.map(s=>s.basis),currency);
 const timeline=copies.map(copy=>copyTimeline(copy,audits));
 const start=copies.length?[...copies.map(c=>day(c.createdAt)),today].sort()[0]!:today;
 const from=start>previousDay(today,365)?start:previousDay(today,365);
 const points:PerformancePoint[]=[];let previous=new Map<string,{copy:CardCopy;market:Metric}>();
 for(let date=from;copies.length&&date<=today;date=previousDay(date,-1)){
  const states=timeline.map(t=>t.at(date));
  const current=new Map(states.flatMap(s=>s.copy&&s.copy.possession==='received'&&s.copy.disposition==='held'?[[s.copy.id,{copy:s.copy,market:quote(s.copy,date)}] as const]:[]));
  const matches=[...current].flatMap(([id,v])=>{
   const prev=previous.get(id);
   if(!prev||catalogIdentity(prev.copy.catalog)!==catalogIdentity(v.copy.catalog)||prev.copy.condition.status!=='known'||v.copy.condition.status!=='known'||prev.copy.condition.value!==v.copy.condition.value)return [];
   // Constant display FX on both observations isolates actual market-price change.
   const before=quote(prev.copy,previousDay(date),false,today),after=quote(v.copy,date,false,today);
   return before.status!=='unavailable'&&after.status!=='unavailable'?[{before:before.minor,after:after.minor}]:[];
  });
  const before=matches.reduce((n,m)=>n+BigInt(m.before),0n),after=matches.reduce((n,m)=>n+BigInt(m.after),0n);
  points.push({date,value:sum([...current.values()].map(v=>v.market),currency),held:current.size,unknownHistory:states.filter(s=>s.unknown).length,matchedChange:before>0n?Number(after-before)/Number(before)*100:null,matchedCount:matches.length});
  previous=current;
 }
 const month=input.month??today.slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Invalid reporting month');
 const purchases=transactions.filter(t=>t.kind==='purchase');
 const purchaseDate=(p:typeof purchases[number])=>'origin' in p?p.transactionOn.status==='known'?p.transactionOn.value:null:p.transactionOn;
 const monthPurchases=purchases.filter(p=>purchaseDate(p)?.slice(0,7)===month);
 const spend=sum(monthPurchases.map(p=>{
  const payable='origin' in p?p.payable.status==='known'?p.payable.value:null:p.payable;
  return payable?convert(payable,currency,purchaseDate(p)):unavailable('Unknown purchase amount');
 }),currency);
 const monthCopyCount=copies.filter(c=>c.acquisition.kind==='purchase'&&monthPurchases.some(p=>p.id===(c.acquisition.kind==='purchase'?c.acquisition.transactionId:null))).length;
 const recent=copies.filter(c=>c.acquisition.kind==='purchase'&&purchases.some(p=>p.id===(c.acquisition.kind==='purchase'?c.acquisition.transactionId:null))).sort((a,b)=>(acquired(b)??'').localeCompare(acquired(a)??'')||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)).slice(0,3).map(copy=>({copy,paid:copy.cardCost.status==='exact'||copy.cardCost.status==='estimated'?convert(copy.cardCost.value,currency,acquired(copy)):unavailable('Unknown acquisition cost')}));
 const top=holdings.filter(h=>h.market.status!=='unavailable').sort((a,b)=>(b.market.status==='unavailable'?0:b.market.minor)-(a.market.status==='unavailable'?0:a.market.minor)||a.copy.id.localeCompare(b.copy.id)).slice(0,3);
 return {value,knownCost,unrealized,realized,realizedProceeds,soldCostBasis,roi,holdings,points,recent,top,month:{month,spend,copies:monthCopyCount,undatedPurchases:purchases.filter(p=>purchaseDate(p)===null).length},pending:copies.filter(c=>c.possession==='pending'&&c.disposition==='held').length,stale:holdings.some(h=>h.stale),historicalFrom:points[0]?.date??null};
}
