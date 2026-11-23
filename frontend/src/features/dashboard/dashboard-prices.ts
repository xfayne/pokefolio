import { catalogIdentity, type CopyQuote } from '@/domain/inventory';
import type { CardCopy } from '@/domain/schema';
import type { PriceSeries } from '@/domain/performance';
import { selectMarketVariant, type MarketResult } from '@/services/market-history';

/**
 * Current portfolio value must use the same exact-printing TCGTracking quotes
 * as Collection. JustTCG adds historical observations when available; missing
 * history or a provider quota error must not erase a valid current valuation.
 *
 * Neither source can infer an unknown grade, edition or finish. Historical
 * observations are never synthesized from today's quote.
 */
export function dashboardPriceSeries(
  copies: readonly CardCopy[],
  products: ReadonlyMap<string, string | undefined>,
  results: readonly MarketResult[],
  quotes: readonly CopyQuote[],
): PriceSeries[] {
  const byProduct = new Map(results.map(result => [result.productId, result]));
  const byPrinting = new Map<string, CopyQuote[]>();
  for (const quote of quotes) {
    if (quote.catalog.kind !== 'identified') continue;
    const key = `${catalogIdentity(quote.catalog)}:${quote.condition}`;
    byPrinting.set(key, [...(byPrinting.get(key) ?? []), quote]);
  }
  const seen = new Set<string>();
  const series: PriceSeries[] = [];
  for (const copy of copies) {
    if (copy.catalog.kind !== 'identified' || copy.condition.status !== 'known') continue;
    const key = `${catalogIdentity(copy.catalog)}:${copy.condition.value}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const candidates = byPrinting.get(key) ?? [];
    const latest = Math.max(...candidates.map(q => Date.parse(q.observedAt)));
    const matches = candidates.filter(q => Date.parse(q.observedAt) === latest);
    const first = matches[0];
    // An ambiguous same-time quote is not a reliable current observation.
    const currentQuote = first && matches.every(q => q.money.currency === first.money.currency && q.money.minor === first.money.minor) ? first : null;
    const product = products.get(copy.catalog.cardId);
    const market = product ? byProduct.get(product) : undefined;
    const variant = market ? selectMarketVariant(market, copy.catalog, copy.condition.value) : null;
    if (!currentQuote && !variant) continue;

    const current = currentQuote
      ? { minor: currentQuote.money.minor, observedAt: currentQuote.observedAt }
      : variant?.current !== null && variant?.observedAt
        ? { minor: variant.current, observedAt: variant.observedAt }
        : null;
    series.push({
      catalog: copy.catalog,
      condition: copy.condition.value,
      currency: currentQuote?.money.currency ?? variant!.currency,
      current,
      history: variant?.history ?? [],
      source: currentQuote?.source ?? market?.data?.source ?? 'Market history',
      stale: !currentQuote && market?.cache === 'stale',
    });
  }
  return series;
}
