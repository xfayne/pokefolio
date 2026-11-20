import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/surfaces';
import { catalogIdentity, type CopyQuote, type CopyView } from '@/domain/inventory';
import { conditionSchema, type CatalogRef, type Money } from '@/domain/schema';

import { bestCopy } from './copy-condition';

export function CardMarketPrice({ catalog, quotes, currency, copies, money }: {
  catalog: CatalogRef; quotes: readonly CopyQuote[]; currency: Money['currency']; copies: readonly CopyView[]; money: (m: Money) => string;
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
  return <Card className="space-y-3">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">{t('inventory.marketPrice')}</h2><p className="text-xs text-slate-600">{t('inventory.perCard')}</p></div>
      <label><span className="sr-only">{t('inventory.marketCondition')}</span><select aria-label={t('inventory.marketCondition')} className="min-h-11 rounded-xl border border-blue-200 bg-white px-3 text-base" value={condition} onChange={e => setCondition(conditionSchema.parse(e.target.value))}>{conditionSchema.options.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
    </div>
    <p className="text-2xl font-bold text-blue-700" aria-live="polite">{amount ? money(amount) : t('inventory.unpriced')}</p>
    <p className="text-xs text-slate-600">{catalog.kind === 'identified' ? t(`inventory.${catalog.edition}`) : t('inventory.unidentified')}</p>
  </Card>;
}
