import { useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/surfaces';
import { catalogIdentity, type CopyQuote, type CopyView } from '@/domain/inventory';
import { conditionSchema, type CatalogRef, type Money } from '@/domain/schema';

import { bestCopy } from './copy-condition';

export function CardMarketPrice({ catalog, quotes, currency, copies, money, status, onRetry }: {
  status?: string | undefined; onRetry?: (() => void) | undefined; catalog: CatalogRef; quotes: readonly CopyQuote[]; currency: Money['currency']; copies: readonly CopyView[]; money: (m: Money) => string;
}) {
  const { t } = useTranslation();
  const [condition, setCondition] = useState(() => {
    const best = bestCopy(copies)?.copy.condition;
    return best?.status === 'known' ? best.value : 'LP';
  });
  const matches = quotes.filter(q => catalog.kind === 'identified' && q.catalog.kind === 'identified' &&
    catalogIdentity(q.catalog) === catalogIdentity(catalog) && q.condition === condition && q.money.currency === currency);
  const latest = Math.max(...matches.map(q => Date.parse(q.observedAt)));
  const current = matches.filter(q => Date.parse(q.observedAt) === latest);
  const quote = current[0];
  const amount = quote && current.every(q => q.money.minor === quote.money.minor) ? quote.money : null;
  return <Card className="!p-3">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{t('inventory.marketPrice')}</h2><p className="text-3xl font-black tracking-tight text-slate-950" aria-live="polite">{status ?? (amount ? money(amount) : t('inventory.unpriced'))}</p>{onRetry && <button type="button" className="text-sm underline" onClick={onRetry}>{t('reload')}</button>}<p className="text-xs text-slate-600">{t('inventory.perCard')} · {condition}</p></div>
      <label className="relative"><span className="sr-only">{t('inventory.marketCondition')}</span><Select aria-label={t('inventory.marketCondition')} className="min-h-7 w-20 appearance-none rounded-lg border border-blue-400 surface-field pe-8 ps-3 text-base font-extrabold" value={condition} onChange={e => setCondition(conditionSchema.parse(e.target.value))}>{conditionSchema.options.map(c => <option key={c} value={c}>{c}</option>)}</Select><LuChevronDown aria-hidden className="pointer-events-none absolute end-2 top-1.5 size-4" /></label>
    </div>
  </Card>;
}
