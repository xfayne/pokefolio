import { useQuery } from '@tanstack/react-query';
import { catalogCards } from '@/features/catalog/catalog';
import { fetchMarketQuotes } from '@/features/catalog/market-prices';
import { publicPriceClient } from '@/services/public-price-client';
import { useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/surfaces';
import { catalogIdentity, type CopyQuote, type CopyView } from '@/domain/inventory';
import { conditionSchema, type CatalogRef, type Money } from '@/domain/schema';

import { bestCopy } from './copy-condition';

export function CardMarketPrice({ catalog, quotes, currency, copies, money, status, onRetry, onEditionChange, live = false }: {
  live?: boolean; onEditionChange?: ((first: boolean) => void) | undefined; status?: string | undefined; onRetry?: (() => void) | undefined; catalog: CatalogRef; quotes: readonly CopyQuote[]; currency: Money['currency']; copies: readonly CopyView[]; money: (m: Money) => string;
}) {
  const { t } = useTranslation();
  const [condition, setCondition] = useState(() => {
    const best = bestCopy(copies)?.copy.condition;
    return best?.status === 'known' ? best.value : 'LP';
  });
  const [first, setFirst] = useState(catalog.kind === 'identified' && catalog.edition === 'first-edition');
  const selectedCatalog = catalog.kind === 'identified' ? { ...catalog, edition: first ? 'first-edition' as const : 'unlimited' as const } : catalog;
  const card = catalog.kind === 'identified' ? catalogCards.find(c => c.id === catalog.cardId) : undefined;
  const query = useQuery({queryKey:['market', catalogIdentity(selectedCatalog)],enabled:live && !!card,queryFn:({signal})=>fetchMarketQuotes(card!,selectedCatalog,signal),staleTime:900_000,retry:1},publicPriceClient);
  const displayedQuotes = live ? query.data ?? [] : quotes;
  const displayedStatus = live ? query.isPending ? t('loading') : query.isError ? t('inventory.unpriced') : undefined : status;
  const matches = displayedQuotes.filter(q => catalog.kind === 'identified' && q.catalog.kind === 'identified' &&
    catalogIdentity(q.catalog) === catalogIdentity(selectedCatalog) && q.condition === condition && q.money.currency === currency);
  const latest = Math.max(...matches.map(q => Date.parse(q.observedAt)));
  const current = matches.filter(q => Date.parse(q.observedAt) === latest);
  const quote = current[0];
  const amount = quote && current.every(q => q.money.minor === quote.money.minor) ? quote.money : null;
  return <Card className="!p-3">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{t('inventory.marketPrice')}</h2><p className="text-3xl font-black tracking-tight text-slate-950" aria-live="polite">{displayedStatus ?? (amount ? money(amount) : t('inventory.unpriced'))}</p>{(onRetry || (live && query.isError)) && <button type="button" className="text-sm underline" onClick={onRetry ?? (() => { void query.refetch(); })}>{t('reload')}</button>}<p className="text-xs text-slate-600">{t('inventory.perCard')} · {condition}</p></div>
      <label className="relative"><span className="sr-only">{t('inventory.marketCondition')}</span><Select aria-label={t('inventory.marketCondition')} className="min-h-7 w-20 appearance-none rounded-lg border border-blue-400 surface-field pe-8 ps-3 text-base font-extrabold" value={condition} onChange={e => setCondition(conditionSchema.parse(e.target.value))}>{conditionSchema.options.map(c => <option key={c} value={c}>{c}</option>)}</Select><LuChevronDown aria-hidden className="pointer-events-none absolute end-2 top-1.5 size-4" /></label>
    </div>
    {catalog.kind === 'identified' && <label className="mt-2 flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" checked={first} onChange={e => { setFirst(e.target.checked); onEditionChange?.(e.target.checked); }} />First Edition</label>}
  </Card>;
}
