import { z } from 'zod';
import { trackingEventSchema, type Shipment } from '@/domain/schema';
import { createApiClient } from './api';
import { getEnvironment } from './environment';
import { getFirebaseServices, getIdToken } from './firebase';

const resultSchema = z.object({
  number: z.string(), carrier: z.number().int().positive().nullable().optional(),
  registered: z.boolean().optional(), status: z.string().max(40).optional(),
  events: z.array(trackingEventSchema).max(150).optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});
const responseSchema = z.object({ shipments: z.array(resultSchema) });
export type TrackingResult = z.infer<typeof resultSchema>;
export function trackingClient(owner: string) {
  const env = getEnvironment();
  if (!env?.workerUrl) throw Error('Tracking service unavailable');
  return createApiClient(env.workerUrl, async () => {
    if (getFirebaseServices()?.auth.currentUser?.uid !== owner) throw Error('Sign in before tracking');
    return getIdToken();
  });
}
export function providerCarrier(shipment: Shipment): number | undefined {
  if (shipment.tracking?.carrier) return shipment.tracking.carrier;
  const raw = shipment.carrier?.trim() ?? '';
  return /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : undefined;
}
export async function registerAndTrack(owner: string, shipments: readonly Shipment[]): Promise<TrackingResult[]> {
  const client = trackingClient(owner);
  const results: TrackingResult[] = [];
  for (const shipment of shipments) {
    if (shipment.tracking?.registered) continue;
    const number = shipment.trackingNumber!.trim().toUpperCase();
    const response = responseSchema.parse((await client.post('/api/shipments/register', { number, carrier: providerCarrier(shipment) })).data);
    const registered = response.shipments.find(s => s.number === number);
    if (!registered?.registered) results.push({number,error:registered?.error ?? {code:0,message:'Could not register tracking'}});
  }
  const trackable = shipments.filter(s => !results.some(r => r.number === s.trackingNumber!.trim().toUpperCase()));
  for (let offset = 0; offset < trackable.length; offset += 12) {
    const group = trackable.slice(offset,offset+12);
    const response = responseSchema.parse((await client.post('/api/shipments/track', {shipments:group.map(s => ({number:s.trackingNumber!.trim().toUpperCase(),carrier:providerCarrier(s)}))})).data);
    for (const shipment of group) {
      const result = response.shipments.find(s => s.number === shipment.trackingNumber!.trim().toUpperCase());
      if (!result) throw Error('Missing tracking response');
      if (!result.error && (!result.status || !result.events)) throw Error('Invalid tracking response');
      results.push({...result, registered:true});
    }
  }
  return results;
}
