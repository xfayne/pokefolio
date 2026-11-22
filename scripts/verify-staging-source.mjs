import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const REQUIRED_CHECKS=['staging-isolation','javascript-parity','style-parity','firestore-rules','react-foundation'];
export function verifySource({repository,ref,sha,branchHead,checks}) {
 if(repository!=='xfayne/pokefolio'||ref!=='refs/heads/main'||!(/^[a-f0-9]{40}$/).test(sha)||branchHead!==sha)
  throw Error('Only the current Pokefolio main commit can be deployed.');
 for(const name of REQUIRED_CHECKS) {
  const runs=checks.filter(check=>check.name===name&&check.app?.id===15368);
  if(!runs.length||runs.some(check=>check.head_sha!==sha||check.status!=='completed'||check.conclusion!=='success'))
   throw Error('Required GitHub Actions check is missing or not successful: '+name);
 }
 return true;
}
export async function checkCurrentSource(env=process.env) {
 const {GITHUB_REPOSITORY:repository,GITHUB_REF:ref,GITHUB_SHA:sha,GITHUB_TOKEN:token}=env;
 if(repository!=='xfayne/pokefolio'||ref!=='refs/heads/main'||!(/^[a-f0-9]{40}$/).test(sha)||!token)
  throw Error('Staging deployment requires authenticated Pokefolio main workflow context.');
 async function get(path){
  const response=await fetch('https://api.github.com/repos/xfayne/pokefolio/'+path,{
   headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'}
  });
  if(!response.ok)throw Error('GitHub verification failed: HTTP '+response.status);
  return response.json();
 }
 for(let attempt=0;attempt<36;attempt++) {
  const [branch,checks]=await Promise.all([get('branches/main'),get('commits/'+sha+'/check-runs?filter=latest&per_page=100')]);
  if(branch.commit?.sha!==sha)throw Error('Main advanced; refusing an outdated deployment.');
  const runs=checks.check_runs||[];
  if(REQUIRED_CHECKS.some(name=>runs.some(check=>check.name===name&&check.app?.id===15368&&check.status==='completed'&&check.conclusion!=='success')))
   throw Error('A required current-main check failed.');
  try { verifySource({repository,ref,sha,branchHead:branch.commit?.sha,checks:runs}); console.log('Verified current protected main and all five required checks.'); return; }
  catch(error) { if(attempt===35)throw error; }
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{await checkCurrentSource();}catch(error){console.error(error.message);process.exitCode=1;}
}
