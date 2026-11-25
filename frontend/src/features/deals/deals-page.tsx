import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LuSearch, LuSlidersHorizontal, LuListFilter, LuChevronLeft, LuChevronRight, LuExternalLink, LuClock, LuCircleCheck } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { useWishlist } from '@/features/wishlist/use-wishlist';
import { useAuth } from '@/hooks/use-auth';
import { catalogCards, catalogMarketReference } from '@/features/catalog/catalog';
import { fetchMarketQuotes } from '@/features/catalog/market-prices';
import { publicPriceClient } from '@/services/public-price-client';
import { catalogIdentity } from '@/domain/inventory';
import { currencySchema, type CatalogRef } from '@/domain/schema';
import { useDisplayCurrency, useDisplayMoney } from '@/services/display-currency';
import { getEnvironment } from '@/services/environment';
import { readAnalysis, runAnalysis, saveAnalysis, type AnalysisResult, type Source } from '@/features/analyze/analysis-service';
import { z } from 'zod';
import { dealCards, dealsClient, fetchBatch, gradeSchema, newScan, runScan, type DealCard, type DealItem, type Grade, type ScanState } from './scan';
import { readExclusions, saveExclusions, selectedIds } from './scope';
import { compareRecommended, evaluate } from './ranking';
import { readScanCache, writeScanCache, scanCacheKey, scanClock } from './cache';

