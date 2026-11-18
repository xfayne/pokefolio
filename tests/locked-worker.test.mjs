import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../staging/locked-worker.mjs';

test('staging bootstrap is deny-only for every HTTP method', async () => {
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await worker.fetch(new Request('https://pokefolio.invalid/api/search', { method }));
    assert.equal(response.status, 503, method);
    assert.deepEqual(await response.json(), { error: 'STAGING_NOT_CONFIGURED' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
});

test('bootstrap has no external backend imports or secret/resource references', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('staging/locked-worker.mjs', 'utf8');
  const executable = source.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n');
  assert.doesNotMatch(executable, /\\b(?:firebase|firestore|ebay|KV_|17TRACK|GEMINI_|API_KEY|CLIENT_SECRET|workers\\.dev)\\b/i);
  assert.match(source, /STAGING_NOT_CONFIGURED/);
});
