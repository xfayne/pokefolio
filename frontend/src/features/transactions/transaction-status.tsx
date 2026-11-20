import { useTranslation } from 'react-i18next';
import { LuCheck, LuCircleCheck, LuTruck } from 'react-icons/lu';
import type { HistoryStatus } from '@/domain/transaction-history';
import { cn } from '@/lib/utils';

export function TransactionStatus({ status, className }: { status: HistoryStatus; className?: string }) {
  const { t } = useTranslation();
  return <span className={cn(`history-status history-status-${status}`, className)}>
    {status === 'inTransit' ? <LuTruck aria-hidden /> : status === 'received' || status === 'completed' ? <LuCircleCheck aria-hidden /> : status === 'partial' ? <LuCheck aria-hidden /> : null}
    {t(`transactionHistory.${status}`)}
  </span>;
}
