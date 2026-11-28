import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { LuChartNoAxesCombined, LuChevronDown, LuChevronRight, LuTag, LuTruck, LuWallet } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { CardCarousel } from '@/components/ui/card-carousel';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { ValueChart } from '@/components/ui/value-chart';
import { catalogCards } from '@/features/catalog/catalog';
import { PortfolioStatus } from '@/features/portfolio-status';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useDisplayCurrency } from '@/services/display-currency';
import { useHistoricalFx } from '@/services/historical-fx';
import {
  overviewAmount, overviewPeriods, selectCardsOnTheWay, selectTransactionOverview, transactionDate,
  type OverviewMode, type OverviewPeriod,
} from '@/domain/transaction-overview';
import { useDemoTransactionData } from './demo-data';

const labels = {
  en: {
    net: 'Total net', purchases: 'Purchases', sales: 'Sales', cardsPurchased: 'Cards purchased', spend: 'Purchase spend', proceeds: 'Net sale proceeds',
    realized: 'Realized P/L', month: 'This month', activity: 'Monthly activity', netSales: 'Net sales',
    metric: 'Chart metric', period: 'Chart period', explore: 'Explore chart', all: 'All', emptyChart: 'No amounts to chart.',
    unavailable: 'Some amounts or exchange rates are unavailable.', undated: 'Purchases without known dates are excluded.',
    cards: 'Cards on the way', emptyCards: 'No cards on the way.', viewAll: 'View all', unknown: 'Unknown card',
    shipments: 'Shipment updates', allShipments: 'All shipments', emptyShipments: 'No shipment updates yet.',
    unread: 'Unread update', signIn: 'Sign in to see your transactions.',
  },
  he: {
    net: 'סה״כ נטו', purchases: 'רכישות', sales: 'מכירות', cardsPurchased: 'קלפים שנרכשו', spend: 'סכום הרכישות', proceeds: 'תמורה נטו ממכירות',
    realized: 'רווח או הפסד ממומש', month: 'החודש', activity: 'פעילות חודשית', netSales: 'מכירות נטו',
    metric: 'מדד הגרף', period: 'תקופת הגרף', explore: 'בדיקת הגרף', all: 'הכול', emptyChart: 'אין סכומים להצגה.',
    unavailable: 'חלק מהסכומים או שערי ההמרה חסרים.', undated: 'רכישות ללא תאריך ידוע אינן כלולות.',
    cards: 'קלפים בדרך', emptyCards: 'אין קלפים בדרך.', viewAll: 'הצגת הכול', unknown: 'קלף לא מזוהה',
    shipments: 'עדכוני משלוחים', allShipments: 'כל המשלוחים', emptyShipments: 'אין עדיין עדכוני משלוחים.',
    unread: 'עדכון שטרם נקרא', signIn: 'התחבר כדי לראות את העסקאות שלך.',
  },
};

const cardById = new Map(catalogCards.map(card => [card.id, card]));

