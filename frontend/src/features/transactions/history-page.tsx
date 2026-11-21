import { PortfolioStatus } from '@/features/portfolio-status';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/surfaces';
import type { HistoryData } from '@/domain/transaction-history';
import { TransactionHistory } from './transaction-history';
import { useDemoTransactionData } from './demo-data';

const disconnected: HistoryData = { ownerUid: 'disconnected', transactions: [], copies: [], saleLines: [], catalog: [], inTransit: [] };
export function HistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const demo = useDemoTransactionData();
  const account = usePortfolio();
  const preview = params.get('transactions') === 'sample';
  if (!preview && (account.loading || account.error)) return <PortfolioStatus loading={account.loading} error={account.error} />;
  return <TransactionHistory data={preview ? demo.history : account.owner ? account.history : disconnected} canOpen={row => row.kind === 'purchase'} onOpen={id => { void navigate({ pathname: `/transactions/purchases/${id}`, search: location.search }, { state: { purchaseFrom: 'history' } }); }} empty={account.owner ? <EmptyState title={t('newPurchase.cards')} description={t('transactionHistory.noCopies')} /> : <EmptyState title={t('transactionHistory.disconnected')} description={t('transactionHistory.connectionDetail')} action={<Button onClick={() => {
    const next = new URLSearchParams(params); next.set('transactions', 'sample'); setParams(next);
  }}>{t('transactionHistory.explore')}</Button>} />} />;
}
