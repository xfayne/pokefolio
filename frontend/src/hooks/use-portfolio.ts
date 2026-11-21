import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { getFirebaseServices } from '@/services/firebase';
import { commitPortfolio, readPortfolio } from '@/services/portfolio';
import { catalogCards } from '@/features/catalog/catalog';
import type { PortfolioCommit } from '@/domain/persistence';
import type { HistoryData } from '@/domain/transaction-history';
export function usePortfolio() {
 const auth = useAuth(); const owner=auth.user?.uid; const client=useQueryClient();
 const query=useQuery({queryKey:['portfolio',owner],enabled:!!owner,queryFn:()=>readPortfolio(getFirebaseServices()!.db,owner!),retry:1});
 const records=owner ? query.data ?? [] : [];
 const history: HistoryData={ownerUid:owner ?? 'disconnected',catalog:catalogCards,transactions:records.flatMap(e=>e.collection==='transactions'?[e.record]:[]),copies:records.flatMap(e=>e.collection==='copies'?[e.record]:[]),saleLines:[],inTransit:records.flatMap(e=>e.collection==='memberships'?e.record.transactionId ? [{ownerUid:e.record.ownerUid,transactionId:e.record.transactionId}] : []:[])};
 async function save(command: PortfolioCommit) {
  if (!owner || getFirebaseServices()?.auth.currentUser?.uid !== owner) throw Error('Sign in before saving');
  await commitPortfolio(getFirebaseServices()!.db,owner,command);
  await client.invalidateQueries({queryKey:['portfolio',owner]});
 }
 return {owner,records,history,save,loading:auth.status==='loading'|| (!!owner && query.isPending),error:auth.error ?? query.error};
}