export function OverviewPage() {
  const { t, i18n } = useTranslation();
  const he = i18n.language === 'he';
  const text = labels[he ? 'he' : 'en'];
  const locale = he ? 'he-IL' : 'en-US';
  const id = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<OverviewPeriod>('3M');
  const [mode, setMode] = useState<OverviewMode>('net');
  const account = usePortfolio();
  const demo = useDemoTransactionData();
  const preview = new URLSearchParams(location.search).get('transactions') === 'sample';
  const { history, shipments } = preview ? demo : account;
  const display = useDisplayCurrency();
  const currency = preview ? 'USD' : display?.currency ?? 'USD';
  const today = new Date().toISOString().slice(0, 10);
  const fxDates = history.transactions.flatMap(transaction => {
    const date = transactionDate(transaction);
    const nativeCurrency = 'origin' in transaction
      ? transaction.currency.status === 'known' ? transaction.currency.value : null
      : transaction.currency;
    return date && date <= today && nativeCurrency && nativeCurrency !== currency ? [date] : [];
  });
  const copyById = new Map(history.copies.map(copy => [copy.id, copy]));
  for (const line of history.saleLines) {
    const acquired = copyById.get(line.copyId)?.acquiredOn;
    if (acquired?.status === 'known' && acquired.value <= today && line.basisCosts?.some(cost =>
      (cost.status === 'exact' || cost.status === 'estimated') && cost.value.currency !== currency)) fxDates.push(acquired.value);
  }
  const fx = useHistoricalFx(fxDates, today, !preview && !!account.owner && fxDates.length > 0);

  if (!preview && (account.loading || account.error)) return <PortfolioStatus loading={account.loading} error={account.error} />;
  if (!preview && !account.owner) return <EmptyState title={t('transactionHistory.disconnected')} description={text.signIn}
    action={<Button onClick={() => {
      const search = new URLSearchParams(location.search);
      search.set('transactions', 'sample');
      void navigate({ search: search.toString() });
    }}>{t('transactionHistory.explore')}</Button>} />;

  const figures = selectTransactionOverview(history, fx.rows, currency, today, period);
  const formatCurrency = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 });
  const format = (value: number | null) => value === null ? '—' : formatCurrency.format(value / 100);
  const shortDate = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'short', timeZone: 'UTC', ...(figures.months.length > 12 ? { year: '2-digit' } : {}),
  });
  const points = figures.trend.map(point => ({ date: point.date, value: overviewAmount(point.figures, mode) }));
  const total = overviewAmount(figures.total, mode);
  const current = overviewAmount(figures.thisMonth, mode);
  const purchaseUrl = (transactionId: string, copyId?: string) => {
    const params = new URLSearchParams(location.search);
    if (copyId) params.set('copy', copyId);
    return { pathname: `/transactions/purchases/${transactionId}`, search: params.toString() };
  };
  const shipmentHistory = new URLSearchParams(location.search);
  shipmentHistory.set('shipments', '1');
  const trackingByShipment = new Map(account.records.flatMap(entry =>
    entry.collection === 'shipments' && entry.record.tracking ? [[entry.record.id, entry.record.tracking] as const] : []));
  const events = shipments.flatMap(shipment => {
    const tracking = preview ? undefined : trackingByShipment.get(shipment.id);
    const seen = new Set(tracking?.seenEventIds);
    return shipment.events.map(event => ({ shipment, event, unread: !!tracking?.initialized && !seen.has(event.id) }));
  }).sort((a, b) => (b.event.occurredAt ?? '').localeCompare(a.event.occurredAt ?? '')).slice(0, 2);
  const bars = figures.months.map(month => ({
    date: month.date, label: monthLabel.format(new Date(month.date)),
    purchases: month.figures.purchases, sales: month.figures.sales,
  }));
  const unavailable = total === null || (mode === 'sales' && figures.total.realized === null);
  const counts = new Intl.NumberFormat(locale);
  const metrics = mode === 'net' ? [
    { label: text.spend, value: format(figures.total.purchases), Icon: LuWallet },
    { label: text.proceeds, value: format(figures.total.sales), Icon: LuTag },
  ] : mode === 'purchases' ? [
    { label: text.purchases, value: counts.format(figures.purchaseCount), Icon: LuWallet },
    { label: text.cardsPurchased, value: counts.format(figures.cardCount), Icon: LuTag },
  ] : [
    { label: text.sales, value: counts.format(figures.saleCount), Icon: LuWallet },
    { label: text.realized, value: format(figures.total.realized), Icon: LuTag },
  ];

  return <div className="transactions-overview">
    <Card className="overview-figures" aria-labelledby={`${id}-metric`}>
      <div className="dashboard-value-heading items-center">
        <h2 id={`${id}-metric`} className="text-lg font-bold">{text[mode]}</h2>
        <label className="dashboard-icon-control">
          <LuChartNoAxesCombined aria-hidden /><LuChevronDown aria-hidden className="dashboard-chevron" />
          <select aria-label={text.metric} value={mode} onChange={event => setMode(event.target.value as OverviewMode)}>
            <option value="net">{text.net}</option><option value="purchases">{text.purchases}</option><option value="sales">{text.sales}</option>
          </select>
        </label>
      </div>
      <div className="overview-amount">
        <bdi className="dashboard-big">{format(total)}</bdi>
        <div><span>{text.month}</span><bdi>{format(current)}</bdi></div>
      </div>
      <ValueChart key={`${mode}-${period}`} points={points} label={text[mode]} format={format} empty={text.emptyChart} explore={text.explore} />
      <div className="dashboard-kpis">
        {metrics.map(({ label, value, Icon }, index) => <div key={label}>
          <Icon aria-hidden className={index === 0 ? 'text-blue-600' : 'text-teal-600'} />
          <span><span className="dashboard-stat-label">{label}</span><bdi>{value}</bdi></span>
        </div>)}
      </div>
      {(unavailable || (figures.undated > 0 && mode !== 'sales')) && <p className="dashboard-note">
        {unavailable ? fx.loading ? t('loading') : text.unavailable : null}{unavailable && figures.undated > 0 && mode !== 'sales' ? ' ' : ''}
        {figures.undated > 0 && mode !== 'sales' ? text.undated : null}
      </p>}
      <section className="overview-activity" aria-labelledby={`${id}-activity`}>
        <div className="overview-activity-heading">
          <h3 id={`${id}-activity`} className="font-bold">{text.activity}</h3>
          <div className="overview-legend">
            {mode !== 'sales' && <span data-series="purchases">{text.purchases}</span>}
            {mode !== 'purchases' && <span data-series="sales">{text.netSales}</span>}
          </div>
        </div>
        <MonthlyActivity bars={bars} mode={mode} title={text.activity} labels={text} format={format} />
      </section>
      <div className="dashboard-periods" role="group" aria-label={text.period}>
        {overviewPeriods.map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>
          {value === 'All' ? text.all : value}
        </button>)}
      </div>
    </Card>
    <CardCarousel title={text.cards} actionLabel={text.viewAll} empty={text.emptyCards}
      onAction={() => { void navigate('/search?cards=on-the-way', { state: { backgroundLocation: location } }); }}
      items={selectCardsOnTheWay(history).slice(0, 12).map(({ copy, date, transactionId }) => {
        const card = copy.catalog.kind === 'identified' ? cardById.get(copy.catalog.cardId) : undefined;
        const name = card?.name ?? (copy.catalog.kind === 'unidentified' ? copy.catalog.description : text.unknown);
        return {
          id: copy.id, name, imageUrl: card?.imageUrl, showName: true,
          caption: date ? <time dateTime={date}>{shortDate.format(new Date(date))}</time> : '—',
          onOpen: () => { void navigate(purchaseUrl(transactionId, copy.id), { state: { purchaseFrom: 'history' } }); },
        };
      })} />
    <Card className="overview-shipments" aria-labelledby={`${id}-shipments`}>
      <div className="dashboard-section-heading">
        <h2 id={`${id}-shipments`} className="font-bold">{text.shipments}</h2>
        <Link to={{ pathname: '/transactions/history', search: shipmentHistory.toString() }}>
          {text.allShipments}<LuChevronRight aria-hidden />
        </Link>
      </div>
      {events.length ? <ul>{events.map(({ shipment, event, unread }) =>
        <li key={`${shipment.id}:${event.id}`}>
          <Link to={purchaseUrl(shipment.transactionId)} state={{ purchaseFrom: 'history' }}>
            <span className="overview-shipment-icon"><LuTruck aria-hidden /></span>
            <span className="overview-shipment-description">
              <strong>{event.description}</strong>
              <span>{shipment.carrier === '—' ? '' : `${shipment.carrier} · `}{t('transactionHistory.copies', { count: shipment.copyIds.length })}</span>
            </span>
            {event.occurredAt && <time dateTime={event.occurredAt}>{shortDate.format(new Date(event.occurredAt))}</time>}
            {unread && <span className="overview-shipment-unread"><span className="sr-only">{text.unread}</span></span>}
          </Link>
        </li>)}</ul> : <p className="dashboard-empty">{text.emptyShipments}</p>}
    </Card>
  </div>;
}


