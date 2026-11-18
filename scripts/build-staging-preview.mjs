import {readFileSync, writeFileSync, mkdirSync, readdirSync, lstatSync, copyFileSync} from 'node:fs';
import {resolve, join, relative, dirname, extname, sep, isAbsolute} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const PROJECT='pokefolio-staging';
export const APP_ID='1:403637067452:web:ea6738aebf38f14c637ab9';
export function validateWebConfig(input) {
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).sort().join(',')!=='apiKey,appId,authDomain,projectId'||
    input.projectId!==PROJECT||input.authDomain!==PROJECT+'.firebaseapp.com'||
    input.appId!==APP_ID||typeof input.apiKey!=='string'||!/^AIza[A-Za-z0-9_-]{35}$/.test(input.apiKey))
  throw Error('Only the registered Pokefolio staging Web configuration is accepted.');
 return {apiKey:input.apiKey,projectId:PROJECT,authDomain:PROJECT+'.firebaseapp.com',appId:APP_ID};
}
export function buildPreview({sourceRoot=projectRoot,outputRoot=join(projectRoot,'dist','pokefolio-staging'),firebaseConfig,sourceSha='local'}={}) {
 const config=validateWebConfig(firebaseConfig);
 if(sourceSha!=='local'&&!/^[a-f0-9]{40}$/.test(sourceSha))throw Error('Invalid source commit.');
 sourceRoot=resolve(sourceRoot);outputRoot=resolve(outputRoot);
 const outputRelative=relative(sourceRoot,outputRoot);
 if(!outputRelative||isAbsolute(outputRelative)||outputRelative==='..'||outputRelative.startsWith('..'+sep)||resolve(sourceRoot,outputRelative)!==outputRoot)
  throw Error('Preview output must be a new directory inside the source workspace.');
 const indexStat=lstatSync(join(sourceRoot,'index.html'));
 if(indexStat.isSymbolicLink()||indexStat.nlink>1)throw Error('Preview index must not be a symbolic or hard link.');
 const html=readFileSync(join(sourceRoot,'index.html'),'utf8');
 const gate=/<script\s+src="js\/pokefolio-environment\.js(?:\?[^"]*)?"><\/script>/g;
 const matches=[...html.matchAll(gate)];
 if(matches.length!==1||!/<body(?:\s[^>]*)?>/.test(html))throw Error('Expected one runtime safety gate and body in generated index.');
 const planned=[];
 const allowed=new Set(['.js','.css','.jpg','.jpeg','.png','.webp','.gif','.svg','.ico','.woff','.woff2']);
 function inspect(localPath) {
  if(localPath.split(/[\\/]/).some(part=>part.startsWith('.')))return;
  const absolute=join(sourceRoot,localPath),stat=lstatSync(absolute);
  if(stat.isSymbolicLink())throw Error('Preview assets must not contain symbolic links.');
  if(stat.isDirectory()){
   for(const entry of readdirSync(absolute))inspect(join(localPath,entry));
  }else if(stat.isFile()&&allowed.has(extname(localPath).toLowerCase())){
   if(stat.nlink>1)throw Error('Preview assets must not contain hard links.');
   planned.push(localPath);
  }
 }
 for(const dir of ['js','css','assets','deal-finder'])inspect(dir);
 if(!planned.includes(join('js','pokefolio-environment.js')))throw Error('Runtime gate asset is missing.');
 // Existing output is never deleted or reused; stale files must not enter an artifact.
 mkdirSync(dirname(outputRoot),{recursive:true});
 mkdirSync(outputRoot);
 for(const path of planned){const target=join(outputRoot,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(sourceRoot,path),target);}
 const marker='<aside data-pokefolio-staging="true" style="direction:ltr;text-align:center;padding:6px;background:#17334d;color:#fff;font:12px system-ui">Pokefolio · Staging · Test environment</aside>';
 let preview=html.replace(matches[0][0],'<script src="pokefolio-runtime-config.js"></script>\n'+matches[0][0]);
 preview=preview.replace(/<body(?:\s[^>]*)?>/,body=>body+'\n'+marker);
 preview=preview.replace(/<title>[^<]*<\/title>/,'<title>Pokefolio — Staging</title>');
 writeFileSync(join(outputRoot,'index.html'),preview);
 writeFileSync(join(outputRoot,'pokefolio-runtime-config.js'),
  '// Public Firebase Web configuration. No provider secrets or user data.\nwindow.PokefolioRuntimeConfig=Object.freeze('+JSON.stringify({firebase:config,workerUrl:''})+');\n');
 writeFileSync(join(outputRoot,'pokefolio-staging-manifest.json'),JSON.stringify({
  environment:'staging',repository:'xfayne/pokefolio',sourceSha,firebaseProjectId:PROJECT,firebaseEnabled:true,workerEnabled:false
 },null,2)+'\n');
 writeFileSync(join(outputRoot,'.nojekyll'),'');
 return {outputRoot,assetCount:planned.length,firebaseProjectId:PROJECT,workerEnabled:false};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
 try {
  const result=buildPreview({firebaseConfig:JSON.parse(process.env.POKEFOLIO_FIREBASE_WEB_CONFIG||'null'),sourceSha:process.env.GITHUB_SHA||'local'});
  console.log(JSON.stringify(result));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
