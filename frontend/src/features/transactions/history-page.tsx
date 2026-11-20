import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/surfaces';
import type { HistoryData } from '@/domain/transaction-history';
import { TransactionHistory } from './transaction-history';
import { sampleHistory } from './sample';

const disconnected: HistoryData = { ownerUid: 'disconnected', transactions: [], copies: [], saleLines: [], catalog: [], inTransit: [] };
export function HistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const preview = params.get('transactions') === 'sample';
  return <TransactionHistory data={preview ? sampleHistory : disconnected} canOpen={row => row.kind === 'purchase'} onOpen={id => { void navigate({ pathname: `/transactions/purchases/${id}`, search: location.search }, { state: { purchaseFrom: 'history' } }); }} empty={<EmptyState title={t('transactionHistory.disconnected')} description={t('transactionHistory.connectionDetail')} action={<Button onClick={() => {
    const next = new URLSearchParams(params); next.set('transactions', 'sample'); setParams(next);
  }}>{t('transactionHistory.explore')}</Button>} />} />;
}
