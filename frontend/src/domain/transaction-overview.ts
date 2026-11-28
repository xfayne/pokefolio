import { safeInteger, type Metric } from './money';
import { referenceConverter, selectSaleFigures, type FxRow } from './performance';
import type { Currency } from './schema';
import type { HistoryData, HistoryTransaction } from './transaction-history';

export const overviewPeriods = ['1M', '3M', '1Y', 'All'] as const;
export type OverviewPeriod = typeof overviewPeriods[number];
export type OverviewMode = 'net' | 'purchases' | 'sales';
type Figures = { purchases: number | null; sales: number | null; realized: number | null };
const zero: Figures = { purchases: 0, sales: 0, realized: 0 };
const add = (a: number | null, b: number | null) => a === null || b === null ? null : safeInteger(BigInt(a) + BigInt(b));
const combine = (a: Figures, b: Figures): Figures => ({
  purchases: add(a.purchases, b.purchases), sales: add(a.sales, b.sales), realized: add(a.realized, b.realized),
});
const minor = (metric: Metric) => metric.status === 'unavailable' ? null : metric.minor;
const dateAt = (date: Date) => date.toISOString().slice(0, 10);
const dateObject = (date: string) => new Date(`${date}T00:00:00Z`);
const shiftMonth = (month: string, offset: number) => {
  const next = dateObject(`${month}-01`);
  next.setUTCMonth(next.getUTCMonth() + offset);
  return dateAt(next).slice(0, 7);
};

export function transactionDate(transaction: HistoryTransaction): string | null {
  if (!('origin' in transaction)) return transaction.transactionOn;
  return transaction.transactionOn.status === 'known' ? transaction.transactionOn.value : null;
}

export function overviewAmount(figures: Figures, mode: OverviewMode) {
  if (mode !== 'net') return figures[mode];
  return add(figures.sales, figures.purchases === null ? null : -figures.purchases);
}

export function selectCardsOnTheWay({ copies, transactions }: HistoryData) {
  const purchases = new Map(transactions.filter(value => value.kind === 'purchase').map(value => [value.id, value]));
  return copies.flatMap(copy => {
    if (copy.possession !== 'pending' || copy.disposition !== 'held' || copy.acquisition.kind !== 'purchase'
      || copy.removedFromImport || copy.removedFromPurchase) return [];
    const purchase = purchases.get(copy.acquisition.transactionId);
    if (!purchase) return [];
    const date = copy.acquiredOn.status === 'known' ? copy.acquiredOn.value : transactionDate(purchase);
    return [{ copy, date, transactionId: purchase.id }];
  }).sort((a, b) => (a.date ?? '9999-12-31').localeCompare(b.date ?? '9999-12-31') ||
    a.copy.createdAt.localeCompare(b.copy.createdAt) || a.copy.id.localeCompare(b.copy.id));
}

/** Recorded transactions only. Undated purchases cannot be placed on the charts. */
export function selectTransactionOverview(
  data: HistoryData, fx: readonly FxRow[], currency: Currency, today: string, period: OverviewPeriod,
) {
  const convert = referenceConverter(fx);
  const activity = new Map<string, Figures>();
  let undated = 0;
  const purchaseDates = new Map<string, string>();
  const record = (date: string, figures: Figures) => {
    if (date <= today) activity.set(date, combine(activity.get(date) ?? zero, figures));
  };
  const sales = data.transactions.filter(transaction => transaction.kind === 'sale');
  for (const sale of selectSaleFigures(sales, data.saleLines, data.copies, currency, convert)) {
    record(sale.date, { ...zero, sales: minor(sale.proceeds), realized: minor(sale.profit) });
  }
  for (const purchase of data.transactions) {
    if (purchase.kind !== 'purchase') continue;
    const date = transactionDate(purchase);
    if (!date) { undated++; continue; }
    purchaseDates.set(purchase.id, date);
    const payable = 'origin' in purchase ? purchase.payable.status === 'known' ? purchase.payable.value : null : purchase.payable;
    record(date, { ...zero, purchases: payable ? minor(convert(payable, currency, date)) : null });
  }
  const currentMonth = today.slice(0, 7);
  const allStart = [...activity.keys()].sort()[0]?.slice(0, 7) ?? currentMonth;
  const start = period === 'All' ? allStart : shiftMonth(currentMonth, period === '1M' ? 0 : period === '3M' ? -2 : -11);
  const byMonth = new Map<string, Figures>();
  for (const [date, figures] of activity) {
    const month = date.slice(0, 7);
    if (month >= start) byMonth.set(month, combine(byMonth.get(month) ?? zero, figures));
  }
  const months: { date: string; figures: Figures }[] = [];
  for (let month = start; month <= currentMonth; month = shiftMonth(month, 1)) {
    months.push({ date: `${month}-01`, figures: byMonth.get(month) ?? zero });
  }
  const total = months.reduce((sum, month) => combine(sum, month.figures), zero);
  const selectedPurchases = new Set([...purchaseDates].filter(([, date]) =>
    date <= today && date.slice(0, 7) >= start).map(([id]) => id));
  const cardCount = data.copies.filter(copy =>
    copy.acquisition.kind === 'purchase' && selectedPurchases.has(copy.acquisition.transactionId)).length;
  const saleCount = sales.filter(sale => !sale.reversedAt && sale.transactionOn <= today && sale.transactionOn.slice(0, 7) >= start).length;
  return {
    total, thisMonth: byMonth.get(currentMonth) ?? zero, months, undated,
    purchaseCount: selectedPurchases.size, cardCount, saleCount,
  };
}
