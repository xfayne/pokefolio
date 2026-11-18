import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

export const STAGING_PROJECT = 'pokefolio-staging';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function bootstrapArguments(project, config, rules) {
  if (project !== STAGING_PROJECT) throw new Error('Only pokefolio-staging is permitted.');
  if (JSON.stringify(config) !== JSON.stringify({
    firestore: { database: '(default)', rules: 'firestore.rules' }
  })) throw new Error('Unexpected Firebase bootstrap configuration.');
  const normalized = rules.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');
  if (normalized !== "rules_version='2';servicecloud.firestore{match/databases/{database}/documents{match/{document=**}{allowread,write:iffalse;}}}")
    throw new Error('Bootstrap must deny every client read and write.');
  return ['-y', 'firebase-tools@latest', 'deploy', '--only', 'firestore:rules',
    '--project', STAGING_PROJECT, '--config', resolve(root, 'firebase/staging.json'),
    '--non-interactive'];
}

export function run(args = process.argv.slice(2)) {
  if (args.length !== 1 || !['--check', '--deploy-bootstrap'].includes(args[0]))
    throw new Error('Use --check or --deploy-bootstrap. Project overrides are forbidden.');
  const config = JSON.parse(readFileSync(resolve(root, 'firebase/staging.json'), 'utf8'));
  const rules = readFileSync(resolve(root, 'firebase/firestore.rules'), 'utf8');
  const cliArgs = bootstrapArguments(STAGING_PROJECT, config, rules);
  if (args[0] === '--check') {
    console.log('Verified: pokefolio-staging, (default), deny-all rules. No cloud request performed.');
    return;
  }
  // Run npm's JavaScript entry point on Windows so paths with spaces need no shell.
  const windows = process.platform === 'win32';
  const command = windows ? process.execPath : 'npx';
  const commandArgs = windows
    ? [resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js'), ...cliArgs]
    : cliArgs;
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Firebase bootstrap deployment failed.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
