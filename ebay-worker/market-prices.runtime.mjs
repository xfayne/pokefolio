import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const dir=await mkdtemp(join(tmpdir(),'pokefolio-price-runtime-'));
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'runtime-key',alg:'RS256',use:'sig'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const seconds=Math.floor(Date.now()/1000);
const signed=`${encode({alg:'RS256',kid:'runtime-key'})}.${encode({aud:'pokefolio-staging',iss:'https://securetoken.google.com/pokefolio-staging',sub:'runtime-owner',email:'owner@example.test',email_verified:true,iat:seconds,auth_time:seconds,exp:seconds+3600})}`;
const token=`${signed}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(signed))).toString('base64url')}`;
const modules=await Promise.all(['index.js','card-condition.js','standalone-condition.js','market-prices.js','price-service.js','worker-entry.js'].map(async name=>({type:'ESModule',path:join(root,name),contents:await readFile(join(root,name),'utf8')})));
modules.unshift({type:'ESModule',path:join(root,'runtime-entry.js'),contents:`
import worker,{PriceCoordinator} from './worker-entry.js';
export {PriceCoordinator};
export default {async fetch(request,env){
 if(new URL(request.url).pathname!=='/runtime')return worker.fetch(request,env);
 return Response.json(await env.PRICE_COORDINATOR.getByName('runtime').load(await request.json()));
}};`});
let upstreamCalls=0;
const ts=Math.floor(Date.now()/1000)-10;
const upstream=async request=>{
 if(request.url==='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')return Response.json({keys:[jwk]});
 assert.equal(request.url,'https://api.justtcg.com/v1/cards');upstreamCalls++;assert.equal(upstreamCalls,1);return Response.json({data:[{tcgplayerId:'106521',variants:[{condition:'Lightly Played',printing:'Unlimited Holofoil',language:'English',price:12.34,priceStatus:'current',lastUpdated:ts,priceHistory:[{p:12.34,t:ts}]}]}]});
};
const options=convertV4MiniflareOptions({name:'market-runtime',modules,compatibilityDate:'2026-11-06',kvNamespaces:['MARKET_CACHE'],durableObjects:{PRICE_COORDINATOR:{className:'PriceCoordinator',useSQLite:true}},bindings:{JUSTTCG_API_KEY:'runtime-fake-secret',ALLOWED_ORIGIN:'https://xfayne.github.io',POKEFOLIO_FIREBASE_PROJECT_ID:'pokefolio-staging',TRACK17_OWNER_EMAIL:'owner@example.test'},resourcePersistencePath:join(dir,'persist'),outboundService:upstream});
let mf;
try {
 mf=new Miniflare(options);
 const load=()=>mf.dispatchFetch('http://test/runtime',{method:'POST',body:JSON.stringify({products:['106521'],period:'1y'})}).then(r=>r.json());
 const [a,b]=await Promise.all([load(),load()]);
 assert.equal(a.entries[0].variants[0].current,1234);assert.deepEqual(a,b);
 assert.equal(upstreamCalls,1);
 const denied=await mf.dispatchFetch('http://test/api/market/prices',{method:'POST',headers:{origin:'https://xfayne.github.io'},body:'{}'});
 assert.equal(denied.status,403);
 const response=await mf.dispatchFetch('http://test/api/market/prices',{method:'POST',headers:{origin:'https://xfayne.github.io',authorization:`Bearer ${token}`},body:JSON.stringify({products:['106521'],period:'1y'})});
 assert.equal(response.status,200);
 const value=await response.json();assert.equal(value.results[0].cache,'fresh');assert.equal(value.results[0].data.variants[0].current,1234);
 assert.equal(upstreamCalls,1);
 await mf.dispose();
 mf=new Miniflare(options);
 const persisted=await load();assert.equal(persisted.entries[0].variants[0].current,1234);
 console.log('Workers runtime: RPC, SQLite reservation/mirror, KV, concurrent misses, auth gate and restart passed.');
} finally {if(mf)await mf.dispose();await rm(dir,{recursive:true,force:true});}
