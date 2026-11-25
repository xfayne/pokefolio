import { z } from 'zod';
import { getEnvironment, STAGING_API } from '@/services/environment';
import { createApiClient } from '@/services/api';
import { getFirebaseServices } from '@/services/firebase';
import { catalogCards, catalogMarketReference } from '@/features/catalog/catalog';

export const gradeSchema = z.enum(['NM','LP','MP','HP','DMG']);
export type Grade = z.infer<typeof gradeSchema>;
const cash = z.object({value:z.number().finite().nonnegative(),currency:z.string().regex(/^[A-Z]{3}$/)});
const ebayUrl = z.string().url().refine(value => {
  const u = new URL(value);
  return u.protocol === 'https:' && !u.username && !u.password && !u.port && /^(www\.)?ebay\.(com|co\.uk|de)$/.test(u.hostname) && u.pathname.startsWith('/itm/');
});
export const itemSchema = z.object({
  cardId:z.string(), itemId:z.string().regex(/^v\d\|\d{3,20}\|\d{1,6}$/), title:z.string(),
  url:ebayUrl, image:z.string().url().refine(v=>v.startsWith('https://')).nullable(),
  currentBid:cash, shipping:cash.nullable(), bidCount:z.number().int().nullable(),
  endTime:z.string().nullable(), sellerFeedback:z.number().nullable(), sellerName:z.string(),
  condition:z.string(), conditionGrade:gradeSchema.nullable(), conditionSource:z.enum(['seller','title','unknown']),
  conditionLabel:z.string(), format:z.enum(['AUCTION','FIXED_PRICE']), bestOffer:z.boolean(),
  marketplace:z.enum(['EBAY_US','EBAY_GB','EBAY_DE']), matchConfidence:z.number().finite(),
  warnings:z.array(z.string()), verificationStatus:z.enum(['strong','review']), verificationReasons:z.array(z.string()),
});
export type DealItem = z.infer<typeof itemSchema>;
export type DealCard = {id:string;name:string;setName:string;number:string;firstEdition:boolean;finish:'holo'|'normal'|'shining'|null};
const byId = new Map(catalogCards.map(card=>[card.id,card]));
export function dealCards(ids: readonly string[]): DealCard[] {
  return ids.flatMap(id=>{
    const card=byId.get(id), ref=catalogMarketReference(id);
    if (!card || ref.kind!=='identified') return [];
    const finish=ref.finish.status==='known' ? ref.finish.value : null;
    return [{id:card.id,name:card.name,setName:card.setName,number:card.number,firstEdition:ref.edition==='first-edition',finish:finish==='holo'||finish==='normal'||finish==='shining'?finish:null}];
  });
}
const batchSchema = z.object({items:z.array(z.unknown()),errors:z.array(z.object({cardId:z.string(),error:z.string()})),fetchedAt:z.string()});
export type Batch = {items:DealItem[];errors:{cardId:string;error:string;invalidFields?:string[]}[];fetchedAt:string};
export type ScanState = {cards:readonly DealCard[];searched:number;items:DealItem[];errors:Batch['errors'];fetchedAt:string|null;throttled:boolean};
export const newScan = (cards:readonly DealCard[]):ScanState => ({cards:[...cards],searched:0,items:[],errors:[],fetchedAt:null,throttled:false});
export function parseBatch(raw:unknown, cards:readonly DealCard[]):Batch {
  const data=batchSchema.parse(raw), ids=new Set(cards.map(c=>c.id));
  const items:DealItem[]=[], errors:Batch['errors']=[...data.errors];
  for(const value of data.items){
    const parsed=itemSchema.safeParse(value);
    if(!parsed.success){
      const invalidFields=[...new Set(parsed.error.issues.map(issue=>String(issue.path[0]??'listing')))];
      errors.push({cardId:'',error:'Invalid listing response',invalidFields});
      continue;
    }
    if(!ids.has(parsed.data.cardId))continue;
    const title=parsed.data.title;
    if (/\bart[\s_-]*cases?\b|\b(?:japanese|japanisch\w*|jpn|jap|japonais\w*|japon[eé]s\w*|japan\s+(?:edition|version|print|language|import|card))\b/i.test(title)||/[\u3040-\u30ff\u3400-\u9fff]/u.test(title))continue;
    items.push(parsed.data);
  }
  return {...data,items,errors};
}
export function dealsClient(owner:string) {
  if(getEnvironment()?.workerUrl!==STAGING_API)throw Error('Deals API unavailable');
  return createApiClient(STAGING_API,async()=>{
    const user=getFirebaseServices()?.auth.currentUser;
    if(!user||user.uid!==owner)throw Error('Account changed');
    const token=await user.getIdToken();
    if(getFirebaseServices()?.auth.currentUser?.uid!==owner)throw Error('Account changed');
    return token;
  });
}
export async function fetchBatch(owner:string,cards:readonly DealCard[],signal:AbortSignal,postalCode?:string):Promise<Batch>{
  const response=await dealsClient(owner).post('/api/search',{cards,...(postalCode?{postalCode}:{})},{signal,timeout:60000});
  return parseBatch(response.data,cards);
}
function delay(ms:number,signal:AbortSignal):Promise<void>{
  return new Promise((resolve,reject)=>{
    signal.throwIfAborted();
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    signal.addEventListener('abort',abort,{once:true});
  });
}
/** Explicit caller-owned run; no mount effects, no automatic retries, immutable scope. */
export async function runScan(initial:ScanState, request:(cards:readonly DealCard[],signal:AbortSignal)=>Promise<Batch>,signal:AbortSignal,onProgress:(state:ScanState)=>void,wait=500):Promise<ScanState>{
  let state={...initial,throttled:false};
  const seen=new Set(state.items.map(item=>item.itemId));
  while(state.searched<state.cards.length){
    signal.throwIfAborted();
    const cards=state.cards.slice(state.searched,state.searched+4);
    const batch=await request(cards,signal);
    signal.throwIfAborted();
    const throttled=batch.errors.some(e=>/\b(?:429|rate.limit|quota.exceeded)\b/i.test(e.error));
    const items=batch.items.filter(item=>{if(seen.has(item.itemId))return false;seen.add(item.itemId);return true;});
    state={...state,items:[...state.items,...items],errors:[...state.errors,...batch.errors],searched:state.searched+(throttled?0:cards.length),fetchedAt:batch.fetchedAt,throttled};
    onProgress(state);
    if(throttled)break;
    if(state.searched<state.cards.length)await delay(wait,signal);
  }
  return state;
}
