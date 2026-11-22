import {collection,getDocs,limit,orderBy,query,startAfter,where,type Firestore,type QueryDocumentSnapshot} from 'firebase/firestore';
import {useQuery} from '@tanstack/react-query';
import {dateSchema,idSchema,type Revision,revisionSchema} from '@/domain/schema';
import {getFirebaseServices} from './firebase';

export async function readPortfolioAudit(db:Firestore,owner:string,from:string):Promise<{audits:Revision[];truncated:boolean}> {
 idSchema.parse(owner);dateSchema.parse(from);
 const audits:Revision[]=[];let cursor:QueryDocumentSnapshot|undefined;
 for(let page=0;page<20;page++){
  const source=collection(db,`users/${owner}/revisions`);
  const constraints=[where('record.createdAt','>=',`${from}T00:00:00Z`),orderBy('record.createdAt'),...(cursor?[startAfter(cursor)]:[]),limit(250)];
  const response=await getDocs(query(source,...constraints));
  for(const doc of response.docs){const record=revisionSchema.parse(doc.data().record);if(record.ownerUid!==owner)throw Error('Foreign audit record');audits.push(record);}
  if(response.docs.length<250)return {audits,truncated:false};cursor=response.docs.at(-1);
 }
 return {audits,truncated:true};
}
export function usePortfolioAudit(owner:string|undefined,from:string){
 return useQuery({queryKey:['portfolio',owner,'revisions',from],enabled:!!owner,queryFn:()=>readPortfolioAudit(getFirebaseServices()!.db,owner!,from),staleTime:60_000,retry:false});
}
