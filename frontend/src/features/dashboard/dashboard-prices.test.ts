import { expect, it } from 'vitest';
import { copy, unknown } from '@/domain/fixtures.test-support';
import { selectPerformance } from '@/domain/performance';
import type { CatalogRef } from '@/domain/schema';
import type { CopyQuote } from '@/domain/inventory';
import type { MarketResult } from '@/services/market-history';
import { dashboardPriceSeries } from './dashboard-prices';

const reference = copy.catalog as Extract<CatalogRef, { kind: 'identified' }>;
const quote = (catalog: CatalogRef = reference, condition: CopyQuote['condition'] = 'LP', minor = 2542, observedAt = '2026-11-21T09:00:00Z'): CopyQuote =>
  ({ catalog, condition, money: { currency: 'USD', minor }, observedAt, source: 'TCGTracking / TCGplayer' });
const market: MarketResult = {
  productId: '106521', cache: 'fresh', error: null, retryAfter: null,
  data: {
    schemaVersion: 1, provider: 'justtcg', source: 'JustTCG', productId: '106521',
    currency: 'USD', period: '1y', fetchedAt: 1,
    variants: [{ condition: 'LP', printing: 'Unlimited Holofoil', language: 'English', currency: 'USD', current: 8000,
      observedAt: '2026-11-21T08:00:00Z', status: 'current',
      history: [{ date: '2026-11-20', minor: 7400 }] }],
  },
};

it('uses the same current price as Collection even when history has no products', () => {
  const series = dashboardPriceSeries([copy], new Map(), [], [quote()]);
  expect(series).toMatchObject([{ current: { minor: 2542 }, history: [], source: 'TCGTracking / TCGplayer' }]);
  const value = selectPerformance({
    owner: 'owner', records: [{ collection: 'copies', record: copy }],
    catalog: [], prices: series, currency: 'USD', fx: [], asOf: '2026-11-21T12:00:00Z',
  });
  expect(value.value).toMatchObject({ minor: 2542, covered: 1, total: 1 });
  expect(value.top).toHaveLength(1);
  // No fabricated historic daily valuations.
  expect(value.points.map(p => p.value.covered)).toEqual([0, 0]);
});

it('preserves provider history but prioritizes the Collection current quote', () => {
  const series = dashboardPriceSeries([copy, { ...copy, id: 'copy-b' }], new Map([['base3-5', '106521']]), [market], [quote()]);
  expect(series).toHaveLength(1);
  expect(series[0]).toMatchObject({
    current: { minor: 2542 }, history: [{ date: '2026-11-20', minor: 7400 }], stale: false,
  });
});

it('does not guess grades, printings or ambiguous current values', () => {
  const wrongEdition = quote({ ...reference, edition: 'first-edition' });
  const wrongCondition = quote(reference, 'NM');
  const ambiguous = [quote(), quote(reference, 'LP', 9999)];
  expect(dashboardPriceSeries([copy], new Map(), [], [wrongEdition, wrongCondition])).toEqual([]);
  expect(dashboardPriceSeries([copy], new Map(), [], ambiguous)).toEqual([]);
  expect(dashboardPriceSeries([{ ...copy, condition: unknown }], new Map(), [], [quote()])).toEqual([]);
});

it('retains a valid current Collection price when imported language evidence is unknown', () => {
  const catalog = { ...reference, language: unknown };
  const imported = { ...copy, catalog };
  const series = dashboardPriceSeries([imported], new Map([['base3-5', '106521']]), [market], [quote(catalog)]);
  expect(series).toMatchObject([{ current: { minor: 2542 }, history: [] }]);
});

it('falls back to exact JustTCG current only when the Collection quote is unavailable', () => {
  const series = dashboardPriceSeries([copy], new Map([['base3-5', '106521']]), [market], []);
  expect(series).toMatchObject([{ current: { minor: 8000 }, history: [{ date: '2026-11-20', minor: 7400 }] }]);
  expect(dashboardPriceSeries([copy], new Map(), [{ ...market, cache: 'unavailable', data: null }], [])).toEqual([]);
});
