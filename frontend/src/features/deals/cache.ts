import type { DealCard, Grade, ScanState } from './scan';
type Detail = {grade:Grade|null;source:'seller'|'unknown';label:string|null;verificationStatus:'strong'|'review'|'rejected'|'unknown';verificationReasons:string[];matchConfidence:number};
export type ScanSnapshot={scan:ScanState;completedAt:number;details:Record<string,Detail>;overrides:Record<string,Grade>;aiGrades:Record<string,{grade:Grade;confidence:number}>};
const TTL=30*60_000;
const cache=new Map<string,ScanSnapshot>();
export function scanCacheKey(owner:string,scope:'card'|'wishlist',cards:readonly DealCard[],postal:string){
 return JSON.stringify([owner,scope,postal,cards.map(c=>[c.id,c.firstEdition,c.finish])]);
}
export function readScanCache(key:string,now:number):ScanSnapshot|null{
 const snapshot=cache.get(key);
 return snapshot&&now-snapshot.completedAt<TTL&&now>=snapshot.completedAt?snapshot:null;
}
export function writeScanCache(key:string,snapshot:ScanSnapshot){
 if(snapshot.scan.throttled||snapshot.scan.searched!==snapshot.scan.cards.length)return;
 cache.delete(key);cache.set(key,snapshot);
 while(cache.size>24){const oldest=cache.keys().next().value;if(oldest===undefined)break;cache.delete(oldest);}
}

// Clock is sampled by explicit scan completion, not result rendering.
export const scanClock=()=>Date.now();
