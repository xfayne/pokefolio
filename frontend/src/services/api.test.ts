import { expect, it, vi } from 'vitest';
import { createApiClient } from './api';
import { STAGING_API } from './environment';
it('attaches a fresh token to approved requests and supports cancellation', async () => {
  const token = vi.fn().mockResolvedValue('synthetic-token');
  const client = createApiClient(STAGING_API, token);
  client.defaults.adapter = async (config) => {
    expect(config.headers.get('Authorization')).toBe('Bearer synthetic-token');
    expect(config.signal).toBeDefined();
    return { config, data: { ok: true }, status: 200, statusText: 'OK', headers: {} };
  };
  expect((await client.get('/health', { signal: new AbortController().signal })).data).toEqual({ ok: true });
  expect(token).toHaveBeenCalledTimes(1);
});
it.each(['https://evil.test/path', '//evil.test/path', '/../../private', '/path\\evil'])('rejects unsafe paths before requesting a token: %s', async (url) => {
  const token = vi.fn();
  const client = createApiClient(STAGING_API, token);
  await expect(client.get(url)).rejects.toThrow('relative path');
  expect(token).not.toHaveBeenCalled();
});
it('rejects base URL overrides before requesting a token', async () => {
  const token = vi.fn();
  await expect(createApiClient(STAGING_API, token).get('/health', { baseURL: 'https://evil.test' })).rejects.toThrow();
  expect(token).not.toHaveBeenCalled();
});
