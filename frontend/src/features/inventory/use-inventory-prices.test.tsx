import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { CatalogRef } from '@/domain/schema';
import { copy } from '@/domain/fixtures.test-support';
import { publicPriceClient } from '@/services/public-price-client';
const state = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock('@/features/catalog/market-prices', () => ({
  fetchMarketQuotes: state.fetcher,
}));
import { useInventoryPrices } from './use-inventory-prices';
beforeEach(() => {
  publicPriceClient.clear();
  state.fetcher.mockReset();
});
it('loads pending copies, deduplicates printings and keeps editions separate', async () => {
  state.fetcher.mockImplementation((_card: unknown, catalog: CatalogRef) =>
    Promise.resolve([
      {
        catalog,
        condition: 'LP',
        money: {
          currency: 'USD',
          minor:
            catalog.kind === 'identified' && catalog.edition === 'first-edition'
              ? 2000
              : 1000,
        },
        observedAt: '2026-11-21T00:00:00Z',
        source: 'fixture',
      },
    ]),
  );
  const copies = [
    { ...copy, possession: 'pending' as const },
    { ...copy, id: 'duplicate' },
    {
      ...copy,
      id: 'first',
      catalog:
        copy.catalog.kind === 'identified'
          ? { ...copy.catalog, edition: 'first-edition' as const }
          : copy.catalog,
    },
  ];
  const { result } = renderHook(() => useInventoryPrices(copies, true));
  await waitFor(() => expect(result.current.quotes).toHaveLength(2));
  expect(state.fetcher).toHaveBeenCalledTimes(2);
  expect(result.current.quotes.map((q) => q.money.minor).sort()).toEqual([
    1000, 2000,
  ]);
});
it('does not fetch for disconnected/sample contexts or guess unknown printings', () => {
  renderHook(() => useInventoryPrices([copy], false));
  renderHook(() =>
    useInventoryPrices(
      [
        {
          ...copy,
          catalog:
            copy.catalog.kind === 'identified'
              ? { ...copy.catalog, edition: 'unknown' }
              : copy.catalog,
        },
      ],
      true,
    ),
  );
  expect(state.fetcher).not.toHaveBeenCalled();
});
