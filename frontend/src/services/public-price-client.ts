import { QueryClient } from '@tanstack/react-query';
// Public provider data only: never stores account records or authentication.
export const publicPriceClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 900_000, retry: false } },
});
