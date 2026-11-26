import { z } from 'zod';
import { doc, getDocFromServer, serverTimestamp, setDoc } from 'firebase/firestore';
import { createApiClient } from '@/services/api';
import { getEnvironment } from '@/services/environment';
import { getFirebaseServices, getIdToken } from '@/services/firebase';

export const grades = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;
const photoIndex = z.number().int().min(1).max(25);
const coordinate = z.number().int().min(0).max(1000);
export const locationSchema = z.object({photoIndex, box2d:z.tuple([coordinate,coordinate,coordinate,coordinate]).refine(b=>b[0]<b[2] && b[1]<b[3])});
export const analysisSchema = z.object({
  grade:z.enum(grades), confidencePercent:z.number().min(0).max(100),
  gradePercentages:z.object({NM:z.number().min(0).max(100),LP:z.number().min(0).max(100),MP:z.number().min(0).max(100),HP:z.number().min(0).max(100),DMG:z.number().min(0).max(100)}),
  observations:z.array(z.object({area:z.string().max(32),finding:z.string().max(200),severity:z.enum(['slight','minor','moderate','major']),locations:z.array(locationSchema).max(5)})).max(24),
  limitations:z.array(z.string().max(180)).max(8), visibleSides:z.array(z.string().max(35)).max(8),
  model:z.string().max(100), provider:z.string().max(40), rubricVersion:z.string().max(40), promptVersion:z.string().max(40),
}).refine(a=>Math.abs(Object.values(a.gradePercentages).reduce((s,v)=>s+v,0)-100)<.01 && a.confidencePercent===a.gradePercentages[a.grade] && a.confidencePercent===Math.max(...Object.values(a.gradePercentages)), 'Invalid grade distribution');
export type Analysis = z.infer<typeof analysisSchema>;
export const sourceSchema = z.object({type:z.literal('ebay-listing'),marketplace:z.enum(['EBAY_US','EBAY_GB','EBAY_DE']),itemId:z.string().regex(/^v\d\|\d{3,20}\|\d{1,6}$/)});
export type Source = z.infer<typeof sourceSchema>;
const ebayImage = z.url().refine(s=>{const u=new URL(s);return u.protocol==='https:' && u.hostname==='i.ebayimg.com' && !u.username && !u.password && !u.port;});
const listingUrl = z.url().refine(s=>{const u=new URL(s);return u.protocol==='https:' && ['www.ebay.com','www.ebay.co.uk','www.ebay.de'].includes(u.hostname) && !u.username && !u.password && !u.port;});
const listingSchema=z.object({source:sourceSchema,title:z.string().max(160),url:listingUrl,images:z.array(ebayImage).min(1).max(25)});
export type Listing = z.infer<typeof listingSchema>;
const resultSchema=z.object({analysis:analysisSchema,imageCount:z.number().int().min(1).max(25),analyzedPhotoIndices:z.array(photoIndex).min(1).max(8)}).refine(r=>r.analyzedPhotoIndices.every(i=>i<=r.imageCount) && r.analysis.observations.every(o=>o.locations.every(l=>r.analyzedPhotoIndices.includes(l.photoIndex))));
export type AnalysisResult=z.infer<typeof resultSchema>;
function ownerServices(owner:string) {
  const s=getFirebaseServices();
  if (!s || s.auth.currentUser?.uid!==owner) throw Error('AI_AUTH_REQUIRED');
  return s;
}
function client(owner:string) {
  const env=getEnvironment();
  if (!env?.workerUrl) throw Error('AI_NOT_CONFIGURED');
  return createApiClient(env.workerUrl,async()=>{ownerServices(owner); const token=await getIdToken(); ownerServices(owner); if(!token)throw Error('AI_AUTH_REQUIRED');return token;});
}
export async function resolveListing(owner:string,url:string,signal:AbortSignal) {
  const data=(await client(owner).post('/api/resolve-ebay-link',{url},{signal})).data;
  ownerServices(owner);return listingSchema.parse(data);
}
export async function runAnalysis(owner:string,input:Source|readonly Blob[],signal:AbortSignal,selectedImages?:readonly string[]) {
  const api=client(owner);
  let data:unknown;
  if (Array.isArray(input)) {
    const form=new FormData();input.forEach((blob,i)=>form.append('photos',blob,`card-${i+1}.jpg`));
    data=(await api.post('/api/analyze-upload',form,{signal,timeout:120_000})).data;
  } else if(selectedImages) {
    const images=z.array(ebayImage).min(1).max(25).parse(selectedImages);
    data=(await api.post('/api/analyze-selected-condition',{source:input,images},{signal,timeout:120_000})).data;
  } else data=(await api.post('/api/analyze-condition',{source:input},{signal,timeout:120_000})).data;
  ownerServices(owner);const result=resultSchema.parse(data);
  if(selectedImages&&(result.imageCount!==selectedImages.length||result.analyzedPhotoIndices.some(i=>i>8)))throw Error('AI_INVALID_PHOTOS');
  return result;
}
export function analysisKey(source:Source) { const s=sourceSchema.parse(source); return `ebay-listing__${s.marketplace}__${s.itemId.replace(/\|/g,'_')}`; }
function cacheRef(owner:string,source:Source) { return doc(ownerServices(owner).db,'users',owner,'conditionAnalyses',analysisKey(source)); }
export async function readAnalysis(owner:string,source:Source):Promise<AnalysisResult|null> {
  const snap=await getDocFromServer(cacheRef(owner,source));ownerServices(owner);
  if(!snap.exists())return null;
  const record=snap.data();
  if(JSON.stringify(sourceSchema.parse(record.source))!==JSON.stringify(sourceSchema.parse(source)))return null;
  const result=resultSchema.safeParse({analysis:record.analysis,imageCount:record.imageCount,analyzedPhotoIndices:record.photoIndices});
  return result.success?result.data:null;
}
export async function saveAnalysis(owner:string,source:Source,result:AnalysisResult) {
  const valid=resultSchema.parse(result); const ref=cacheRef(owner,source);
  // Same owner-only schema as the retained analyzer; never persist uploaded photos.
  ownerServices(owner);
  await setDoc(ref,{schemaVersion:1,source:sourceSchema.parse(source),analysis:valid.analysis,photoIndices:valid.analyzedPhotoIndices,imageCount:valid.imageCount,analyzedAt:serverTimestamp(),clientAnalyzedAt:Date.now()});
  ownerServices(owner);
}
