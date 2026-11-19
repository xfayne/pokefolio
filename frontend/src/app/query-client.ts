import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
export function createQueryClient() {
  return new QueryClient({ defaultOptions: {
    queries: { staleTime: 60_000, retry: (count, error) => count < 1 && !(isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) },
    mutations: { retry: false },
  } });
}
