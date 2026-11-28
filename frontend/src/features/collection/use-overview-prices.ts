import { useQueries } from '@tanstack/react-query';
import { publicPriceClient } from '@/services/public-price-client';
import { catalogCards, catalogMarketReference } from '@/features/catalog/catalog';
import { fetchMarketQuotes } from '@/features/catalog/market-prices';
import { catalogIdentity } from '@/domain/inventory';
import type { CardCopy, CatalogRef } from '@/domain/schema';
import { currentCopies } from './overview-model';

const catalog = new Map(catalogCards.map(card => [card.id, card]));

/** Reuse public printing queries already populated by Cards/Wishlist. No history or AI calls. */
export function useOverviewPrices(copies: readonly CardCopy[], wishIds: readonly string[], enabled: boolean) {
  const references = new Map<string, CatalogRef>(currentCopies(copies).flatMap(copy => {
    const ref = copy.catalog;
    return copy.possession === 'received' && copy.condition.status === 'known' && ref.kind === 'identified'
      && ref.language.status === 'known' && ['en', 'english'].includes(ref.language.value.toLowerCase())
      && ref.edition !== 'unknown' && ref.finish.status === 'known' ? [[catalogIdentity(ref), ref] as const] : [];
  }));
  for (const id of wishIds) {
    const ref = catalogMarketReference(id);
    references.set(catalogIdentity(ref), ref);
  }
  const queries = useQueries({ queries: [...references].flatMap(([identity, reference]) => {
    const card = reference.kind === 'identified' ? catalog.get(reference.cardId) : undefined;
    return card ? [{ queryKey: ['market', identity], enabled, staleTime: 900_000, retry: 1,
      queryFn: ({signal}: {signal: AbortSignal}) => fetchMarketQuotes(card, reference, signal) }] : [];
  }) }, publicPriceClient);
  return { quotes: queries.flatMap(query => query.data ?? []), loading: enabled && queries.some(query => query.isPending),
    failed: enabled && queries.some(query => query.isError),
    retry: () => { for (const query of queries) if (query.isError) void query.refetch(); },
  };
}
