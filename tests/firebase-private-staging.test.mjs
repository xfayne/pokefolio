import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privateRulesArguments, run } from '../scripts/firebase-private-staging.mjs';

const config = JSON.parse(readFileSync('firebase/staging-private.json', 'utf8'));
const rules = readFileSync('firebase/firestore.private.rules', 'utf8');

test('private rules deploy is pinned to staging default Firestore and only rules', () => {
  const args = privateRulesArguments('pokefolio-staging', config, rules);
  assert.equal(args[args.indexOf('--project') + 1], 'pokefolio-staging');
  assert.equal(args[args.indexOf('--only') + 1], 'firestore:rules');
  assert.ok(args.includes('--non-interactive'));
  assert.equal(args.includes('--force'), false);
});
test('rejects alternate projects, rule paths, databases and extra Firebase services', () => {
  for (const target of ['pokefolio-production', 'pokemon-vintage-binder', 'another', '', undefined])
    assert.throws(() => privateRulesArguments(target, config, rules));
  for (const bad of [
    { firestore: { database: 'production', rules: 'firestore.private.rules' } },
    { firestore: { database: '(default)', rules: 'firestore.rules' } },
    { firestore: { database: '(default)', rules: '../firestore.private.rules' } },
    { ...config, hosting: { public: '.' } },
  ]) assert.throws(() => privateRulesArguments('pokefolio-staging', bad, rules));
});
test('guards against missing wishlist or owner checks or an opened wildcard', () => {
  for (const bad of [
    rules.replace('match /wishlists/{id}', 'match /wishlists/{ignored}'),
    rules.replace('request.auth.uid == uid', 'request.auth.uid != uid'),
    rules.replace('allow read, write: if false;', 'allow read, write: if true;'),
    rules.replace("rules_version = '2';", "rules_version = '1';"),
    '',
  ]) assert.throws(() => privateRulesArguments('pokefolio-staging', config, bad));
});
test('read-only preflight is safe and a deployment requires an explicit staging acknowledgment', () => {
  assert.doesNotThrow(() => run(['--check'], {}));
  assert.throws(() => run(['--deploy-private'], {}));
  assert.throws(() => run(['--deploy-private'], { POKEFOLIO_STAGING_RULES_ACK: 'pokefolio-production' }));
  for (const args of [[], ['--project', 'pokefolio-production'], ['--deploy-private','--force'], ['deploy']])
    assert.throws(() => run(args, { POKEFOLIO_STAGING_RULES_ACK: 'pokefolio-staging' }));
});
