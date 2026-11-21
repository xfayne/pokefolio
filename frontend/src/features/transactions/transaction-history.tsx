import {useDisplayCurrency,useDisplayMoney} from '@/services/display-currency';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronRight, LuFilter, LuPlus, LuShoppingCart, LuTag } from 'react-icons/lu';
import { TransactionStatus } from './transaction-status';
import { Button } from '@/components/ui/button';
import { DisclosureButton, DisclosureContent } from '@/components/ui/disclosure';
import { ListCard } from '@/components/ui/list-card';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/surfaces';
import { currencySchema } from '@/domain/schema';
import { groupHistory, selectHistory, type HistoryData, type HistoryFilters, type HistoryRow } from '@/domain/transaction-history';

const initialFilters: HistoryFilters = { query: '', kind: 'all', currency: 'all', status: 'all' };
const statuses = ['inTransit', 'received', 'pending', 'partial', 'unknown', 'completed'] as const;
export function TransactionHistory({ data, empty, onCreate, onOpen, canOpen }: {
  data: HistoryData; empty?: ReactNode; onCreate?: () => void; onOpen?: (id: string) => void; canOpen?: (row: HistoryRow) => boolean;
}) {
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const id = useId();
  const rows = useMemo(() => selectHistory(data), [data]);
  const months = useMemo(() => groupHistory(rows, filters), [rows, filters]);
  const display=useDisplayCurrency(); const formatDisplay=useDisplayMoney();
  const monthlyTotal=(month:ReturnType<typeof groupHistory>[number])=>{const values=month.rows.map(r=>r.minor!==null&&r.currency?display!.convert(r.minor,r.currency):null);return values.some(v=>v===null)?null:values.reduce<number>((sum,v,i)=>sum+v!*(month.rows[i]!.kind==='sale'?1:-1),0);};
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
  const money = (minor: number, currency: NonNullable<HistoryRow['currency']>, signed = false) => display ? formatDisplay({minor,currency}) : new Intl.NumberFormat(locale, {
    style: 'currency', currency, ...(signed ? { signDisplay: 'exceptZero' as const } : {}),
  }).format(minor / 100).replace('-', '−');
  const date = (value: string, monthOnly = false) => new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC', month: monthOnly ? 'long' : 'short', ...(monthOnly ? { year: 'numeric' as const } : { day: 'numeric' as const }),
  }).format(new Date(`${value}${monthOnly ? '-01' : ''}T00:00:00Z`));
  const advancedCount = Number(filters.currency !== 'all') + Number(filters.status !== 'all');
  return <section className="transaction-history" aria-label={t('transactionHistory.title')}>
    <Button className="history-new w-full text-base font-extrabold" aria-disabled={!onCreate} onClick={() => onCreate ? onCreate() : setNotice(t('transactionHistory.createSoon'))}>
      <LuPlus aria-hidden className="size-5" />{t('transactionHistory.new')}
    </Button>
    <div className="history-tools">
      <SearchInput label={t('transactionHistory.search')} placeholder={t('transactionHistory.search')} value={filters.query} onChange={e => setFilters(f => ({ ...f, query: e.target.value }))} />
      <div className="history-filter-row">
        <div role="group" aria-label={t('transactionHistory.title')} className="history-kinds">
          {(['all', 'purchase', 'sale'] as const).map(kind => <Button key={kind} variant={filters.kind === kind ? 'default' : 'outline'} aria-pressed={filters.kind === kind} onClick={() => setFilters(f => ({ ...f, kind }))}>
            {t(`transactionHistory.${kind === 'purchase' ? 'purchases' : kind === 'sale' ? 'sales' : 'all'}`)}
          </Button>)}
        </div>
        <DisclosureButton open={filtersOpen} contentId={`${id}-filters`} onClick={() => setFiltersOpen(v => !v)} aria-label={`${t('transactionHistory.filters')}${advancedCount ? ` (${advancedCount})` : ''}`} className="history-filter-button surface-field">
          <LuFilter aria-hidden className="size-5" />{advancedCount > 0 && <span className="history-filter-count">{advancedCount}</span>}
        </DisclosureButton>
      </div>
      <DisclosureContent id={`${id}-filters`} open={filtersOpen}>
        <div className="history-advanced">
          <label>{t('transactionHistory.currency')}<Select aria-label={t('transactionHistory.currency')} value={filters.currency} onChange={e => setFilters(f => ({ ...f, currency: e.target.value as HistoryFilters['currency'] }))}>
            <option value="all">{t('transactionHistory.any')}</option>{currencySchema.options.map(c => <option key={c} value={c}>{c}</option>)}
          </Select></label>
          <label>{t('transactionHistory.status')}<Select aria-label={t('transactionHistory.status')} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value as HistoryFilters['status'] }))}>
            <option value="all">{t('transactionHistory.any')}</option>{statuses.map(s => <option key={s} value={s}>{t(`transactionHistory.${s}`)}</option>)}
          </Select></label>
          <Button variant="outline" className="col-span-2" onClick={() => setFilters(initialFilters)}>{t('transactionHistory.reset')}</Button>
        </div>
      </DisclosureContent>
    </div>
    <p role="status" className={notice ? 'text-sm text-slate-600' : 'sr-only'}>{notice}</p>
    {!rows.length && empty ? empty : !months.length ? <EmptyState title={t('transactionHistory.noResults')} description={t('transactionHistory.noResultsDetail')} action={<Button variant="outline" onClick={() => setFilters(initialFilters)}>{t('transactionHistory.reset')}</Button>} /> : months.map(month => <section key={month.month ?? 'undated'} aria-labelledby={`${id}-${month.month ?? 'undated'}`} className="history-month">
      <div className="history-month-heading">
        <h2 id={`${id}-${month.month ?? 'undated'}`}>{month.month ? date(month.month, true) : t('transactionHistory.undated')}</h2>
        <div className="history-month-totals" title={t('transactionHistory.monthTotal')}>
          <span className="sr-only">{t('transactionHistory.monthTotal')}: </span>
          {display ? <bdi>{monthlyTotal(month)===null?'—':new Intl.NumberFormat(locale,{style:'currency',currency:display.currency,signDisplay:'exceptZero'}).format(monthlyTotal(month)!/100).replace('-', '−')}</bdi> : month.totals.map(total => <bdi key={total.currency}>{money(total.minor, total.currency, true)}</bdi>)}
          {month.missingCount > 0 && <span className="text-xs text-amber-800">{t('transactionHistory.missing')}</span>}
        </div>
      </div>
      <ul className="history-rows">{month.rows.map(row => <ListCard key={row.id} className="history-row" aria-label={`${t(`transactionHistory.${row.kind}`)} · ${row.source || t(`transactionHistory.${row.sourceKind}`)} · ${row.date ?? t('transactionHistory.undated')}`}>
        <button type="button" className="history-row-content" aria-disabled={!onOpen || (canOpen && !canOpen(row))} onClick={() => onOpen && (!canOpen || canOpen(row)) ? onOpen(row.id) : setNotice(t('transactionHistory.detailSoon'))}>
          <span className="sr-only">{t('transactionHistory.open')}: {row.id}. </span>
          <span className={`history-identity ${row.kind === 'sale' ? 'history-sale' : ''}`}>
            <span className="history-kind-icon">{row.kind === 'sale' ? <LuTag aria-hidden /> : <LuShoppingCart aria-hidden />}</span>
            <span className="min-w-0"><span className="history-kind-label">{t(`transactionHistory.${row.kind}`)}</span><span className="history-source" title={row.source}>
              <span className="history-source-name">{row.sourceKind === 'ebay' ? t('transactionHistory.ebay') : row.source || t(`transactionHistory.${row.sourceKind}`)}</span><span className="history-source-date"> · {row.date ? date(row.date) : t('transactionHistory.undated')}</span>
            </span></span>
          </span>
          <span className="history-cards">
            <span className="history-artwork">{row.cards.slice(0, 3).map(card => <PokemonArt key={card.id} src={card.imageUrl} alt={card.name} className="history-art" />)}</span>
            <span className="history-copy-count">{row.copyCount ? t('transactionHistory.copies', { count: row.copyCount }) : t('transactionHistory.noCopies')}</span>
          </span>
          <span className={`history-amount ${row.kind === 'sale' ? 'history-sale' : ''}`}>
            <span className="history-total-label">{t('transactionHistory.total')}</span>
            <bdi className="history-total">{row.minor !== null && row.currency ? money(row.minor, row.currency) : t('transactionHistory.unavailable')}</bdi>
            <TransactionStatus status={row.status} />
          </span>
          <LuChevronRight aria-hidden className="history-chevron rtl:rotate-180" />
        </button>
      </ListCard>)}</ul>
    </section>)}
  </section>;
}
