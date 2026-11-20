import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// JSON-only offline boundary. Reject values that JSON.stringify would discard.
export function canonical(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return JSON.stringify(value);
  if (typeof value !== 'object' || ancestors.has(value)) throw Error('UNSUPPORTED_JSON_VALUE');
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) throw Error('UNSUPPORTED_JSON_OBJECT');
  if (Reflect.ownKeys(value).some(k => typeof k === 'symbol')) throw Error('UNSUPPORTED_JSON_KEY');
  const next = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) throw Error('SPARSE_OR_EXTENDED_ARRAY');
    return '[' + Array.from(value, v => canonical(v, next)).join(',') + ']';
  }
  return '{' + Object.keys(value).sort().map(k => {
    const d = Object.getOwnPropertyDescriptor(value, k);
    if (!('value' in d)) throw Error('ACCESSOR_NOT_JSON');
    return JSON.stringify(k) + ':' + canonical(d.value, next);
  }).join(',') + '}';
}

export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
export const cloneJson = value => JSON.parse(canonical(value));
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// Completeness is an export assertion, not proof that a remote project was read.
export function createBackup({ source, documents, inventory }) {
  if (!object(source) || !['projectId', 'ownerUid', 'revision', 'capturedAt'].every(k => typeof source[k] === 'string' && source[k])) throw Error('INVALID_SOURCE');
  if (!Number.isFinite(Date.parse(source.capturedAt))) throw Error('INVALID_CAPTURE_TIME');
  if (!object(documents) || !Array.isArray(inventory) || !inventory.length) throw Error('INVALID_MANIFEST');
  const paths = inventory.map(x => x?.path);
  if (paths.some(p => typeof p !== 'string' || !p) || new Set(paths).size !== paths.length) throw Error('INVALID_PATHS');
  if (Object.keys(documents).some(p => !paths.includes(p))) throw Error('UNLISTED_DOCUMENT');
  for (const entry of inventory) {
    if (!['present', 'absent', 'not-exported'].includes(entry.status)) throw Error('INVALID_COVERAGE');
    if (Object.hasOwn(documents, entry.path) !== (entry.status === 'present')) throw Error('COVERAGE_MISMATCH');
  }
  const payload = cloneJson({ formatVersion: 1, source, inventory, documents });
  return { payload, sha256: digest(payload) };
}

export function validateBackup(backup) {
  if (!object(backup) || backup.payload?.formatVersion !== 1 || digest(backup.payload) !== backup.sha256) throw Error('BACKUP_DIGEST_MISMATCH');
  const rebuilt = createBackup(backup.payload);
  if (canonical(rebuilt) !== canonical(backup)) throw Error('BACKUP_ENVELOPE_MISMATCH');
  return cloneJson(backup);
}

// Exclusive creation prevents overwriting an earlier export. Reopen the durable
// file and compare independently, including metadata and every original value.
export async function saveAndVerifyBackup(path, backup) {
  validateBackup(backup);
  await writeFile(path, canonical(backup), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  const reopened = await readVerifiedBackup(path, backup);
  return { sha256: reopened.sha256, readBackVerified: true };
}

export async function readVerifiedBackup(path, expected) {
  const reopened = validateBackup(JSON.parse(await readFile(path, 'utf8')));
  if (expected && canonical(reopened) !== canonical(validateBackup(expected))) throw Error('BACKUP_READBACK_MISMATCH');
  return reopened;
}

export function backupCoverage(backup, requiredPaths) {
  validateBackup(backup);
  return requiredPaths.filter(path => !backup.payload.inventory.some(x => x.path === path && x.status !== 'not-exported'));
}
