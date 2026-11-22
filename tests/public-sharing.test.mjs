import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('js/firebase-cloud.js','utf8');
const section=source.slice(source.indexOf('// Public projection codec:'),source.indexOf('// End public projection codec.'));
const context={};vm.runInNewContext(section+';this.encode=encodePublicPockets;this.decode=decodePublicPockets;',context);
test('public projection preserves positions, empty pockets and kinds without private metadata',()=>{
 const cards=[{id:'base1-1',kind:'owned',notes:'private',price:100},null,{id:'base2-3',kind:'wish'},{id:'movie2000-ancient-mew',kind:'pending'}];
 const encoded=context.encode(cards);
 assert.equal(encoded,'o:base1-1;_;w:base2-3;p:movie2000-ancient-mew');
 assert.deepEqual(JSON.parse(JSON.stringify(context.decode(encoded))),cards.map(c=>c?{id:c.id,kind:c.kind}:null));
 assert.equal(context.encode([]),'');assert.equal(context.decode('').length,0);
 const full=Array.from({length:1252},(_,i)=>i%2?null:{id:'neo4-113',kind:'owned'});
 assert.deepEqual(JSON.parse(JSON.stringify(context.decode(context.encode(full)))),full);
});
test('malformed, private and over-capacity projection data is rejected',()=>{
 for(const value of ['email@example.com','x:base1-1','o:base1-1;','o:base1-1;\\n_','o:private-notes','_;'.repeat(1252)+'_',[],null])
  assert.throws(()=>context.decode(value));
 for(const cards of [[{id:'notes',kind:'owned'}],[{id:'base1-1',kind:'admin'}],Array(1253).fill(null)])
  assert.throws(()=>context.encode(cards));
});
test('publication atomically commits the opt-in and public snapshot; reader requires schema v2',()=>{
 assert.match(source,/const batch=sdk.writeBatch\(db\)/);
 assert.match(source,/batch.set\(shareSettingsRef\(\)/);
 assert.match(source,/await batch.commit\(\)/);
 assert.match(source,/decodePublicPockets\(data.pockets\)/);
 assert.match(source,/data.schemaVersion!==2/);
});
