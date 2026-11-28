import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch} from 'firebase/firestore';

const projectId='demo-pokefolio-isolation';
const host='127.0.0.1', port=8080;
if(process.env.FIRESTORE_EMULATOR_HOST!==host+':'+port)
 throw Error('Security tests require the explicit loopback Firestore emulator; cloud fallback is forbidden.');
assert.ok(projectId.startsWith('demo-'));

async function environment(file) {
 return initializeTestEnvironment({
  projectId, firestore:{host,port,rules:readFileSync(new URL('../'+file,import.meta.url),'utf8')}
 });
}
const alice='synthetic-alice', bob='synthetic-bob';
const fixture={progress:{owned:{'base-1':true},wish:{'jungle-1':true},
 binderOrder:['base-1','__empty__synthetic-pocket','jungle-1'],wishOrder:['jungle-1']},
 revision:1,clientTimestamp:1,updatedAt:Timestamp.fromMillis(1)};
async function seed(env) {
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await setDoc(doc(db,'users',alice),fixture);
  await setDoc(doc(db,'users',bob),fixture);
  await setDoc(doc(db,'sharedBinders','synthetic-share'),{ownerUid:alice,cards:[]});
 });
}
test('deny-all rollback bootstrap rejects both synthetic users and anonymous clients',async t=>{
 const env=await environment('firestore.rules');
 try {
  await seed(env);
  for(const [label,context] of [
   ['anonymous',env.unauthenticatedContext()],
   ['alice',env.authenticatedContext(alice)],
   ['bob',env.authenticatedContext(bob)]
  ]) await t.test(label,async()=>{
   const db=context.firestore();
   for(const uid of [alice,bob]) {
    const ref=doc(db,'users',uid);
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref,fixture));
    await assertFails(updateDoc(ref,{revision:2}));
    await assertFails(deleteDoc(ref));
    await assertFails(setDoc(doc(db,'users',uid,'conditionAnalyses','synthetic-analysis'),{grade:'NM'}));
   }
   await assertFails(getDocs(collection(db,'users')));
   await assertFails(getDoc(doc(db,'sharedBinders','synthetic-share')));
  });
 } finally { await env.cleanup(); }
});

