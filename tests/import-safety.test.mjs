import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(path,'utf8');
const bootstrap=read('js/pokefolio-environment.js');
function environment(config){
 const sandbox={window:{PokefolioRuntimeConfig:config},URL};
 vm.runInNewContext(bootstrap,sandbox);
 return sandbox.window.PokefolioEnvironment;
}
const isolated={
 firebase:{apiKey:'test-only',projectId:'pokefolio-staging',authDomain:'pokefolio-staging.firebaseapp.com',appId:'test-only'},
 workerUrl:'https://pokefolio-api-staging.xfayne.workers.dev'
};
test('empty runtime configuration disables cloud and worker access',()=>{
 const result=environment(undefined);
 assert.equal(result.firebaseConfig,null);
 assert.equal(result.workerUrl,'');
});
test('legacy Firebase and Cloudflare production settings are always rejected',()=>{
 const result=environment({
  firebase:{...isolated.firebase,projectId:'pokemon-vintage-binder',authDomain:'pokemon-vintage-binder.firebaseapp.com'},
  workerUrl:'https://pokemon-vintage-ebay-deals.xfayne.workers.dev'
 });
 assert.equal(result.firebaseConfig,null);
 assert.equal(result.workerUrl,'');
 assert.equal(environment({firebase:{...isolated.firebase,authDomain:'pokemon-vintage-binder.firebaseapp.com'}}).firebaseConfig,null);
});
test('independent staging settings can be enabled after Issue #2',()=>{
 const result=environment(isolated);
 assert.equal(result.firebaseConfig.projectId,'pokefolio-staging');
 assert.equal(result.workerUrl,'https://pokefolio-api-staging.xfayne.workers.dev');
 assert.ok(Object.isFrozen(result));
});
test('entry page loads the safety gate before any legacy controller',()=>{
 const template=read('templates/index.template.html');
 const environmentPos=template.indexOf('js/pokefolio-environment.js');
 assert.ok(environmentPos>0);
 for(const filename of ['js/shipments.js','js/firebase-cloud.js','deal-finder/live.js','js/condition-analysis-page.js']){
  assert.ok(environmentPos<template.indexOf(filename),filename+' is loaded before the safety gate');
 }
});
test('browser integrations contain no hardcoded production endpoints or production Firebase keys',()=>{
 const cloud=read('js/firebase-cloud.js');
 assert.match(cloud,/window\.PokefolioEnvironment\?\.firebaseConfig/);
 assert.doesNotMatch(cloud,/apiKey:\s*['"]AIza/);
 assert.doesNotMatch(cloud,/localStorage\.removeItem\(/);
 for(const path of ['js/shipments.js','deal-finder/live.js','js/condition-analysis-page.js']){
  const code=read(path);
  assert.match(code,/window\.PokefolioEnvironment\?\.workerUrl/);
  assert.doesNotMatch(code,/pokemon-vintage-ebay-deals\.xfayne\.workers\.dev/);
 }
});
test('copied Worker cannot deploy over production or accept legacy signed tokens',()=>{
 const config=read('ebay-worker/wrangler.toml');
 assert.match(config,/name\s*=\s*"pokefolio-api-staging"/);
 assert.match(config,/workers_dev\s*=\s*false/);
 assert.doesNotMatch(config,/name\s*=\s*"pokemon-vintage-ebay-deals"/);
 const worker=read('ebay-worker/index.js');
 assert.match(worker,/POKEFOLIO_FIREBASE_PROJECT_ID/);
 assert.doesNotMatch(worker,/const FIREBASE_PROJECT\s*=\s*['"]pokemon-vintage-binder/);
});

test('unrelated Firebase projects and Worker endpoints are rejected',()=>{
 for(const projectId of ['unrelated-project','pokefolio-production','pokefolio-staging-copy']){
  assert.equal(environment({firebase:{...isolated.firebase,projectId,authDomain:projectId+'.firebaseapp.com'}}).firebaseConfig,null);
 }
 for(const workerUrl of [
  'https://other.workers.dev','https://pokefolio-api-staging.other.workers.dev',
  'https://pokefolio-api-staging.xfayne.workers.dev:8443',
  'https://user@pokefolio-api-staging.xfayne.workers.dev',
  'https://pokefolio-api-staging.xfayne.workers.dev/api',
  'https://pokefolio-api-staging.xfayne.workers.dev/?redirect=production'
 ])assert.equal(environment({workerUrl}).workerUrl,'',workerUrl);
});
test('validated Firebase settings are canonical, immutable and omit alternate service endpoints',()=>{
 const result=environment({firebase:{...isolated.firebase,databaseURL:'https://foreign.example',storageBucket:'foreign-bucket'}});
 assert.equal(result.firebaseConfig.projectId,'pokefolio-staging');
 assert.equal(result.firebaseConfig.databaseURL,undefined);
 assert.equal(result.firebaseConfig.storageBucket,undefined);
 assert.ok(Object.isFrozen(result.firebaseConfig));
});
