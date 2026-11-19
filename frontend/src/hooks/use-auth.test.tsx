import { renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi, afterEach } from 'vitest';
import { useAuth } from './use-auth';
import { subscribeToAuth } from '@/services/firebase';
afterEach(() => vi.unstubAllEnvs());
it('settles disconnected auth without network access', async () => {
  vi.stubEnv('VITE_POKEFOLIO_CONFIG', '');
  const { result } = renderHook(useAuth);
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.user).toBeNull();
});
it('reports rejected configuration without initializing a foreign project', async () => {
  vi.stubEnv('VITE_POKEFOLIO_CONFIG', '{"firebase":{"projectId":"pokefolio-production"}}');
  const { result } = renderHook(useAuth);
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.user).toBeNull();
});
it('cancels auth initialization when the subscriber unmounts immediately', async () => {
  vi.stubEnv('VITE_POKEFOLIO_CONFIG', '');
  const listener = vi.fn();
  const cancel = subscribeToAuth(listener, vi.fn());
  cancel();
  await Promise.resolve();
  expect(listener).not.toHaveBeenCalled();
});
