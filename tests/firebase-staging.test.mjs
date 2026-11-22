import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bootstrapArguments, run } from '../scripts/firebase-staging.mjs';

const config = JSON.parse(readFileSync('firebase/staging.json', 'utf8'));
const rules = readFileSync('firebase/firestore.rules', 'utf8');

test('bootstrap pins the independent project and deploys only deny-all Firestore rules', () => {
  const args = bootstrapArguments('pokefolio-staging', config, rules);
  assert.equal(args[args.indexOf('--project') + 1], 'pokefolio-staging');
  assert.equal(args[args.indexOf('--only') + 1], 'firestore:rules');
  assert.ok(args.includes('--non-interactive'));
  assert.equal(args.includes('--force'), false);
});
test('production, unknown and malformed project targets are rejected', () => {
  for (const id of ['pokemon-vintage-binder', '', 'other-project', 'pokefolio-staging ', undefined])
    assert.throws(() => bootstrapArguments(id, config, rules));
});
test('other databases, rule files, Auth and hosting deployment configuration are rejected', () => {
  for (const bad of [
    { firestore: { database: 'production', rules: 'firestore.rules' } },
    { firestore: { database: '(default)', rules: '../production.rules' } },
    { ...config, hosting: { public: '..' } },
    { ...config, auth: { providers: { anonymous: true } } }
  ]) assert.throws(() => bootstrapArguments('pokefolio-staging', bad, rules));
});
test('access grants and additional match blocks cannot be deployed through bootstrap', () => {
  for (const bad of [
    rules.replace('if false', 'if true'),
    rules.replace('if false', 'if request.auth != null'),
    rules + '\nmatch /users/{uid} { allow read: if true; }',
    rules.replace('allow read, write: if false;', 'allow read: if false;')
  ]) assert.throws(() => bootstrapArguments('pokefolio-staging', config, bad));
});
test('caller cannot inject project, config, or additional CLI arguments', () => {
  for (const args of [[], ['--project', 'pokemon-vintage-binder'], ['--deploy-bootstrap', '--force'], ['deploy'], ['--check', '--deploy-bootstrap']])
    assert.throws(() => run(args));
});
test('read-only preflight succeeds without Firebase credentials or network access', () => {
  assert.doesNotThrow(() => run(['--check']));
});
