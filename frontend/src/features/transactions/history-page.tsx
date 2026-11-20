import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/surfaces';
import type { HistoryData } from '@/domain/transaction-history';
import { TransactionHistory } from './transaction-history';
import { sampleHistory } from './sample';

const disconnected: HistoryData = { ownerUid: 'disconnected', transactions: [], copies: [], saleLines: [], catalog: [], inTransit: [] };
export function HistoryPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const preview = params.get('transactions') === 'sample';
  return <TransactionHistory data={preview ? sampleHistory : disconnected} empty={<EmptyState title={t('transactionHistory.disconnected')} description={t('transactionHistory.connectionDetail')} action={<Button onClick={() => {
    const next = new URLSearchParams(params); next.set('transactions', 'sample'); setParams(next);
  }}>{t('transactionHistory.explore')}</Button>} />} />;
}
