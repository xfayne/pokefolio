import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

const read=path=>readFileSync(path,'utf8');
test('staging Firestore bootstrap denies all access by default',()=>{
 const rules=read('firebase/firestore.rules');
 assert.match(rules,/rules_version\s*=\s*'2'/);
 assert.match(rules,/match\s*\/\{document=\*\*\}/);
 assert.match(rules,/allow\s+read,\s*write:\s*if\s+false\s*;/);
 assert.equal((rules.match(/\ballow\b/g)||[]).length,1,'No other access grants are allowed in bootstrap rules');
});
test('copied Worker is not configured to deploy to production',()=>{
 const config=read('ebay-worker/wrangler.toml');
 assert.match(config,/^name\s*=\s*"pokefolio-api-staging"\s*$/m);
 assert.match(config,/^workers_dev\s*=\s*true\s*$/m);
 assert.match(config,/^ALLOWED_ORIGIN\s*=\s*"https:\/\/xfayne\.github\.io"\s*$/m);
 assert.match(config,/^preview_urls\s*=\s*false\s*$/m);
 assert.match(config,/^TRACK17_MUTATIONS_ENABLED\s*=\s*"false"\s*$/m);
 assert.doesNotMatch(config,/^kv_namespaces\s*=/m);
 assert.doesNotMatch(config,/^route\s*=/m);
 const worker=read('ebay-worker/index.js');
 assert.match(worker,/POKEFOLIO_FIREBASE_PROJECT_ID/);
 assert.match(worker,/id===\s*'pokefolio-staging'/);
});
test('CI contains no backend deployment or cloud mutation commands',()=>{
 const paths=readdirSync('.github/workflows').filter(path=>/\.ya?ml$/.test(path));
 assert.ok(paths.length>0,'No CI workflows found');
 for(const file of paths){
  const body=read(join('.github/workflows',file));
  assert.doesNotMatch(body,/\bwrangler\s+(deploy|secret\s+put|kv\s+namespace\s+create)\b/i,file);
  assert.doesNotMatch(body,/\bfirebase\s+deploy\b/i,file);
  assert.doesNotMatch(body,/\bgh-pages\s+-d\b/i,file);
  assert.doesNotMatch(body,/\bcloudflare\/wrangler-action\b/i,file);
 }
});

test('Pages staging deployment trusts only manual main or completed main push CI and verifies source before packaging',()=>{
 const workflow=read('.github/workflows/staging-preview.yml');
 assert.match(workflow,/on:\s*\n\s+workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^\s+(push|pull_request|pull_request_target|schedule):/m);
 assert.match(workflow,/github\.repository == 'xfayne\/pokefolio' && github\.ref == 'refs\/heads\/main'/);
 assert.ok(workflow.indexOf('node scripts/verify-staging-source.mjs')<workflow.indexOf('node scripts/build-staging-preview.mjs'));
 assert.match(workflow,/name: pokefolio-staging/);
 assert.match(workflow,/workflow_run:/);
 assert.match(workflow,/workflows: \[Main UI JavaScript Parity\]/);
 assert.ok(workflow.includes("github.event.workflow_run.event == 'push'"));
 assert.ok(workflow.includes("github.event.workflow_run.conclusion == 'success'"));
 assert.ok(workflow.includes("github.event.workflow_run.head_repository.full_name == 'xfayne/pokefolio'"));
 assert.ok(workflow.includes('github.event.workflow_run.head_sha == github.sha'));

 assert.match(workflow,/vars\.POKEFOLIO_FIREBASE_WEB_CONFIG/);
 assert.doesNotMatch(workflow,/secrets\.(EBAY|TRACK17|GEMINI|FIREBASE_ADMIN|GOOGLE_APPLICATION)/);
});
