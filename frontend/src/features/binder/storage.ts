import { doc, getDocFromServer, runTransaction, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';
import { binderSchema, decodePublic, emptyBinder, encodePublic, projectBinder, type Binder } from './model';
import { idSchema, type CardCopy } from '@/domain/schema';

const ref = (db: Firestore, owner: string) => { idSchema.parse(owner); return doc(db,`users/${owner}/binders/main`); };
export async function readBinder(db: Firestore, owner: string): Promise<Binder> {
  const snapshot=await getDocFromServer(ref(db,owner));
  if (!snapshot.exists()) return emptyBinder(owner);
  return decodeBinder(snapshot.data(),owner);
}
export function decodeBinder(data: Record<string,unknown>, owner: string): Binder {
  const binder=binderSchema.parse({schemaVersion:data.schemaVersion,ownerUid:data.ownerUid,revision:data.revision,pockets:JSON.parse(String(data.pockets)),includeWish:data.includeWish});
  if (binder.ownerUid !== owner || binder.revision < 1) throw Error('Invalid binder owner or revision');
  return binder;
}
export async function saveBinder(db: Firestore, owner: string, before: Binder, next: Binder) {
  binderSchema.parse(next);
  if (owner !== before.ownerUid || owner !== next.ownerUid) throw Error('Foreign binder');
  return runTransaction(db,async tx => {
    const target=ref(db,owner), snapshot=await tx.get(target);
    const current=snapshot.exists() ? decodeBinder(snapshot.data(),owner) : emptyBinder(owner);
    if (JSON.stringify(current) !== JSON.stringify(before)) throw Error('Binder changed. Reload before saving.');
    const saved={...next,revision:current.revision+1};
    tx.set(target,{...saved,pockets:JSON.stringify(saved.pockets),updatedAt:serverTimestamp()});
    return saved;
  });
}
const shareSettings = (db:Firestore,owner:string) => doc(db,`users/${owner}/sharing/settings`);
export async function readSharing(db:Firestore,owner:string) {
  const snapshot=await getDocFromServer(shareSettings(db,owner));
  const data=snapshot.data();
  return data?.enabled===true && typeof data.shareId==='string' ? data.shareId : null;
}
export async function publishBinder(db:Firestore,binder:Binder,copies:readonly CardCopy[],shareId:string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(shareId)) throw Error('Invalid share ID');
  const batch=writeBatch(db);
  batch.set(doc(db,`sharedBinders/${shareId}`),{schemaVersion:2,ownerUid:binder.ownerUid,pockets:encodePublic(projectBinder(binder,copies)),includeWish:binder.includeWish,updatedAt:serverTimestamp()});
  batch.set(shareSettings(db,binder.ownerUid),{shareId,enabled:true,includeWish:binder.includeWish});
  await batch.commit();
}
export async function disableSharing(db:Firestore,owner:string,shareId:string,includeWish:boolean) {
  const batch=writeBatch(db); batch.set(shareSettings(db,owner),{shareId,enabled:false,includeWish}); await batch.commit();
}
export async function readSharedBinder(db:Firestore,shareId:string) {
  if (!/^[a-f0-9-]{36}$/.test(shareId)) throw Error('Invalid share ID');
  const snapshot=await getDocFromServer(doc(db,`sharedBinders/${shareId}`));
  if (!snapshot.exists() || snapshot.data().schemaVersion!==2) throw Error('Shared binder unavailable');
  return decodePublic(snapshot.data().pockets);
}
