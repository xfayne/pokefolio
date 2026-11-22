import {useDisplayMoney} from '@/services/display-currency';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { usePortfolio } from '@/hooks/use-portfolio';
import { Card } from '@/components/ui/surfaces';
import { PortfolioStatus } from '@/features/portfolio-status';
export function RecentPurchases() {
  const money=useDisplayMoney();
  const account = usePortfolio();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const he = i18n.language === 'he';
  if (account.loading || account.error)
    return <PortfolioStatus loading={account.loading} error={account.error} />;
  const recent = account.history.transactions
    .filter((p) => p.kind === 'purchase' && !('origin' in p))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  if (!recent.length) return null;
  return (
    <Card className="space-y-2">
      <h2 className="font-bold">
        {he ? 'רכישות אחרונות' : 'Recent purchases'}
      </h2>
      <ul className="divide-y divide-blue-100">
        {recent.map((p) => (
          <li key={p.id}>
            <button
              className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-start text-sm"
              onClick={() => {
                void navigate(`/transactions/purchases/${p.id}`);
              }}
            >
              <span>
                {'source' in p ? (p.source.seller ?? p.source.kind) : p.id}
                <br />
                <span className="text-xs text-slate-600">
                  {typeof p.transactionOn === 'string' ? p.transactionOn : ''}
                </span>
              </span>
              <bdi>
                {p.kind === 'purchase' && !('origin' in p)
                  ? money(p.payable)
                  : ''}
              </bdi>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
