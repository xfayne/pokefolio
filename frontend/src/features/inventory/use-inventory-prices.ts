import { useQueries } from '@tanstack/react-query';
import { publicPriceClient } from '@/services/public-price-client';
import { catalogCards } from '@/features/catalog/catalog';
import { fetchMarketQuotes } from '@/features/catalog/market-prices';
import { catalogIdentity } from '@/domain/inventory';
import type { CardCopy } from '@/domain/schema';

export function useInventoryPrices(
  copies: readonly CardCopy[],
  enabled: boolean,
) {
  const unique = new Map(
    copies
      .filter(
        (c) =>
          c.disposition === 'held' &&
          c.condition.status === 'known' &&
          c.catalog.kind === 'identified' &&
          c.catalog.edition !== 'unknown' &&
          c.catalog.finish.status === 'known',
      )
      .map((c) => [catalogIdentity(c.catalog), c.catalog]),
  );
  const queries = useQueries(
    {
      queries: [...unique].flatMap(([identity, reference]) => {
        const card =
          reference.kind === 'identified'
            ? catalogCards.find((c) => c.id === reference.cardId)
            : undefined;
        return card
          ? [
              {
                queryKey: ['market', identity],
                enabled,
                queryFn: ({ signal }: { signal: AbortSignal }) =>
                  fetchMarketQuotes(card, reference, signal),
                staleTime: 900_000,
                retry: 1,
              },
            ]
          : [];
      }),
    },
    publicPriceClient,
  );
  return {
    quotes: queries.flatMap((q) => q.data ?? []),
    loading: enabled && queries.some((q) => q.isPending),
    failed: queries.some((q) => q.isError),
    retry: () => {
      for (const q of queries) if (q.isError) void q.refetch();
    },
  };
}
