// Fail-closed bootstrap: Issue #2 will provide a separate staging configuration.
// Never inherit or connect to Vintage Binder's production backends.
(() => {
 'use strict';
 const input=window.PokefolioRuntimeConfig||{};
 const candidate=input.firebase;
 const project=String(candidate?.projectId||'').trim();
 const authDomain=String(candidate?.authDomain||'').trim();
 const firebaseConfig=project==='pokefolio-staging'&&
  authDomain===project+'.firebaseapp.com'&&
  typeof candidate.apiKey==='string'&&candidate.apiKey.length>0&&
  typeof candidate.appId==='string'&&candidate.appId.length>0
   ? Object.freeze({apiKey:candidate.apiKey,projectId:project,authDomain,appId:candidate.appId}):null;
 let workerUrl='';
 try{
  const url=new URL(String(input.workerUrl||''));
  if(url.origin==='https://pokefolio-ebay-deals-staging.xfayne.workers.dev'&&
     !url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/')
   workerUrl=url.origin;
 }catch(_){}
 Object.defineProperty(window,'PokefolioEnvironment',{
  value:Object.freeze({firebaseConfig,workerUrl}),writable:false,configurable:false
 });
})();