test('undeployed infrastructure probe enforces owner access and complete validation',async t=>{
 const env=await environment('firestore.owner-probe.rules');
 try {
  await seed(env);
  const db=env.authenticatedContext(alice).firestore();
  const other=env.authenticatedContext(bob).firestore();
  const anonymous=env.unauthenticatedContext().firestore();
  const ref=doc(db,'stagingChecks',alice);
  const probe=()=>({schemaVersion:1,ownerUid:alice,message:'Synthetic staging probe',
   createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await t.test('owner can create and read a valid synthetic probe',async()=>{
   await assertSucceeds(setDoc(ref,probe()));
   assert.equal((await getDoc(ref)).data().ownerUid,alice);
  });
  await t.test('another user and anonymous clients cannot read, replace, update or delete it',async()=>{
   for(const client of [other,anonymous]){
    const target=doc(client,'stagingChecks',alice);
    await assertFails(getDoc(target));
    await assertFails(setDoc(target,probe()));
    await assertFails(updateDoc(target,{message:'hijack',updatedAt:serverTimestamp()}));
    await assertFails(deleteDoc(target));
   }
  });
  await t.test('owner cannot list all probes or access application data',async()=>{
   await assertFails(getDocs(collection(db,'stagingChecks')));
   await assertFails(getDoc(doc(db,'users',alice)));
   await assertFails(setDoc(doc(db,'users',alice),fixture));
   await assertFails(getDoc(doc(db,'sharedBinders','synthetic-share')));
   await assertFails(setDoc(doc(db,'users',alice,'conditionAnalyses','synthetic-analysis'),{grade:'NM'}));
  });
  await t.test('validation also applies to updates and prevents ownership or timestamp changes',async()=>{
   await assertFails(updateDoc(ref,{ownerUid:bob,updatedAt:serverTimestamp()}));
   await assertFails(updateDoc(ref,{createdAt:Timestamp.fromMillis(1),updatedAt:serverTimestamp()}));
   await assertFails(updateDoc(ref,{message:'x'.repeat(121),updatedAt:serverTimestamp()}));
   await assertFails(updateDoc(ref,{message:123,updatedAt:serverTimestamp()}));
   await assertFails(updateDoc(ref,{isAdmin:true,updatedAt:serverTimestamp()}));
   await assertFails(updateDoc(ref,{updatedAt:Timestamp.fromMillis(1)}));
   const current=(await getDoc(ref)).data();
   for(const field of ['schemaVersion','ownerUid','message','createdAt','updatedAt']){
    const invalid={...current,updatedAt:serverTimestamp()};delete invalid[field];
    await assertFails(setDoc(ref,invalid));
   }
   await assertSucceeds(updateDoc(ref,{message:'Updated synthetic probe',updatedAt:serverTimestamp()}));
  });
  await t.test('invalid creates cannot bypass required fields, schema, identity or timestamps',async()=>{
   const ownBob=doc(other,'stagingChecks',bob);
   const valid=()=>({...probe(),ownerUid:bob});
   for(const change of [
    {schemaVersion:2},{ownerUid:alice},{message:'x'.repeat(121)},{message:[]},
    {createdAt:Timestamp.fromMillis(1)},{updatedAt:Timestamp.fromMillis(1)},{role:'admin'}
   ])await assertFails(setDoc(ownBob,{...valid(),...change}));
   for(const field of ['schemaVersion','ownerUid','message','createdAt','updatedAt']){
    const invalid=valid();delete invalid[field];await assertFails(setDoc(ownBob,invalid));
   }
  });
  await t.test('owner can delete their synthetic probe without changing binder or Wishlist fixtures',async()=>{
   await assertSucceeds(deleteDoc(ref));
   await env.withSecurityRulesDisabled(async context=>{
    const saved=(await getDoc(doc(context.firestore(),'users',alice))).data();
    assert.deepEqual(saved.progress,fixture.progress);
   });
  });
 } finally { await env.cleanup(); }
});

test('private application policy preserves legacy data and isolates owners',async t=>{
 const env=await environment('firestore.private.rules');
 try {
  await seed(env);
  const db=env.authenticatedContext(alice).firestore();
  const own=doc(db,'users',alice);
  const update=()=>({...fixture,revision:2,updatedAt:serverTimestamp()});
  await t.test('owner reads and writes the retained progress without changing order or empty pockets',async()=>{
   assert.deepEqual((await assertSucceeds(getDoc(own))).data().progress,fixture.progress);
   await assertSucceeds(setDoc(own,update()));
   assert.deepEqual((await getDoc(own)).data().progress,fixture.progress);
   await assertFails(deleteDoc(own));
   await assertFails(getDocs(collection(db,'users')));
  });
  await t.test('other users and anonymous clients cannot read or mutate private roots or subcollections',async()=>{
   for(const context of [env.authenticatedContext(bob),env.unauthenticatedContext()]){
    const client=context.firestore();
    const target=doc(client,'users',alice);
    await assertFails(getDoc(target));
    await assertFails(setDoc(target,update()));
    await assertFails(updateDoc(target,{revision:3,updatedAt:serverTimestamp()}));
    await assertFails(deleteDoc(target));
    await assertFails(getDoc(doc(client,'users',alice,'sharing','settings')));
    await assertFails(setDoc(doc(client,'users',alice,'sharing','settings'),{shareId:'a'.repeat(36),enabled:true,includeWish:true}));
    await assertFails(getDoc(doc(client,'users',alice,'conditionAnalyses','synthetic-analysis')));
   }
  });
  await t.test('invalid root creates and updates cannot bypass metadata validation',async()=>{
   for(const change of [
    {progress:[]},{revision:0},{revision:'2'},{updatedAt:Timestamp.fromMillis(1)},
    {clientTimestamp:-1},{ownerUid:bob},{isAdmin:true}
   ])await assertFails(setDoc(own,{...update(),...change}));
   for(const field of ['progress','revision','updatedAt','clientTimestamp']){
    const invalid=update();delete invalid[field];await assertFails(setDoc(own,invalid));
   }
   await assertFails(updateDoc(own,{revision:'3',updatedAt:serverTimestamp()}));
   await assertFails(updateDoc(own,{isAdmin:true,updatedAt:serverTimestamp()}));
  });
  await t.test('private sharing settings validate their schema without publishing a public binder',async()=>{
   const ref=doc(db,'users',alice,'sharing','settings');
   const settings={shareId:'a'.repeat(36),enabled:false,includeWish:true};
   await assertSucceeds(setDoc(ref,settings));
   await assertSucceeds(getDoc(ref));
   await assertFails(updateDoc(ref,{enabled:'yes'}));
   await assertFails(updateDoc(ref,{ownerUid:bob}));
   await assertFails(setDoc(doc(db,'users',alice,'sharing','unexpected'),settings));
   await assertFails(getDoc(doc(db,'sharedBinders','synthetic-share')));
   await assertFails(setDoc(doc(db,'sharedBinders','synthetic-share'),{ownerUid:alice,cards:[]}));
  });
  await t.test('private analysis validation applies to creates and updates',async()=>{
   const ref=doc(db,'users',alice,'conditionAnalyses','synthetic-analysis');
   const analysis=()=>({schemaVersion:1,source:{type:'ebay-listing',marketplace:'EBAY_US',itemId:'v1|123456|0'},
    analysis:{grade:'LP'},photoIndices:[1,2],imageCount:2,analyzedAt:serverTimestamp(),clientAnalyzedAt:1});
   await assertSucceeds(setDoc(ref,analysis()));
   await assertSucceeds(getDoc(ref));
   for(const change of [
    {photoIndices:['1']},{photoIndices:[26]},{imageCount:-1},{analysis:{grade:'BAD'}},
    {analyzedAt:Timestamp.fromMillis(1)},{clientAnalyzedAt:-1},{ownerUid:bob}
   ])await assertFails(setDoc(ref,{...analysis(),...change}));
   await assertFails(updateDoc(ref,{photoIndices:['1'],analyzedAt:serverTimestamp()}));
   await assertFails(deleteDoc(ref));
  });
  await t.test('unknown subcollections and synthetic infrastructure probes stay denied',async()=>{
   await assertFails(setDoc(doc(db,'users',alice,'unknown','document'),{value:1}));
   await assertFails(setDoc(doc(db,'stagingChecks',alice),{ownerUid:alice}));
  });
 } finally { await env.cleanup(); }
});

test('public binder policy permits only opt-in single-link reads of a strict projection',async t=>{
 const env=await environment('firestore.private.rules');
 try{
  await seed(env);
  const db=env.authenticatedContext(alice).firestore();
  const other=env.authenticatedContext(bob).firestore();
  const anon=env.unauthenticatedContext().firestore();
  const id='12345678-1234-4234-8234-123456789abc';
  const ref=doc(db,'sharedBinders',id),settings=doc(db,'users',alice,'sharing','settings');
  const payload=()=>({schemaVersion:2,ownerUid:alice,pockets:'o:base1-1;_;w:base2-3;p:movie2000-ancient-mew',includeWish:true,updatedAt:serverTimestamp()});
  const publish=async(data=payload())=>{
   const batch=writeBatch(db);batch.set(ref,data);
   batch.set(settings,{shareId:id,enabled:true,includeWish:data.includeWish??true});return batch.commit();
  };
  await t.test('publication requires a matching owner opt-in in the same atomic batch',async()=>{
   await assertFails(setDoc(ref,payload()));
   await assertSucceeds(publish());
   assert.equal((await assertSucceeds(getDoc(doc(anon,'sharedBinders',id)))).data().pockets,payload().pockets);
  });
  await t.test('anonymous and foreign owners cannot write, hijack or enumerate public links',async()=>{
   for(const client of [anon,other]){
    await assertFails(getDocs(collection(client,'sharedBinders')));
    await assertFails(setDoc(doc(client,'sharedBinders',id),payload()));
    await assertFails(updateDoc(doc(client,'sharedBinders',id),{ownerUid:bob,updatedAt:serverTimestamp()}));
    await assertFails(deleteDoc(doc(client,'sharedBinders',id)));
   }
   await assertFails(getDocs(collection(db,'sharedBinders')));
   await assertFails(updateDoc(ref,{ownerUid:bob,updatedAt:serverTimestamp()}));
  });
  await t.test('strict create/update validators reject private fields, types, oversized and malformed contents',async()=>{
   for(const change of [
    {schemaVersion:1},{ownerUid:bob},{pockets:[]},{pockets:'o:private-notes'},
    {pockets:'o:base1-1;email@example.com'},{pockets:'_;'.repeat(1252)+'_'},
    {pockets:'x'.repeat(40001)},{pockets:'w:base1-1',includeWish:false},
    {pockets:'o:base1-1;\n_'},{pockets:'o:base1-1;'}, {cards:[{notes:'private'}]},
    {notes:'private'},{updatedAt:Timestamp.fromMillis(1)}
   ]){
    await assertFails(publish({...payload(),...change}));
    await assertFails(updateDoc(ref,{...change,updatedAt:change.updatedAt||serverTimestamp()}));
   }
   for(const key of Object.keys(payload())){
    const invalid=payload();delete invalid[key];await assertFails(publish(invalid));
   }
  });
  await t.test('full capacity, empty pockets and all three kinds preserve ordering',async()=>{
   const pockets=Array.from({length:1252},(_,i)=>i%2?'_':'o:base1-1').join(';');
   await assertSucceeds(publish({...payload(),pockets}));
   assert.equal((await getDoc(doc(anon,'sharedBinders',id))).data().pockets,pockets);
   await assertSucceeds(publish({...payload(),pockets:'',includeWish:false}));
  });
  await t.test('revocation and link rotation immediately block old link reads without deleting private data',async()=>{
   await assertSucceeds(setDoc(settings,{shareId:id,enabled:false,includeWish:false}));
   await assertFails(getDoc(doc(anon,'sharedBinders',id)));
   await assertFails(setDoc(ref,{...payload(),pockets:'',includeWish:false}));
   await assertSucceeds(setDoc(settings,{shareId:'22345678-1234-4234-8234-123456789abc',enabled:true,includeWish:false}));
   await assertFails(getDoc(doc(anon,'sharedBinders',id)));
   assert.deepEqual((await getDoc(doc(db,'users',alice))).data().progress,fixture.progress);
   await assertFails(getDoc(doc(anon,'users',alice)));
  });
 }finally{await env.cleanup();}
});

test('portfolio ownership, atomic audit revisions and immutable receipts', async t => {
 const env=await environment('firestore.private.rules');
 try {
  await env.clearFirestore();
  const db=env.authenticatedContext(alice).firestore();
  const other=env.authenticatedContext(bob).firestore();
  const anonymous=env.unauthenticatedContext().firestore();
  const record={schemaVersion:1,id:'purchase-one',ownerUid:alice,revision:1,createdAt:'2026-11-21T00:00:00Z',updatedAt:'2026-11-21T00:00:00Z',kind:'purchase'};
  const envelope=record=>({record,auditId:null,committedAt:serverTimestamp()});
  const path=`users/${alice}/transactions/purchase-one`;
  await t.test('only the owner can create/read/list',async()=>{
   await assertFails(setDoc(doc(other,path),envelope(record)));
   await assertFails(setDoc(doc(anonymous,path),envelope(record)));
   await assertSucceeds(setDoc(doc(db,path),envelope(record)));
   await assertSucceeds(getDocs(collection(db,`users/${alice}/transactions`)));
   await assertFails(getDoc(doc(other,path)));
   await assertFails(getDocs(collection(other,`users/${alice}/transactions`)));
   await assertFails(setDoc(doc(db,`users/${alice}/transactions/foreign`),envelope({...record,id:'foreign',ownerUid:bob})));
  });
  const next={...record,revision:2,updatedAt:'2026-11-21T01:00:00Z'};
  await t.test('updates need matching immutable audit and expected revision',async()=>{
   await assertFails(setDoc(doc(db,path),envelope(next)));
   const audit={schemaVersion:1,id:'audit-one',ownerUid:alice,actorUid:alice,revision:1,createdAt:next.updatedAt,updatedAt:next.updatedAt,recordId:record.id,before:record,after:next};
   const batch=writeBatch(db);
   batch.set(doc(db,`users/${alice}/revisions/audit-one`),envelope(audit));
   batch.set(doc(db,path),{...envelope(next),auditId:'audit-one'});
   await assertSucceeds(batch.commit());
   await assertFails(setDoc(doc(db,`users/${alice}/revisions/audit-one`),envelope(audit)));
   await assertFails(setDoc(doc(db,path),{...envelope(next),auditId:'audit-one'}));
   await assertFails(deleteDoc(doc(db,path)));
  });
  await t.test('receipts cannot be changed or deleted',async()=>{
   const receipt=doc(db,`users/${alice}/receipts/save-one`);
   await assertSucceeds(setDoc(receipt,{fingerprint:'synthetic',committedAt:serverTimestamp()}));
   await assertFails(setDoc(receipt,{fingerprint:'different',committedAt:serverTimestamp()}));
   await assertFails(deleteDoc(receipt));
  });
 } finally {await env.cleanup();}
});

test('display currency preferences are private, bounded and use server time',async()=>{
 const env=await environment('firestore.private.rules');
 try{
  const db=env.authenticatedContext(alice).firestore();const foreign=env.authenticatedContext(bob).firestore();
  const path=`users/${alice}/preferences/display`;
  await assertSucceeds(setDoc(doc(db,path),{currency:'ILS',updatedAt:serverTimestamp()}));
  await assertSucceeds(getDoc(doc(db,path)));
  await assertFails(getDoc(doc(foreign,path)));
  await assertFails(setDoc(doc(foreign,path),{currency:'USD',updatedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(db,path),{currency:'FAKE',updatedAt:serverTimestamp()}));
 }finally{await env.cleanup();}
});

test('collection highlights are owner-only with at most five distinct catalog references',async()=>{
 const env=await environment('firestore.private.rules');
 try{
  const db=env.authenticatedContext(alice).firestore();
  const foreign=env.authenticatedContext(bob).firestore();
  const anon=env.unauthenticatedContext().firestore();
  const path=`users/${alice}/preferences/collection`;
  const payload=featuredCardIds=>({featuredCardIds,updatedAt:serverTimestamp()});
  await assertSucceeds(getDoc(doc(db,path)));
  await assertSucceeds(setDoc(doc(db,path),payload(['base1-4','base3-5','base2-11','neo2-13','basep-9'])));
  for(const client of [foreign,anon]){
   await assertFails(getDoc(doc(client,path)));
   await assertFails(setDoc(doc(client,path),payload([])));
  }
  for(const ids of [['base1-4','base1-4'],['not-a-card'],[1],['base1-4','base3-5','base2-11','neo2-13','basep-9','basep-3']])
   await assertFails(setDoc(doc(db,path),payload(ids)));
  await assertFails(setDoc(doc(db,path),{...payload([]),extra:true}));
  await assertFails(setDoc(doc(db,path),{featuredCardIds:[]}));
  await assertFails(deleteDoc(doc(db,path)));
  await assertSucceeds(setDoc(doc(db,path),payload([])));
 }finally{await env.cleanup();}
});

test('nine-copy sale edits fit the atomic audit policy and lifecycle writes remain owner-only',async()=>{
 const env=await environment('firestore.private.rules');
 try {
  await env.clearFirestore();
  const db=env.authenticatedContext(alice).firestore();
  const foreign=env.authenticatedContext(bob).firestore();
  const envelope=record=>({record,auditId:null,committedAt:serverTimestamp()});
  const stamp='2026-11-21T00:00:00Z';
  const metadata={schemaVersion:1,ownerUid:alice,revision:1,createdAt:stamp,updatedAt:stamp};
  const copyIds=Array.from({length:9},(_,i)=>`copy-${i}`);
  const sale={...metadata,id:'sale-nine',kind:'sale',copyIds};
  const originals=[{path:`users/${alice}/transactions/${sale.id}`,record:sale},
   ...copyIds.map((id,i)=>({path:`users/${alice}/transactions/${sale.id}/lines/line-${i}`,record:{...metadata,id:`line-${i}`,transactionId:sale.id,copyId:id}})),
   ...copyIds.map(id=>({path:`users/${alice}/copies/${id}`,record:{...metadata,id,disposition:'sold',dispositionRecordId:sale.id}}))];
  const create=writeBatch(db);
  for(const {path,record} of originals)create.set(doc(db,path),envelope(record));
  await assertSucceeds(create.commit());
  const edit=writeBatch(db);
  for(const [i,{path,record}] of originals.entries()){
   const next={...record,revision:2,updatedAt:'2026-11-22T00:00:00Z'};
   const auditId=`sale-edit-${i}`;
   const audit={...metadata,id:auditId,actorUid:alice,recordId:record.id,before:record,after:next,operation:'edit',reason:'Synthetic sale edit'};
   edit.set(doc(db,`users/${alice}/revisions/${auditId}`),envelope(audit));
   edit.set(doc(db,path),{...envelope(next),auditId});
  }
  await assertSucceeds(edit.commit());
  await assertFails(getDoc(doc(foreign,`users/${alice}/transactions/${sale.id}`)));
  await assertFails(setDoc(doc(foreign,`users/${alice}/copies/copy-0`),envelope({...originals[10].record,disposition:'held'})));
  await assertFails(deleteDoc(doc(db,`users/${alice}/copies/copy-0`)));
 }finally{await env.cleanup();}
});

test('twenty-copy receipt fits audited atomic writes and preserves copy identity',async()=>{
 const env=await environment('firestore.private.rules');
 try {
  await env.clearFirestore();
  const db=env.authenticatedContext(alice).firestore();
  const stamp='2026-11-21T00:00:00Z';
  const metadata={schemaVersion:1,ownerUid:alice,revision:1,createdAt:stamp,updatedAt:stamp};
  const envelope=record=>({record,auditId:null,committedAt:serverTimestamp()});
  const copies=Array.from({length:20},(_,i)=>({...metadata,id:`receipt-copy-${i}`,possession:'pending'}));
  const create=writeBatch(db);
  for(const copy of copies)create.set(doc(db,`users/${alice}/copies/${copy.id}`),envelope(copy));
  await assertSucceeds(create.commit());
  const receive=writeBatch(db);
  for(const copy of copies){
   const next={...copy,possession:'received',revision:2,updatedAt:'2026-11-22T00:00:00Z'};
   const auditId=`receipt-${copy.id}`;
   const audit={...metadata,id:auditId,actorUid:alice,recordId:copy.id,before:copy,after:next,operation:'delivery',reason:'Synthetic receipt'};
   receive.set(doc(db,`users/${alice}/revisions/${auditId}`),envelope(audit));
   receive.set(doc(db,`users/${alice}/copies/${copy.id}`),{...envelope(next),auditId});
  }
  receive.set(doc(db,`users/${alice}/receipts/receive-twenty`),{fingerprint:'synthetic',committedAt:serverTimestamp()});
  await assertSucceeds(receive.commit());
  await assertFails(getDoc(doc(env.authenticatedContext(bob).firestore(),`users/${alice}/copies/${copies[0].id}`)));
 }finally{await env.cleanup();}
});

test('private React binder layout is owner-only, revision checked and isolated from financial/progress records',async()=>{
 const env=await environment('firestore.private.rules');
 try {
  await seed(env);
  const db=env.authenticatedContext(alice).firestore(), foreign=env.authenticatedContext(bob).firestore(), anon=env.unauthenticatedContext().firestore();
  const path=`users/${alice}/binders/main`;
  const payload={schemaVersion:1,ownerUid:alice,revision:1,pockets:JSON.stringify([{kind:'copy',copyId:'synthetic-copy'},{kind:'empty',token:'synthetic-gap'}]),includeWish:true,updatedAt:serverTimestamp()};
  await assertSucceeds(getDoc(doc(db,path)));
  await assertSucceeds(setDoc(doc(db,path),payload));
  assert.equal((await getDoc(doc(db,path))).data().pockets,payload.pockets);
  await assertFails(getDoc(doc(foreign,path))); await assertFails(getDoc(doc(anon,path)));
  await assertFails(setDoc(doc(foreign,path),{...payload,revision:2}));
  await assertFails(setDoc(doc(db,path),payload));
  await assertFails(setDoc(doc(db,path),{...payload,revision:3}));
  await assertFails(setDoc(doc(db,path),{...payload,revision:2,ownerUid:bob}));
  await assertFails(setDoc(doc(db,path),{...payload,revision:2,privateExtra:'no'}));
  await assertFails(setDoc(doc(db,path),{...payload,revision:2,pockets:[]}));
  await assertFails(setDoc(doc(db,path),{...payload,revision:2,pockets:'x'.repeat(350001)}));
  await assertSucceeds(setDoc(doc(db,path),{...payload,revision:2}));
  await assertFails(getDocs(collection(db,`users/${alice}/binders`)));
  await assertFails(deleteDoc(doc(db,path)));
  await assertFails(setDoc(doc(db,`users/${alice}/binders/other`),payload));
  assert.deepEqual((await getDoc(doc(db,`users/${alice}`))).data().progress,fixture.progress);
 }finally{await env.cleanup();}
});

test('Wishlist writes remain owner-only, revision-checked and isolated from binder/legacy data', async () => {
 const env=await environment('firestore.private.rules');
 try {
  await seed(env);
  const db=env.authenticatedContext(alice).firestore();
  const other=env.authenticatedContext(bob).firestore();
  const anonymous=env.unauthenticatedContext().firestore();
  const target=doc(db,'users',alice,'wishlists','main');
  const payload=(revision, ids)=>({schemaVersion:1,ownerUid:alice,revision,ids,updatedAt:serverTimestamp()});
  await assertFails(getDoc(doc(other,'users',alice,'wishlists','main')));
  await assertFails(getDoc(doc(anonymous,'users',alice,'wishlists','main')));
  await assertFails(getDocs(collection(db,'users',alice,'wishlists')));
  await assertFails(setDoc(doc(other,'users',alice,'wishlists','main'),payload(1,'base3-5')));
  await assertFails(setDoc(doc(db,'users',alice,'wishlists','another'),payload(1,'base3-5')));
  await assertSucceeds(setDoc(target,payload(1,'base3-5;neo2-13')));
  await assertFails(setDoc(target,payload(1,'basep-9')));
  await assertFails(setDoc(target,payload(3,'basep-9')));
  await assertFails(setDoc(target,payload(2,'basep-9;invalid')));
  await assertFails(setDoc(target,{...payload(2,'basep-9'),ownerUid:bob}));
  await assertFails(setDoc(target,{...payload(2,'basep-9'),unexpected:true}));
  await assertFails(deleteDoc(target));
  await assertSucceeds(setDoc(target,payload(2,'neo2-13;base3-5')));
  assert.equal((await getDoc(target)).data().ids,'neo2-13;base3-5');
  await env.withSecurityRulesDisabled(async context => {
    const root=(await getDoc(doc(context.firestore(),'users',alice))).data();
    assert.deepEqual(root.progress,fixture.progress);
    assert.equal((await getDoc(doc(context.firestore(),'users',alice,'binders','main'))).exists(),false);
  });
 } finally { await env.cleanup(); }
});


test('21-record imported correction uses a single auditable atomic revision, with every member verified', async()=>{
 const env=await environment('firestore.private.rules');
 try {
  await env.clearFirestore();
  const db=env.authenticatedContext(alice).firestore();
  const other=env.authenticatedContext(bob).firestore();
  const stamp='2026-11-23T00:00:00Z', updated='2026-11-24T00:00:00Z';
  const metadata={schemaVersion:1,ownerUid:alice,revision:1,createdAt:stamp,updatedAt:stamp};
  const purchase={...metadata,id:'grouped-purchase',kind:'purchase',shipping:0};
  const copies=Array.from({length:20},(_,i)=>({...metadata,id:`grouped-copy-${i}`,shippingCost:0,acquiredOn:'2026-10-20'}));
  const path=record=>`users/${alice}/${record.kind==='purchase'?'transactions':'copies'}/${record.id}`;
  const envelope=(record,auditId=null)=>({record,auditId,committedAt:serverTimestamp()});
  const originals=[purchase,...copies];
  const initial=writeBatch(db);
  for(const record of originals)initial.set(doc(db,path(record)),envelope(record));
  await assertSucceeds(initial.commit());
  const changes=originals.map(record=>({
   before:record,after:{...record,revision:2,updatedAt:updated,
    ...(record.kind==='purchase'?{shipping:1240}:{shippingCost:62})},
  }));
  const batchId='grouped-audit';
  const audit={...metadata,id:batchId,actorUid:alice,recordId:purchase.id,
   before:changes[0].before,after:changes[0].after,
   additional:Object.fromEntries(changes.slice(1).map(({before,after})=>[before.id,{before,after}])),
   operation:'edit',reason:'Synthetic grouped shipping correction'};
  const correction=writeBatch(db);
  correction.set(doc(db,`users/${alice}/revisions/${batchId}`),envelope(audit));
  for(const change of changes)correction.set(doc(db,path(change.before)),envelope(change.after,batchId));
  correction.set(doc(db,`users/${alice}/receipts/grouped-receipt`),{fingerprint:'synthetic-grouped',committedAt:serverTimestamp()});
  await assertSucceeds(correction.commit());
  for(const {after} of changes)assert.deepEqual((await getDoc(doc(db,path(after)))).data().record,after);
  // A malicious bundle cannot authorize an update whose before/after differs.
  const wrong=writeBatch(db),original=copies[0];
  const counterfeit={...original,revision:3,updatedAt:'2026-11-25T00:00:00Z',shippingCost:999};
  const audit2={...metadata,id:'grouped-audit-wrong',actorUid:alice,recordId:purchase.id,
   before:changes[0].after,after:{...changes[0].after,revision:3,updatedAt:'2026-11-25T00:00:00Z'},
   additional:{[original.id]:{before:changes[1].after,after:{...counterfeit,shippingCost:998}}},
   operation:'edit',reason:'Synthetic rejected altered snapshot'};
  wrong.set(doc(db,`users/${alice}/revisions/grouped-audit-wrong`),envelope(audit2));
  wrong.set(doc(db,path(original)),envelope(counterfeit,'grouped-audit-wrong'));
  await assertFails(wrong.commit());
  assert.equal((await getDoc(doc(db,path(original)))).data().record.shippingCost,62);
  await assertFails(getDoc(doc(other,path(original))));
 }finally{await env.cleanup();}
});

test('purchase automation preference is owner-only and strictly boolean',async()=>{
 const env=await environment('firestore.private.rules');
 try {
  await seed(env);
  const db=env.authenticatedContext(alice).firestore();
  const foreign=env.authenticatedContext(bob).firestore();
  const anon=env.unauthenticatedContext().firestore();
  const path=`users/${alice}/preferences/purchases`;
  const payload=autoFulfillWishlist=>({autoFulfillWishlist,updatedAt:serverTimestamp()});
  await assertSucceeds(getDoc(doc(db,path)));
  await assertSucceeds(setDoc(doc(db,path),payload(true)));
  await assertSucceeds(setDoc(doc(db,path),payload(false)));
  for(const client of [foreign,anon]){
   await assertFails(getDoc(doc(client,path)));
   await assertFails(setDoc(doc(client,path),payload(true)));
  }
  await assertFails(setDoc(doc(db,path),payload('true')));
  await assertFails(setDoc(doc(db,path),{...payload(true),extra:true}));
  await assertFails(setDoc(doc(db,path),{updatedAt:serverTimestamp()}));
  await assertFails(deleteDoc(doc(db,path)));
 } finally { await env.cleanup(); }
});