const catalog=new Map(catalogCards.map(card=>[card.id,card]));
const emptyFilters={format:'all',end:'all',shipMax:'all',totalMax:'all',discountMin:'all',condition:'all',grades:[] as Grade[],known:false,review:true,sets:[] as string[],keyword:''};
const fieldClass='min-h-11 min-w-0 w-full rounded-lg border border-blue-200 bg-white px-2 text-base';
function stored(owner:string){try{return readExclusions(localStorage,owner);}catch{return [];}}
function postalKey(owner:string){return 'pokefolio-deals-postal-v1:'+owner;}
function storedPostal(owner:string){try{return localStorage.getItem(postalKey(owner))??'';}catch{return '';}}
function ScopePicker({ids,excluded,onDone,onClose}:{ids:readonly string[];excluded:readonly string[];onDone:(ids:string[])=>void;onClose:()=>void}){
 const {t}=useTranslation();
 const [skip,setSkip]=useState(()=>new Set(excluded));
 const [search,setSearch]=useState('');
 const visible=ids.filter(id=>{const c=catalog.get(id);return !!c&&[c.name,c.setName,c.number].join(' ').toLowerCase().includes(search.trim().toLowerCase());});
 return <UtilitySheet title={t('dealsUi.select')} onClose={onClose}><div className="space-y-2">
  <div className="sticky top-0 z-10 space-y-2 bg-blue-50 pb-2">
   <SearchInput label={t('dealsUi.search')} placeholder={t('dealsUi.search')} value={search} onChange={e=>setSearch(e.target.value)} />
   <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setSkip(new Set())}>{t('dealsUi.selectAll')}</Button><Button variant="outline" onClick={()=>setSkip(new Set(ids))}>{t('dealsUi.clear')}</Button></div>
   <Button className="w-full" onClick={()=>onDone([...skip])}>{t('dealsUi.done')} · {t('dealsUi.selected',{count:ids.filter(id=>!skip.has(id)).length,total:ids.length})}</Button>
  </div>
  {visible.map(id=>{const card=catalog.get(id)!;return <label key={id} className="flex min-h-14 items-center gap-2 rounded-xl border border-blue-100 bg-white p-2"><PokemonArt src={card.imageUrl} alt={card.name}/><span className="min-w-0 flex-1"><span className="block font-bold">{card.name}</span><span className="block text-xs text-slate-600">{card.setName} · #{card.number}</span></span><input type="checkbox" className="size-5 shrink-0 accent-blue-600" checked={!skip.has(id)} onChange={e=>setSkip(previous=>{const next=new Set(previous);if(e.target.checked)next.delete(id);else next.add(id);return next;})}/></label>;})}
 </div></UtilitySheet>;
}
export function DealsPage(){
 const wish=useWishlist();const {t}=useTranslation();const [params]=useSearchParams();
 if(params.get('wishlist')==='sample')return <p className="p-3 text-sm">{t('dealsUi.sampleUnavailable')}</p>;
 if(wish.loading)return <p role="status">{t('loading')}</p>;
 if(wish.error)return <div role="alert"><p>{t('wishlistUi.loadFailed')}</p><Button onClick={wish.retry}>{t('reload')}</Button></div>;
 if(!wish.owner)return <p className="p-3 text-sm">{t('dealsUi.signIn')}</p>;
 return <DealsPanel key={wish.owner+':'+wish.wishlist.cardIds.join(',')} owner={wish.owner} ids={wish.wishlist.cardIds}/>;
}
export function SingleCardDeals({cardId,reference}:{cardId:string;reference:CatalogRef}){
 const auth=useAuth();const {t}=useTranslation();
 if(auth.status==='loading')return <p role="status">{t('loading')}</p>;
 if(!auth.user)return <p>{t('dealsUi.signIn')}</p>;
 return <DealsPanel key={auth.user.uid+':'+cardId+':'+catalogIdentity(reference)} owner={auth.user.uid} ids={[cardId]} reference={reference} autoStart/>;
}
const detailSchema=z.object({grade:gradeSchema.nullable(),source:z.enum(['seller','unknown']),label:z.string().nullable(),verificationStatus:z.enum(['strong','review','rejected','unknown']),verificationReasons:z.array(z.string()),matchConfidence:z.number()});
type Detail=z.infer<typeof detailSchema>;
const imageSchema=z.object({images:z.array(z.string().url().refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.hostname==='i.ebayimg.com';})).max(25)});
function ListingGallery({owner,item,onClose,onGrade}:{owner:string;item:DealItem;onClose:()=>void;onGrade:(grade:Grade,confidence:number)=>void}){
 const {t}=useTranslation();
 const [index,setIndex]=useState(0);
 const source:Source={type:'ebay-listing',marketplace:item.marketplace,itemId:item.itemId};
 const key=['deals-images',owner,item.marketplace,item.itemId];
 const photos=useQuery({queryKey:key,queryFn:async({signal})=>imageSchema.parse((await dealsClient(owner).post('/api/item-images',{itemId:item.itemId,marketplace:item.marketplace},{signal})).data).images,staleTime:30*60_000,retry:false});
 const saved=useQuery({queryKey:['deals-analysis',owner,item.marketplace,item.itemId],queryFn:()=>readAnalysis(owner,source),retry:false,staleTime:60_000});
 const [result,setResult]=useState<AnalysisResult|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const request=useRef<AbortController|null>(null);
 const touch=useRef<number|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 const images=photos.data??(item.image?[item.image]:[]);
 const analysis=result??saved.data;
 const step=(direction:number)=>setIndex(v=>(v+direction+images.length)%Math.max(1,images.length));
 async function analyze(){
  if(request.current)return;
  const abort=new AbortController();request.current=abort;setBusy(true);setError('');
  try{const value=await runAnalysis(owner,source,abort.signal);if(abort.signal.aborted)return;setResult(value);onGrade(value.analysis.grade,value.analysis.confidencePercent);
   try{await saveAnalysis(owner,source,value);}catch{if(!abort.signal.aborted)setError(t('dealsUi.analysisSaveFailed'));}
  }catch{if(!abort.signal.aborted)setError(t('dealsUi.analyzeFailed'));}
  finally{if(!abort.signal.aborted){request.current=null;setBusy(false);}}
 }
 return <UtilitySheet title={t('dealsUi.photos')} onClose={onClose}><div className="space-y-3" onKeyDown={e=>{if(e.key==='ArrowLeft')step(-1);if(e.key==='ArrowRight')step(1);}}>
  <p className="text-sm font-bold">{item.title}</p>
  {images[index]&&<div className="relative flex min-h-56 items-center justify-center bg-white" onTouchStart={e=>{touch.current=e.touches[0]?.clientX??null;}} onTouchEnd={e=>{const x=e.changedTouches[0]?.clientX;if(x!==undefined&&touch.current!==null&&Math.abs(x-touch.current)>35)step(x<touch.current?1:-1);touch.current=null;}}><img className="max-h-[48dvh] max-w-full object-contain" src={images[index]} alt={item.title}/>{images.length>1&&<><button className="absolute start-1 rounded-full bg-white p-2" aria-label={t('dealsUi.prev')} onClick={()=>step(-1)}><LuChevronLeft/></button><button className="absolute end-1 rounded-full bg-white p-2" aria-label={t('dealsUi.next')} onClick={()=>step(1)}><LuChevronRight/></button></>}</div>}
  {photos.isPending&&<p role="status">{t('loading')}</p>}{photos.isError&&<p role="alert">{t('dealsUi.photoFailed')}</p>}
  <div className="flex gap-1 overflow-x-auto">{images.map((image,i)=><button key={image} className={`shrink-0 rounded border p-1 ${index===i?'border-blue-600':'border-blue-100'}`} aria-label={`${t('dealsUi.photos')} ${i+1}`} onClick={()=>setIndex(i)}><img src={image} loading="lazy" className="size-14 object-contain" alt=""/></button>)}</div>
  <Button className="w-full" disabled={busy} onClick={()=>void analyze()}>{t(busy?'dealsUi.analyzing':analysis?'dealsUi.analyzeAgain':'dealsUi.analyze')}</Button>
  {analysis&&<div className="rounded-xl border border-blue-200 bg-white p-3">{!result&&<p className="text-xs text-slate-600">{t('dealsUi.cachedAnalysis')}</p>}<p className="font-bold">{t('dealsUi.analysis')} · {analysis.analysis.grade} · {analysis.analysis.confidencePercent}%</p>{analysis.analysis.observations.map((o,i)=><p key={i} className="text-sm">{o.finding}</p>)}{analysis.analysis.limitations.map((o,i)=><p key={i} className="text-xs text-slate-600">{o}</p>)}</div>}
  {error&&<p role="alert">{error}</p>}
  <Button asChild variant="outline" className="w-full"><a href={item.url} target="_blank" rel="noopener noreferrer">{t('dealsUi.open')}</a></Button>
 </div></UtilitySheet>;
}
function DealsPanel({owner,ids,reference,autoStart=false}:{owner:string;ids:readonly string[];reference?:CatalogRef;autoStart?:boolean}){
 const {t,i18n}=useTranslation();
 const money=useDisplayMoney(0),display=useDisplayCurrency();
 const [excluded,setExcluded]=useState(()=>stored(owner)),[picker,setPicker]=useState(false),[storageError,setStorageError]=useState(false);
 const [postal,setPostal]=useState(()=>storedPostal(owner));
 const [filters,setFilters]=useState(emptyFilters),[filterOpen,setFilterOpen]=useState(false),[sort,setSort]=useState('recommended');
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60_000);return()=>clearInterval(timer);},[]);
 const cards=dealCards(reference?ids:selectedIds(ids,excluded)).map(c=>{
   if(!reference||reference.kind!=='identified')return c;
   const finish=reference.finish.status==='known'?reference.finish.value:null;
   return {...c,firstEdition:reference.edition==='first-edition',finish:finish==='holo'||finish==='normal'||finish==='shining'?finish:null} satisfies DealCard;
 });
 const cacheKey=scanCacheKey(owner,reference?'card':'wishlist',cards,postal);
 const [cached]=useState(()=>readScanCache(cacheKey,now));
 const [completedAt,setCompletedAt]=useState(cached?.completedAt??0);
 const [scan,setScan]=useState<ScanState|null>(cached?.scan??null),[busy,setBusy]=useState(false),[failure,setFailure]=useState(false),[limit,setLimit]=useState(40);
 const [overrides,setOverrides]=useState<Record<string,Grade>>(cached?.overrides??{}),[aiGrades,setAiGrades]=useState<Record<string,{grade:Grade;confidence:number}>>(cached?.aiGrades??{}),[details,setDetails]=useState<Record<string,Detail>>(cached?.details??{});
 const [checking,setChecking]=useState<string[]>([]),[checkFailed,setCheckFailed]=useState<string[]>([]);
 const [gallery,setGallery]=useState<DealItem|null>(null);
 const active=useRef<AbortController|null>(null),detailRequests=useRef(new Set<AbortController>());
 useEffect(()=>{const requests=detailRequests.current;return()=>{active.current?.abort();for(const controller of requests)controller.abort();};},[]);
 const [stableOrder,setStableOrder]=useState<string[]|null>(null);
 useEffect(()=>{if(scan&&completedAt&&!busy)writeScanCache(cacheKey,{scan,completedAt,details,overrides,aiGrades});},[cacheKey,scan,completedAt,busy,details,overrides,aiGrades]);
 const cardIndex=new Map((scan?.cards??cards).map(c=>[c.id,c]));
 const priceRefs=(scan?.cards??[]).map(c=>{const ref=reference??catalogMarketReference(c.id);return {card:catalog.get(c.id)!,ref};});
 const quotes=useQueries({queries:priceRefs.map(({card,ref})=>({queryKey:['market',catalogIdentity(ref)],queryFn:({signal}:{signal:AbortSignal})=>fetchMarketQuotes(card,ref,signal),staleTime:900_000,retry:1}))},publicPriceClient);
 const quoteMap=new Map(priceRefs.map(({card},i)=>[card.id,quotes[i]?.data??[]]));
 const convert=(value:DealItem['shipping'])=>{
  if(!value)return null;const currency=currencySchema.safeParse(value.currency);if(!currency.success)return null;
  const minor=Math.round(value.value*100);return display?display.convert(minor,currency.data):currency.data==='USD'?minor:null;
 };
 const formatted=(value:DealItem['shipping'])=>{if(!value)return '—';const currency=currencySchema.safeParse(value.currency);if(!currency.success||convert(value)===null)return new Intl.NumberFormat(i18n.language,{style:'currency',currency:value.currency}).format(value.value);return money({minor:Math.round(value.value*100),currency:currency.data});};
 const amount=(value:number|null)=>value===null?'—':new Intl.NumberFormat(i18n.language,{style:'currency',currency:display?.currency??'USD',maximumFractionDigits:0}).format(value/100);
 const usdLimit=(value:string)=>convert({value:Number(value),currency:'USD'});
 const postalValid=!postal||/^\d{7}$/.test(postal);
 const unavailable=!getEnvironment()?.workerUrl;
 async function start(resume=false){
  if(active.current||!postalValid||unavailable||(!resume&&!cards.length))return;
  const state=resume?scan:newScan(cards);if(!state)return;
  const controller=new AbortController();active.current=controller;setBusy(true);setFailure(false);setScan(state);
  if(!resume){setCompletedAt(0);setStableOrder(null);for(const request of detailRequests.current)request.abort();detailRequests.current.clear();setDetails({});setChecking([]);setCheckFailed([]);setOverrides({});setAiGrades({});setLimit(40);}
  try{const complete=await runScan(state,(batch,signal)=>fetchBatch(owner,batch,signal,postal||undefined),controller.signal,setScan);
   if(!complete.throttled&&complete.searched===complete.cards.length){
    const candidates=complete.items.filter(item=>(!resume||!details[item.itemId])&&(item.verificationStatus==='review'||item.conditionSource!=='seller')).sort((a,b)=>Number(a.verificationStatus!=='review')-Number(b.verificationStatus!=='review')||b.matchConfidence-a.matchConfidence).slice(0,18);
    for(const item of candidates){controller.signal.throwIfAborted();const card=complete.cards.find(c=>c.id===item.cardId);if(!card)continue;
     try{const value=detailSchema.parse((await dealsClient(owner).post('/api/item-condition',{itemId:item.itemId,marketplace:item.marketplace,card,...(postal?{postalCode:postal}:{})},{signal:controller.signal})).data);controller.signal.throwIfAborted();setDetails(v=>({...v,[item.itemId]:value}));}catch{if(controller.signal.aborted)break;}
    }
    if(!controller.signal.aborted)setCompletedAt(scanClock());
   }
  }
  catch{if(!controller.signal.aborted)setFailure(true);}
  finally{if(active.current===controller){active.current=null;setBusy(false);}}
 }
 // Single-card entry is an explicit user action. Defer until effect setup settles
 // so StrictMode's setup/cleanup replay cannot issue duplicate marketplace requests.
 const startOnEntry=useEffectEvent(()=>{void start();});
 useEffect(()=>{
  if(!autoStart)return;
  const timer=setTimeout(()=>startOnEntry(),0);
  return ()=>clearTimeout(timer);
 },[autoStart]);
 function pause(){active.current?.abort();}
 function resetResults(){setCompletedAt(0);setStableOrder(null);for(const controller of detailRequests.current)controller.abort();detailRequests.current.clear();setScan(null);setDetails({});setChecking([]);setCheckFailed([]);setOverrides({});setAiGrades({});}
 function saveScope(next:string[]){setExcluded(next);try{setStorageError(!saveExclusions(localStorage,owner,next));}catch{setStorageError(true);}setPicker(false);resetResults();}
 function filter<K extends keyof typeof emptyFilters>(key:K,value:(typeof emptyFilters)[K]){setFilters(v=>({...v,[key]:value}));setStableOrder(null);setLimit(40);}
 async function check(item:DealItem){
  const card=cardIndex.get(item.cardId);if(!card||checking.includes(item.itemId))return;
  const controller=new AbortController();detailRequests.current.add(controller);setChecking(v=>[...v,item.itemId]);setCheckFailed(v=>v.filter(id=>id!==item.itemId));
  try{const value=detailSchema.parse((await dealsClient(owner).post('/api/item-condition',{itemId:item.itemId,marketplace:item.marketplace,card,...(postal?{postalCode:postal}:{})},{signal:controller.signal})).data);if(!controller.signal.aborted)setDetails(v=>({...v,[item.itemId]:value}));}
  catch{if(!controller.signal.aborted)setCheckFailed(v=>[...v,item.itemId]);}
  finally{detailRequests.current.delete(controller);if(!controller.signal.aborted)setChecking(v=>v.filter(id=>id!==item.itemId));}
 }
 const rows=(scan?.items??[]).flatMap(raw=>{
  const detail=details[raw.itemId];if(detail?.verificationStatus==='rejected')return [];
  const item:DealItem=detail?{...raw,conditionGrade:detail.grade??raw.conditionGrade,conditionSource:detail.grade?'seller':raw.conditionSource,verificationStatus:detail.verificationStatus==='strong'?'strong':detail.verificationStatus==='review'?'review':raw.verificationStatus,matchConfidence:detail.matchConfidence||raw.matchConfidence}:raw;
  const grade=overrides[item.itemId]??aiGrades[item.itemId]?.grade??item.conditionGrade??'MP';
  const q=(quoteMap.get(item.cardId)??[]).filter(q=>q.condition===(grade==='DMG'?'DAMAGED':grade));
  const latest=Math.max(...q.map(v=>Date.parse(v.observedAt)));const latestQuotes=q.filter(v=>Date.parse(v.observedAt)===latest);const first=latestQuotes[0]?.money;const market=first&&latestQuotes.every(v=>v.money.minor===first.minor)?(display?display.convert(first.minor,first.currency):first.minor):null;
  const shipping=convert(item.shipping),evaluation=evaluate(item,market,convert(item.currentBid),shipping,now,overrides[item.itemId],aiGrades[item.itemId]);
  return [{item,evaluation,shipping}];
 }).filter(({item,evaluation:e,shipping})=>{
  if(!filters.review&&item.verificationStatus!=='strong')return false;
  if(filters.format!=='all'&&item.format!==filters.format)return false;
  if(filters.end!=='all'&&item.format==='AUCTION'&&(e.hours===null||e.hours<0||e.hours>Number(filters.end)))return false;
  if(filters.known&&shipping===null)return false;
  const maxShip=usdLimit(filters.shipMax),maxTotal=usdLimit(filters.totalMax);
  if(filters.shipMax!=='all'&&(shipping!==null&&(maxShip===null||shipping>maxShip)))return false;
  if(filters.totalMax!=='all'&&(e.allIn===null||maxTotal===null||e.allIn>maxTotal))return false;
  if(filters.discountMin!=='all'&&(e.discount===null||e.discount*100<Number(filters.discountMin)))return false;
  if(filters.condition!=='all'&&(!item.conditionGrade||gradeSchema.options.indexOf(item.conditionGrade)>gradeSchema.options.indexOf(filters.condition as Grade)))return false;
  if(filters.grades.length&&(!item.conditionGrade||!filters.grades.includes(item.conditionGrade)))return false;
  if(filters.sets.length&&!filters.sets.includes(cardIndex.get(item.cardId)?.setName??''))return false;
  return !filters.keyword.toLowerCase().split(',').map(v=>v.trim()).filter(Boolean).some(v=>item.title.toLowerCase().includes(v));
 });
 rows.sort((a,b)=>{
  const trust=Number(a.item.verificationStatus!=='strong')-Number(b.item.verificationStatus!=='strong');if(trust)return trust;
  if(sort==='discount')return (b.evaluation.discount??-Infinity)-(a.evaluation.discount??-Infinity)||0;
  if(sort==='closing')return (a.evaluation.hours??Infinity)-(b.evaluation.hours??Infinity)||0;
  if(sort==='bids')return (a.item.bidCount??Infinity)-(b.item.bidCount??Infinity)||0;
  if(sort==='match')return b.item.matchConfidence-a.item.matchConfidence;
  if(sort==='shipping'||sort==='shippingDesc'){if(a.shipping===null)return b.shipping===null?0:1;if(b.shipping===null)return -1;return (a.shipping-b.shipping)*(sort==='shipping'?1:-1);}
  return compareRecommended(a.evaluation,b.evaluation)||b.item.matchConfidence-a.item.matchConfidence;
 });
 if(stableOrder){const positions=new Map(stableOrder.map((id,i)=>[id,i]));rows.sort((a,b)=>(positions.get(a.item.itemId)??Infinity)-(positions.get(b.item.itemId)??Infinity)||0);}
 const selectFilter=(key:'format'|'end'|'shipMax'|'totalMax'|'discountMin'|'condition',options:string[],label:string)=> <label className="min-w-0 space-y-1 text-xs font-semibold">{t('dealsUi.'+label)}<Select className="w-full text-base" value={filters[key]} onChange={e=>filter(key,e.target.value)}><option value="all">{t('dealsUi.all')}</option>{options.map(value=><option key={value} value={value}>{key==='format'?t(value==='AUCTION'?'dealsUi.auction':'dealsUi.fixed'):key==='shipMax'||key==='totalMax'?money({minor:Number(value)*100,currency:'USD'}):value}</option>)}</Select></label>;
 const canResume=!!scan&&scan.searched<scan.cards.length;
 const scanComplete=!!scan&&!busy&&!canResume&&!scan.throttled&&!failure&&completedAt>0&&scan.errors.length===0;
 const invalidListings=scan?.errors.filter(error=>error.invalidFields!==undefined)??[];
 const marketplaceFailures=(scan?.errors.length??0)-invalidListings.length;
 const invalidFields=[...new Set(invalidListings.flatMap(error=>error.invalidFields??[]))].join(', ');
 const compactAction='min-h-[34px] min-w-0 rounded-lg px-3 py-1 text-xs font-bold leading-tight';
 const scanButton=<Button className={compactAction+' shrink-0 gap-1.5'} disabled={busy||!cards.length||!postalValid||unavailable} onClick={()=>void start()}><LuSearch aria-hidden className="size-3.5 shrink-0"/>{t(scan?'dealsUi.again':'dealsUi.find')}</Button>;
 return <section className="min-w-0 space-y-2" aria-label={t('inventory.findDeals')}>
  <div className="space-y-2 rounded-2xl border border-blue-100 bg-white p-2.5 shadow-[0_3px_10px_#174b9310]">
   <div className="flex items-center justify-between gap-2">
    <div className="min-w-0 flex-1"><p className="break-words text-base font-bold leading-tight">{reference?cards[0]?.name:t('dealsUi.scope')}</p><p className="mt-0.5 text-xs leading-tight text-slate-600">{reference?cards[0]?.setName:t('dealsUi.selected',{count:cards.length,total:ids.length})}</p></div>
    <div className="flex shrink-0 items-center gap-1.5">
     {!reference&&<Button variant="outline" className="size-[34px] min-h-[34px] shrink-0 rounded-lg p-0" disabled={busy} onClick={()=>setPicker(true)} aria-label={t('dealsUi.select')} title={t('dealsUi.select')}><LuListFilter aria-hidden className="size-4 shrink-0"/></Button>}
     {scanButton}
    </div>
   </div>
   {unavailable&&<p role="alert" className="text-xs">{t('dealsUi.notConfigured')}</p>}
   {storageError&&<p role="alert" className="text-xs">{t('dealsUi.storage')}</p>}
   {scan&&<div className="space-y-2 border-t border-slate-200 pt-2">
    {busy&&<progress className="deals-scan-progress block h-1.5 w-full" value={scan.searched} max={Math.max(scan.cards.length,1)} aria-label={t('dealsUi.progress',{searched:scan.searched,total:scan.cards.length})}/>}
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] leading-tight text-slate-600">
     <p role="status" className={`flex min-w-0 items-center gap-1 ${scanComplete?'font-semibold text-emerald-700':''}`}>{scanComplete&&<LuCircleCheck aria-hidden className="size-3.5 shrink-0"/>}{t('dealsUi.progress',{searched:scan.searched,total:scan.cards.length})}</p>
     {completedAt>0&&<p className="ms-auto text-end">{t('dealsUi.cached')}: {new Date(completedAt).toLocaleTimeString(i18n.language,{hour:'numeric',minute:'2-digit'})}</p>}
    </div>
    {completedAt>0&&now-completedAt>30*60_000&&<p className="text-xs text-slate-600">{t('dealsUi.stale')}</p>}
    {(busy||canResume)&&<Button variant="outline" className={compactAction} onClick={()=>busy?pause():void start(true)}>{t(busy?'dealsUi.pause':'dealsUi.resume')}</Button>}
    {marketplaceFailures>0&&<p role="status" className="text-xs">{t('dealsUi.partial',{count:marketplaceFailures})}</p>}
    {invalidListings.length>0&&<p role="status" className="break-words text-xs">{t('dealsUi.invalidListings',{count:invalidListings.length})}{invalidFields&&<> · <bdi>{invalidFields}</bdi></>}</p>}
    {scan.throttled&&<p role="alert" className="text-xs">{t('dealsUi.rate')}</p>}
    {failure&&<p role="alert" className="text-xs">{t('dealsUi.failed')}</p>}
   </div>}
  </div>
  <div className="flex gap-2"><Select className="min-h-[34px] min-w-0 flex-1 rounded-lg bg-white px-2 py-0.5 text-base" aria-label={t('inventory.sort')} value={sort} onChange={e=>{setSort(e.target.value);setStableOrder(null);setLimit(40);}}>{['recommended','discount','closing','bids','match','shipping','shippingDesc'].map(value=><option key={value} value={value}>{t('dealsUi.'+value)}</option>)}</Select><Button variant="outline" className={compactAction+' shrink-0 gap-1.5'} aria-expanded={filterOpen} onClick={()=>setFilterOpen(v=>!v)}><LuSlidersHorizontal aria-hidden className="size-3.5 shrink-0"/>{t('dealsUi.filters')}</Button></div>
  {filterOpen&&<div className="space-y-3 rounded-xl border border-blue-200 bg-white p-3">
   <div className="grid grid-cols-2 gap-2">{selectFilter('format',['AUCTION','FIXED_PRICE'],'format')}{selectFilter('end',['1','6','24','72','168'],'end')}{selectFilter('shipMax',['0','5','10','15','25','50'],'shipMax')}{selectFilter('totalMax',['25','50','100','200','500'],'totalMax')}{selectFilter('discountMin',['10','20','30','40','50'],'discountMin')}{selectFilter('condition',[...gradeSchema.options],'condition')}</div>
   <label className="block text-xs font-semibold">{t('dealsUi.postal')}<input className={fieldClass} inputMode="numeric" maxLength={7} value={postal} disabled={busy||canResume} onChange={e=>{const v=e.target.value;setPostal(v);resetResults();if(!v||/^\d{7}$/.test(v))try{localStorage.setItem(postalKey(owner),v);}catch{/* optional cache */}}}/></label>{!postalValid&&<p role="alert">{t('dealsUi.invalidPostal')}</p>}
   <label className="block text-xs font-semibold">{t('dealsUi.keyword')}<input className={fieldClass} value={filters.keyword} onChange={e=>filter('keyword',e.target.value)}/></label>
   <details><summary className="text-sm font-semibold">{t('dealsUi.set')}</summary><div className="grid grid-cols-2 gap-2">{[...new Set(cards.map(c=>c.setName))].map(set=><label key={set} className="flex gap-1 text-xs"><input type="checkbox" checked={filters.sets.includes(set)} onChange={e=>filter('sets',e.target.checked?[...filters.sets,set]:filters.sets.filter(s=>s!==set))}/>{set}</label>)}</div></details>
   <details><summary className="text-sm font-semibold">{t('dealsUi.grades')}</summary><div className="flex flex-wrap gap-3">{gradeSchema.options.map(grade=><label key={grade} className="flex gap-1 text-sm"><input type="checkbox" checked={filters.grades.includes(grade)} onChange={e=>filter('grades',e.target.checked?[...filters.grades,grade]:filters.grades.filter(g=>g!==grade))}/>{grade}</label>)}</div></details>
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={filters.known} onChange={e=>filter('known',e.target.checked)}/>{t('dealsUi.known')}</label>
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={filters.review} onChange={e=>filter('review',e.target.checked)}/>{t('dealsUi.review')}</label>
   <Button variant="outline" onClick={()=>{setFilters(emptyFilters);setStableOrder(null);setLimit(40);}}>{t('dealsUi.reset')}</Button>
  </div>}
  {!scan?<div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-500"><LuSearch className="size-9"/>{t(cards.length?'dealsUi.ready':'dealsUi.noCards')}</div>:<>
   <p className="px-0.5 text-xs font-bold text-slate-600">{t('dealsUi.results',{count:rows.length})}</p>
   {!rows.length&&!busy&&<p className="py-6 text-center text-sm">{t('dealsUi.none')}</p>}
   {rows.slice(0,limit).map(({item,evaluation:e})=>{
    const minutes=e.hours===null?null:Math.max(1,Math.ceil(e.hours*60));
    const countdown=e.hours===null?null:e.hours<=0?t('dealsUi.expired'):minutes!==null?t(minutes<60?'dealsUi.endsMinutes':'dealsUi.endsHours',{hours:Math.floor(minutes/60),minutes:minutes%60}):null;
    return <article key={item.itemId} className="min-w-0 space-y-2 rounded-2xl border border-blue-100 bg-white p-2.5 shadow-[0_3px_10px_#174b9310]">
     <div className="grid grid-cols-[clamp(3rem,17vw,4.125rem)_minmax(0,1fr)_minmax(0,auto)] items-start gap-2">
      <button type="button" className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600" onClick={()=>setGallery(item)} aria-label={t('dealsUi.photos')}>
       {item.image?<img src={item.image} loading="lazy" className="h-full w-full object-contain" alt={item.title}/>:<LuSearch className="m-auto h-full w-6"/>}
      </button>
      <div className="min-w-0 space-y-1">
       <div className="flex flex-wrap gap-1 text-[10px] font-bold leading-tight">
        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-blue-700">{t(item.format==='AUCTION'?'dealsUi.auction':'dealsUi.fixed')}</span>
        <span className={`rounded-md px-1.5 py-0.5 ${item.verificationStatus==='strong'?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-800'}`}>{t(item.verificationStatus==='strong'?'dealsUi.strong':'dealsUi.needsReview')}</span>
       </div>
       <p className="line-clamp-2 break-words text-[13px] font-bold leading-tight" title={item.title}>{item.title}</p>
       <p className="truncate text-[11px] leading-tight text-slate-600" title={`${item.sellerName}${item.sellerFeedback!==null?` (${item.sellerFeedback}%)`:''}`}>{item.sellerName} {item.sellerFeedback!==null?`(${item.sellerFeedback}%)`:''}</p>
       {countdown&&<p className="flex items-center gap-1 text-[11px] leading-tight text-slate-600" title={item.endTime?new Date(item.endTime).toLocaleString(i18n.language):undefined}><LuClock aria-hidden className="size-3 shrink-0"/>{countdown}</p>}
       {item.bestOffer&&<p className="text-[11px] leading-tight text-slate-600">{t('dealsUi.offer')}</p>}
      </div>
      <div className="min-w-0 max-w-[5.5rem] space-y-1 text-end [overflow-wrap:anywhere]">
       <p className="text-xl font-bold leading-tight tabular-nums">{formatted(item.currentBid)}</p>
       <p className="text-[11px] leading-tight text-slate-600">{t('dealsUi.ship')} {formatted(item.shipping)}</p>
       {e.discount!==null&&<p className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${e.discount>0?'bg-emerald-50 text-emerald-800':e.discount<0?'bg-red-50 text-red-700':'bg-slate-100 text-slate-600'}`}>{e.discount>0?'-':'+'}{Math.round(Math.abs(e.discount)*100)}%</p>}
      </div>
     </div>
     <div className="grid grid-cols-3 items-center gap-2 border-t border-slate-200 pt-2 text-[11px]">
      <label className="min-w-0 space-y-0.5 text-slate-600"><span className="block font-semibold leading-tight">{t('dealsUi.grade')} <span className="text-[9px] font-normal leading-tight">({t('dealsUi.'+(e.source==='unknown'?'sourceUnknown':e.source))})</span></span><Select className="min-h-8 w-full border-slate-300 bg-slate-50 px-2 py-0.5 font-bold text-slate-950" value={e.grade} onChange={ev=>{setStableOrder(rows.map(r=>r.item.itemId));setOverrides(v=>({...v,[item.itemId]:gradeSchema.parse(ev.target.value)}));}}>{gradeSchema.options.map(g=><option key={g}>{g}</option>)}</Select></label>
      <div className="min-w-0 border-s border-slate-200 ps-2 text-slate-600">{t('dealsUi.market')}<p className="text-base font-bold leading-tight text-slate-950 tabular-nums [overflow-wrap:anywhere]">{amount(e.market)}</p></div>
      <div className="min-w-0 border-s border-slate-200 ps-2 text-slate-600">{t('dealsUi.total')}<p className="text-base font-bold leading-tight text-slate-950 tabular-nums [overflow-wrap:anywhere]">{amount(e.allIn)}</p></div>
     </div>
     <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" className="min-h-[34px] min-w-0 rounded-lg border-blue-300 bg-white px-1.5 py-1 text-center text-xs font-bold leading-tight text-blue-950" disabled={busy||checking.includes(item.itemId)} onClick={()=>void check(item)}>{t(checking.includes(item.itemId)?'dealsUi.checking':'dealsUi.check')}</Button>
      <Button asChild className="min-h-[34px] min-w-0 gap-1 rounded-lg px-1.5 py-1 text-center text-xs font-bold leading-tight"><a href={item.url} target="_blank" rel="noopener noreferrer"><LuExternalLink aria-hidden className="size-3.5 shrink-0"/>{t('dealsUi.open')}</a></Button>
     </div>{checkFailed.includes(item.itemId)&&<p role="alert" className="text-xs">{t('dealsUi.checkFailed')}</p>}
    </article>;
   })}
   {rows.length>limit&&<Button variant="outline" className="w-full" onClick={()=>setLimit(v=>v+40)}>{t('dealsUi.more')}</Button>}
  </>}
  {picker&&<ScopePicker ids={ids} excluded={excluded} onDone={saveScope} onClose={()=>setPicker(false)}/>}
  {gallery&&<ListingGallery key={gallery.itemId} owner={owner} item={gallery} onClose={()=>setGallery(null)} onGrade={(grade,confidence)=>{setStableOrder(rows.map(r=>r.item.itemId));setAiGrades(v=>({...v,[gallery.itemId]:{grade,confidence}}));}}/>}
 </section>;
}
