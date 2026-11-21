import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type PortfolioRecord } from '@/domain/persistence';
import { trackingState } from '@/domain/shipment-tracking';
import { updateShipment } from '@/domain/receipt';
import { readPortfolio, commitPortfolio } from '@/services/portfolio';
import { getFirebaseServices } from '@/services/firebase';
import { getEnvironment } from '@/services/environment';
import { registerAndTrack } from '@/services/shipment-tracking';

// Mounted once by the shell. Data, status and unread markers remain owner-scoped.
export function useTrackingSync(owner: string | undefined, records: readonly PortfolioRecord[], enabled = true) {
  const client = useQueryClient();
  const numbers = records.flatMap(e => e.collection === 'shipments' && e.record.trackingNumber ? [e.record.trackingNumber.trim().toUpperCase()] : []).sort();
  return useQuery({
    queryKey: ['tracking', owner, numbers], enabled: enabled && !!owner && !!numbers.length && !!getEnvironment()?.workerUrl,
    staleTime: 120_000, refetchInterval: 120_000, retry: false,
    queryFn: async () => {
      const services = getFirebaseServices();
      if (!services || services.auth.currentUser?.uid !== owner) throw Error('Sign in before tracking');
      const current = await readPortfolio(services.db, owner!);
      const shipments = current.flatMap(e => e.collection === 'shipments' && e.record.trackingNumber ? [e.record] : []);
      // Share a provider lookup for identical references without mixing private records.
      const unique = [...new Map(shipments.map(s => [s.trackingNumber!.trim().toUpperCase(),s])).values()];
      try {
        const results = await registerAndTrack(owner!,unique);
        for (const shipment of shipments) {
          if (services.auth.currentUser?.uid !== owner) throw Error('Account changed');
          const result = results.find(r => r.number === shipment.trackingNumber!.trim().toUpperCase())!;
          if (result.error) continue;
          const tracking = trackingState(shipment.tracking, {registered:true,carrier:result.carrier ?? null,status:result.status!,events:result.events!});
          if (JSON.stringify(tracking) === JSON.stringify(shipment.tracking)) continue;
          await commitPortfolio(services.db,owner!,updateShipment(shipment,{tracking},new Date().toISOString()));
        }
        const failed = results.find(r => r.error);
        if (failed?.error) throw Error(failed.error.message);
      } finally {
        await client.invalidateQueries({queryKey:['portfolio',owner]});
      }
      return true;
    },
  });
}
