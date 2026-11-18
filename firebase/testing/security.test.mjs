import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp} from 'firebase/firestore';

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
test('deployed deny-all bootstrap rejects both synthetic users and anonymous clients',async t=>{
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

test('private application candidate preserves legacy data and isolates owners',async t=>{
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
