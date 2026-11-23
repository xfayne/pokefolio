import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// This is deliberately separate from the deny-all bootstrap rollback wrapper.
// Never use provider credentials or infer the target from Firebase CLI defaults.
export const STAGING_PROJECT = 'pokefolio-staging';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(root, 'firebase/staging-private.json');
const rulesPath = resolve(root, 'firebase/firestore.private.rules');
const expected = { firestore: { database: '(default)', rules: 'firestore.private.rules' } };

export function privateRulesArguments(project, config, rules) {
  if (project !== STAGING_PROJECT) throw Error('Only pokefolio-staging is permitted');
  if (JSON.stringify(config) !== JSON.stringify(expected))
    throw Error('Unexpected Firestore policy deployment configuration');
  if (typeof rules !== 'string' ||
      !rules.includes("rules_version = '2';") ||
      !rules.includes('match /users/{uid}') ||
      !rules.includes('match /wishlists/{id}') ||
      !rules.includes("allow get: if isOwner(uid) && id == 'main';") ||
      !rules.includes("allow list, delete: if false;") ||
      !rules.includes('match /{document=**}') ||
      !rules.includes('allow read, write: if false;') ||
      !rules.includes("request.auth.uid == uid") ||
      rules.includes('allow read, write: if true;'))
    throw Error('Private rules guard failed: expected reviewed owner-only policy');
  return [
    '-y', 'firebase-tools@latest', 'deploy',
    '--only', 'firestore:rules',
    '--project', STAGING_PROJECT,
    '--config', configPath,
    '--non-interactive',
  ];
}

export function run(args = process.argv.slice(2), env = process.env) {
  if (args.length !== 1 || !['--check', '--deploy-private'].includes(args[0]))
    throw Error('Use --check or --deploy-private; project/config overrides are forbidden');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const rules = readFileSync(rulesPath, 'utf8');
  const cliArgs = privateRulesArguments(STAGING_PROJECT, config, rules);
  const sha = createHash('sha256').update(rules, 'utf8').digest('hex');
  if (args[0] === '--check') {
    console.log('Verified staging target: pokefolio-staging / (default) / firestore:rules');
    console.log('Reviewed private rules SHA-256: ' + sha);
    console.log('No remote reads, writes or deployments performed.');
    return;
  }
  if (env.POKEFOLIO_STAGING_RULES_ACK !== STAGING_PROJECT)
    throw Error('Deployment requires POKEFOLIO_STAGING_RULES_ACK=pokefolio-staging');
  console.log('Publishing reviewed private Firestore rules to staging only. SHA-256: ' + sha);
  const result = spawnSync('npx', cliArgs, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error('Staging-only private Firestore deployment failed');
  console.log('Firebase CLI reported success. Independently verify owner read/write and foreign denial.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { run(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
