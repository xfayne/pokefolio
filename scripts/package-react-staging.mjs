import { readFileSync, writeFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validateWebConfig, STAGING_API_URL } from './build-staging-preview.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const firebase = validateWebConfig(JSON.parse(process.env.POKEFOLIO_FIREBASE_WEB_CONFIG || 'null'));
const workerUrl = process.env.POKEFOLIO_STAGING_API_URL || '';
if (workerUrl !== '' && workerUrl !== STAGING_API_URL) throw Error('Unapproved staging API');
const sourceSha = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(sourceSha || '')) throw Error('Expected verified source SHA');
const destination = join(root, 'dist', 'pokefolio-staging');
if (existsSync(destination)) throw Error('Staging artifact output must be new');
execFileSync(process.execPath, [join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
  cwd: join(root, 'frontend'), stdio: 'inherit',
  env: { ...process.env, VITE_POKEFOLIO_CONFIG: JSON.stringify({ firebase, workerUrl }) },
});
const html = readFileSync(join(root, 'frontend', 'dist', 'index.html'), 'utf8');
if (!html.includes('/pokefolio/assets/') || /js\/|firebase-cloud|catalog-ui|binder\.js/.test(html)) throw Error('Expected isolated React asset entrypoint');
mkdirSync(dirname(destination), { recursive: true });
cpSync(join(root, 'frontend', 'dist'), destination, { recursive: true, errorOnExist: true, force: false });
writeFileSync(join(destination, '.nojekyll'), '');
writeFileSync(join(destination, 'pokefolio-staging-manifest.json'), JSON.stringify({
  environment: 'staging', application: 'react-foundation', repository: 'xfayne/pokefolio', sourceSha,
  firebaseProjectId: firebase.projectId, firebaseEnabled: true, workerEnabled: Boolean(workerUrl),
}, null, 2) + '\n');
