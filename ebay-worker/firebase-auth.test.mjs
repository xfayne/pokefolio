import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import worker from './index.js';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
const ORIGIN = 'https://pokefolio.test';
const PROJECT = 'pokefolio-staging';
const OWNER = 'collector@example.test';
const env = {
 ALLOWED_ORIGIN: ORIGIN,
 POKEFOLIO_FIREBASE_PROJECT_ID: PROJECT,
 TRACK17_API_KEY: 'synthetic-not-a-real-key',
 TRACK17_MUTATIONS_ENABLED: 'true',
 TRACK17_OWNER_EMAIL: OWNER
};
const keys = await webcrypto.subtle.generateKey({
 name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
 publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'
}, true, ['sign', 'verify']);
const publicKey = { ...await webcrypto.subtle.exportKey('jwk', keys.publicKey), kid: 'synthetic-staging-key' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const claims = {
 aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT,
 sub: 'synthetic-owner', exp: now + 1800, iat: now - 10, auth_time: now - 20,
 email: OWNER, email_verified: true
};
async function token(overrides = {}, headerOverrides = {}) {
 const payload = { ...claims, ...overrides };
 const body = encode({ alg: 'RS256', kid: publicKey.kid, ...headerOverrides }) + '.' + encode(payload);
 const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(body));
 return body + '.' + Buffer.from(signature).toString('base64url');
}
function request(auth, origin = ORIGIN) {
 return new Request('https://worker.test/api/shipments/register', {
  method: 'POST', headers: { origin, 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer ' + auth } : {}) },
  body: JSON.stringify({ number: 'SYNTHETIC12345' })
 });
}

test('staging Worker verifies signed Firebase identity before any shipment mutation', async t => {
 let trackingCalls = 0;
 const previousFetch = globalThis.fetch;
 t.after(() => { globalThis.fetch = previousFetch; });
 globalThis.fetch = async (url, options) => {
  const target = String(url);
  if (target === 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
   return Response.json({ keys: [publicKey] }, { headers: { 'cache-control': 'max-age=3600' } });
  if (target === 'https://api.17track.net/track/v2.4/register') {
   trackingCalls++;
   assert.equal(options.headers['17token'], 'synthetic-not-a-real-key');
   assert.deepEqual(JSON.parse(options.body), [{ number: 'SYNTHETIC12345', lang: 'en' }]);
   return Response.json({ code: 0, data: { accepted: [{ number: 'SYNTHETIC12345' }], rejected: [] } });
  }
  throw new Error('Unexpected external request: ' + target);
 };
 await t.test('valid staging owner token reaches only the mocked shipping service', async () => {
  const before = trackingCalls;
  const response = await worker.fetch(request(await token()), env);
  assert.equal(response.status, 200);
  assert.equal(trackingCalls, before + 1);
 });
 await t.test('shared-account staging registration defaults to disabled even for a valid owner', async () => {
  const before=trackingCalls;
  for(const flag of [undefined,'false',true]){
   const response=await worker.fetch(request(await token()),{...env,TRACK17_MUTATIONS_ENABLED:flag});
   assert.equal(response.status,503);
   assert.equal((await response.json()).error,'STAGING_SHIPMENT_REGISTRATION_DISABLED');
  }
  assert.equal(trackingCalls,before,'Staging must not mutate the shared upstream account');
 });
 const productionEnv={...env,POKEFOLIO_FIREBASE_PROJECT_ID:'pokefolio-production'};
 const productionClaims={aud:'pokefolio-production',iss:'https://securetoken.google.com/pokefolio-production'};
 await t.test('production accepts its own owner and rejects staging identities',async()=>{
  const before=trackingCalls;
  assert.equal((await worker.fetch(request(await token(productionClaims)),productionEnv)).status,200);
  assert.equal(trackingCalls,before+1);
  assert.equal((await worker.fetch(request(await token()),productionEnv)).status,403);
  assert.equal((await worker.fetch(request(await token(productionClaims)),env)).status,403);
  assert.equal((await worker.fetch(request(await token({...productionClaims,email:'other@example.test'})),productionEnv)).status,403);
  assert.equal(trackingCalls,before+1);
 });
 const cases = [
  ['no bearer token', null, env],
  ['malformed token', 'invalid.token.value', env],
  ['null JWT header', encode(null) + '.' + encode(claims) + '.invalid', env],
  ['null JWT claims', encode({ alg: 'RS256', kid: publicKey.kid }) + '.' + encode(null) + '.invalid', env],
  ['expired token', await token({ exp: now - 1 }), env],
  ['wrong audience', await token({ aud: 'other-project' }), env],
  ['wrong issuer', await token({ iss: 'https://securetoken.google.com/other-project' }), env],
  ['legacy production token', await token({ aud: 'pokemon-vintage-binder', iss: 'https://securetoken.google.com/pokemon-vintage-binder' }), env],
  ['legacy configured project', await token(), { ...env, POKEFOLIO_FIREBASE_PROJECT_ID: 'pokemon-vintage-binder' }],
  ['unknown configured project even with matching signed claims', await token({ aud: 'unrelated-project', iss: 'https://securetoken.google.com/unrelated-project' }), { ...env, POKEFOLIO_FIREBASE_PROJECT_ID: 'unrelated-project' }],
  ['missing configured project', await token(), { ...env, POKEFOLIO_FIREBASE_PROJECT_ID: undefined }],
  ['another verified user', await token({ email: 'other@example.test' }), env],
  ['unverified owner email', await token({ email_verified: false }), env],
  ['missing owner allowlist', await token(), { ...env, TRACK17_OWNER_EMAIL: undefined }, 503],
  ['future issue time', await token({ iat: now + 600 }), env],
  ['future auth time', await token({ auth_time: now + 600 }), env],
  ['missing expiry', await token({ exp: undefined }), env],
  ['missing issue time', await token({ iat: undefined }), env],
  ['missing auth time', await token({ auth_time: undefined }), env],
  ['string expiry', await token({ exp: String(now + 1800) }), env],
  ['null issue time', await token({ iat: null }), env],
  ['negative auth time', await token({ auth_time: -1 }), env],
  ['expiry before issue time', await token({ exp: now + 10, iat: now + 20 }), env],
  ['non-string subject', await token({ sub: { value: 'synthetic-owner' } }), env],
  ['oversized subject', await token({ sub: 'x'.repeat(129) }), env],
  ['wrong algorithm', await token({}, { alg: 'HS256' }), env],
  ['unknown signing key', await token({}, { kid: 'missing-key' }), env]
 ];
 for (const [name, bearer, settings, expectedStatus = 403] of cases) await t.test(name, async () => {
  const before = trackingCalls;
  const response = await worker.fetch(request(bearer), settings);
  assert.equal(response.status, expectedStatus);
  assert.equal(trackingCalls, before, 'Rejected identities must never register shipments');
 });
 await t.test('tampered signature is rejected', async () => {
  const signed = await token();
  const pieces = signed.split('.');
  const signature = Buffer.from(pieces[2], 'base64url');
  signature[0] ^= 255;
  pieces[2] = signature.toString('base64url');
  const before = trackingCalls;
  assert.equal((await worker.fetch(request(pieces.join('.')), env)).status, 403);
  assert.equal(trackingCalls, before);
 });
 await t.test('foreign origin is rejected before shipping service access', async () => {
  const before = trackingCalls;
  assert.equal((await worker.fetch(request(await token(), 'https://foreign.test'), env)).status, 403);
  assert.equal(trackingCalls, before);
 });
});
