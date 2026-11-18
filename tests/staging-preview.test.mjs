import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import vm from 'node:vm';
import {buildPreview,validateWebConfig,APP_ID} from '../scripts/build-staging-preview.mjs';
import {verifySource,REQUIRED_CHECKS} from '../scripts/verify-staging-source.mjs';

const config={apiKey:'AIza'+'x'.repeat(35),projectId:'pokefolio-staging',authDomain:'pokefolio-staging.firebaseapp.com',appId:APP_ID};
const sha='a'.repeat(40);
const source=()=>({repository:'xfayne/pokefolio',ref:'refs/heads/main',sha,branchHead:sha,
 checks:REQUIRED_CHECKS.map(name=>({name,head_sha:sha,status:'completed',conclusion:'success',app:{id:15368}}))});
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'pokefolio-preview-test-'));
 t.after(()=>{
  const child=relative(resolve(tmpdir()),resolve(root));
  if(!child||child==='..'||child.startsWith('..'+sep)||isAbsolute(child))throw Error('Unsafe test cleanup path.');
  rmSync(root,{recursive:true,force:true});
 });
 for(const folder of ['js','css','assets','deal-finder','ebay-worker','docs'])mkdirSync(join(root,folder));
 writeFileSync(join(root,'index.html'),'<html><head><title>Legacy baseline</title></head><body><script src="js/pokefolio-environment.js?v=1"></script></body></html>');
 for(const [file,value] of Object.entries({
  'js/pokefolio-environment.js':'window.gate=true;','css/app.css':'body{}','assets/card.jpg':'synthetic-image',
  'deal-finder/live.js':'window.deals=true;','.env':'PRIVATE_SENTINEL','ebay-worker/index.js':'PRIVATE_SENTINEL',
  'docs/private.json':'PRIVATE_SENTINEL','js/.hidden.js':'PRIVATE_SENTINEL'
 }))writeFileSync(join(root,file),value);
 return root;
}
test('preview includes only frontend assets and loads validated runtime config before the gate',t=>{
 const root=fixture(t),output=join(root,'dist','preview');
 const before=readFileSync(join(root,'index.html'),'utf8');
 const result=buildPreview({sourceRoot:root,outputRoot:output,firebaseConfig:config,sourceSha:sha});
 const html=readFileSync(join(output,'index.html'),'utf8');
 assert.ok(html.indexOf('pokefolio-runtime-config.js')<html.indexOf('js/pokefolio-environment.js'));
 assert.match(html,/Pokefolio — Staging/);assert.match(html,/data-pokefolio-staging/);
 assert.equal(readFileSync(join(root,'index.html'),'utf8'),before);
 const sandbox={window:{}};vm.runInNewContext(readFileSync(join(output,'pokefolio-runtime-config.js'),'utf8'),sandbox);
 assert.equal(sandbox.window.PokefolioRuntimeConfig.firebase.projectId,'pokefolio-staging');
 assert.equal(sandbox.window.PokefolioRuntimeConfig.workerUrl,'');
 for(const path of ['.env','docs','ebay-worker','firebase','js/.hidden.js'])assert.equal(existsSync(join(output,path)),false,path);
 const manifest=JSON.parse(readFileSync(join(output,'pokefolio-staging-manifest.json'),'utf8'));
 assert.equal(manifest.sourceSha,sha);assert.equal(manifest.workerEnabled,false);
 assert.equal(JSON.stringify(manifest).includes(config.apiKey),false);
 assert.equal(result.assetCount,4);
});
test('wrong project, app, domain, provider secrets or malformed public keys cannot be packaged',t=>{
 const root=fixture(t);
 for(const invalid of [
  undefined,{...config,projectId:'pokemon-vintage-binder'},
  {...config,authDomain:'pokemon-vintage-binder.firebaseapp.com'},
  {...config,appId:'other-app'},{...config,apiKey:'invalid'},
  {...config,EBAY_CLIENT_SECRET:'PRIVATE_SENTINEL'}, {...config,storageBucket:'foreign'}
 ])assert.throws(()=>buildPreview({sourceRoot:root,outputRoot:join(root,'dist','rejected'),firebaseConfig:invalid}));
 assert.equal(existsSync(join(root,'dist','rejected')),false);
});
test('existing output is not reused or deleted and output cannot escape the workspace',t=>{
 const root=fixture(t),output=join(root,'dist','preview');
 buildPreview({sourceRoot:root,outputRoot:output,firebaseConfig:config});
 writeFileSync(join(output,'keep.txt'),'retain-me');
 assert.throws(()=>buildPreview({sourceRoot:root,outputRoot:output,firebaseConfig:config}));
 assert.equal(readFileSync(join(output,'keep.txt'),'utf8'),'retain-me');
 assert.throws(()=>buildPreview({sourceRoot:root,outputRoot:resolve(root,'..','escape'),firebaseConfig:config}));
});
test('missing or duplicate gates and invalid commit IDs fail before output creation',t=>{
 const root=fixture(t),path=join(root,'index.html'),original=readFileSync(path,'utf8');
 for(const html of ['<body></body>',original+original]){
  writeFileSync(path,html);
  assert.throws(()=>buildPreview({sourceRoot:root,outputRoot:join(root,'dist','rejected'),firebaseConfig:config}));
 }
 writeFileSync(path,original);
 assert.throws(()=>buildPreview({sourceRoot:root,outputRoot:join(root,'dist','rejected'),firebaseConfig:config,sourceSha:'not-a-commit'}));
});
test('only a current main commit with all four successful Actions checks is deployable',()=>{
 assert.equal(verifySource(source()),true);
 for(const override of [
  {repository:'xfayne/pokemon-vintage-binder'},{ref:'refs/heads/feature'},
  {branchHead:'b'.repeat(40)},{sha:'bad'},{checks:[]},
  {checks:source().checks.slice(1)},
  {checks:source().checks.map(c=>({...c,app:{id:999}}))},
  {checks:source().checks.map(c=>({...c,head_sha:'b'.repeat(40)}))},
  {checks:source().checks.map(c=>({...c,status:'in_progress',conclusion:null}))},
  {checks:source().checks.map(c=>({...c,conclusion:'failure'}))}
 ])assert.throws(()=>verifySource({...source(),...override}));
});
