// Fail-closed bootstrap: Issue #2 will provide a separate staging configuration.
// Never inherit or connect to Vintage Binder's production backends.
(() => {
 'use strict';
 const input=window.PokefolioRuntimeConfig||{};
 const candidate=input.firebase;
 const project=String(candidate?.projectId||'').trim();
 const authDomain=String(candidate?.authDomain||'').trim();
 const firebaseConfig=project&&project!=='pokemon-vintage-binder'&&
  authDomain===project+'.firebaseapp.com'&&
  typeof candidate.apiKey==='string'&&candidate.apiKey.length>0&&
  typeof candidate.appId==='string'&&candidate.appId.length>0
   ? Object.freeze({...candidate}):null;
 let workerUrl='';
 try{
  const url=new URL(String(input.workerUrl||''));
  if(url.protocol==='https:'&&url.hostname.endsWith('.workers.dev')&&
     url.hostname!=='pokemon-vintage-ebay-deals.xfayne.workers.dev'&&
     !url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/')
   workerUrl=url.origin;
 }catch(_){}
 Object.defineProperty(window,'PokefolioEnvironment',{
  value:Object.freeze({firebaseConfig,workerUrl}),writable:false,configurable:false
 });
})();