type MonthBar = { date: string; label: string; purchases: number | null; sales: number | null };

function MonthlyActivity({ bars, mode, title, labels: text, format }: {
  bars: readonly MonthBar[]; mode: OverviewMode; title: string; labels: typeof labels.en; format: (value: number | null) => string;
}) {
  const series = mode === 'net' ? ['purchases', 'sales'] as const : [mode];
  const values = bars.flatMap(bar => series.flatMap(key => bar[key] === null ? [] : [bar[key]]));
  const grossMax = values.reduce((max, value) => Math.max(max, value), 1);
  const grossMin = values.reduce((min, value) => Math.min(min, value), 0);
  const y = (value: number) => 8 + (grossMax - value) / (grossMax - grossMin) * 81;
  const width = 305 / bars.length;
  const barWidth = Math.min(18, width * (series.length === 2 ? 0.3 : 0.62));
  const tickInterval = Math.ceil(bars.length / 6);
  return <svg className="overview-bars" viewBox="0 0 360 112" role="img" aria-label={title}>
    {(grossMin < 0 ? [grossMax, 0, grossMin] : [grossMax, grossMax / 2, 0]).map(value => <g key={value}>
      <path d={`M47 ${y(value)}H357`} stroke="#cbdcf0" />
      <text x="40" y={y(value) + 3} textAnchor="end">{format(value)}</text>
    </g>)}
    {bars.map((bar, index) => {
      const center = 49 + width * (index + 0.5);
      return <g key={bar.date}>
        <title>{[bar.date.slice(0, 7), ...series.map(key => `${key === 'purchases' ? text.purchases : text.netSales}: ${format(bar[key])}`)].join(' · ')}</title>
        {series.map((key, slot) => {
          const value = bar[key];
          const x = center + (slot - (series.length - 1) / 2) * barWidth * 1.22 - barWidth / 2;
          return value === null ? <text key={key} x={x + barWidth / 2} y={y(0) - 3} textAnchor="middle">–</text>
            : <rect key={key} x={x} y={Math.min(y(value), y(0))} width={barWidth} height={Math.abs(y(0) - y(value))}
              rx={Math.min(2, barWidth / 3)} data-series={key} />;
        })}
        {(index === bars.length - 1 || index % tickInterval === 0 && index < bars.length - tickInterval + 1)
          && <text x={center} y="105" textAnchor="middle">{bar.label}</text>}
      </g>;
    })}
  </svg>;
}
