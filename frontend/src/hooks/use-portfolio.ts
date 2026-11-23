import { shipmentSnapshots } from '@/domain/shipment-tracking';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { getFirebaseServices } from '@/services/firebase';
import { commitPortfolio, readPortfolio } from '@/services/portfolio';
import { catalogCards } from '@/features/catalog/catalog';
import type { PortfolioCommit } from '@/domain/persistence';
import type { HistoryData } from '@/domain/transaction-history';
export function usePortfolio() {
  const auth = useAuth();
  const owner = auth.user?.uid;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['portfolio', owner],
    enabled: !!owner,
    queryFn: () => readPortfolio(getFirebaseServices()!.db, owner!),
    retry: 1,
  });
  const records = owner ? (query.data ?? []) : [];
  const shipments = shipmentSnapshots(records);
  const history: HistoryData = {
    ownerUid: owner ?? 'disconnected',
    catalog: catalogCards,
    transactions: records.flatMap((e) =>
      e.collection === 'transactions' ? [e.record] : [],
    ),
    copies: records.flatMap((e) =>
      e.collection === 'copies' && !e.record.removedFromImport ? [e.record] : [],
    ),
    saleLines: records.flatMap(e => e.collection === 'lines' && 'copyId' in e.record ? [e.record] : []),
    // A private tracking number is not evidence that the carrier has the parcel.
    inTransit: shipments.filter(s => s.status === 'inTransit').map(s => ({ownerUid: s.ownerUid, transactionId: s.transactionId})),
  };
  async function save(command: PortfolioCommit) {
    if (!owner || getFirebaseServices()?.auth.currentUser?.uid !== owner)
      throw Error('Sign in before saving');
    await commitPortfolio(getFirebaseServices()!.db, owner, command);
    await client.invalidateQueries({ queryKey: ['portfolio', owner] });
  }
  return {
    owner,
    records,
    history,
    shipments,
    save,
    loading: auth.status === 'loading' || (!!owner && query.isPending),
    error: auth.error ?? query.error,
  };
}
