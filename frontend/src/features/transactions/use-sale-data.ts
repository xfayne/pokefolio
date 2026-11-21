import { usePortfolio } from '@/hooks/use-portfolio';
import { useSearchParams } from 'react-router';
import type { PortfolioRecord } from '@/domain/persistence';
import { useDemoTransactionData } from './demo-data';
import { useDemoPortfolio } from './demo-context';

export function useSaleData() {
  const account = usePortfolio();
  const demo = useDemoTransactionData();
  const adapter = useDemoPortfolio();
  const [params] = useSearchParams();
  const preview = params.get('transactions') === 'sample';
  const records: readonly PortfolioRecord[] = preview ? [
    ...demo.history.transactions.map(record => ({ collection: 'transactions' as const, record })),
    ...demo.history.copies.map(record => ({ collection: 'copies' as const, record })),
    ...demo.history.saleLines.map(record => ({ collection: 'lines' as const, record })),
  ] : account.records;
  return { ...account, records, history: preview ? demo.history : account.history, save: preview ? adapter.commitSale : account.save, owner: preview ? demo.history.ownerUid : account.owner,
    loading: !preview && account.loading, error: !preview && account.error, preview, search: params.toString() };
}
