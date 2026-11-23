import { type PortfolioRecord } from './persistence';
import { type PurchaseShipment } from './purchase-details';
import { type Shipment, type TrackingState } from './schema';

export function unreadTracking(shipment: Shipment): number {
  const t = shipment.tracking;
  return t?.initialized ? t.events.filter(e => !t.seenEventIds.includes(e.id)).length : 0;
}
export function trackingState(previous: TrackingState | undefined, incoming: Omit<TrackingState, 'seenEventIds' | 'initialized'>): TrackingState {
  const ids = incoming.events.map(e => e.id);
  return { ...incoming, initialized: !!ids.length || !!previous?.initialized,
    seenEventIds: previous?.initialized ? previous.seenEventIds : ids };
}
export function shipmentSnapshots(records: readonly PortfolioRecord[]): PurchaseShipment[] {
  return records.flatMap(e => {
    if (e.collection !== 'shipments') return [];
    const s = e.record;
    const activeCopyIds = new Set(records.flatMap(c => c.collection === 'copies' && !c.record.removedFromImport ? [c.record.id] : []));
    const members = records.flatMap(m => m.collection === 'memberships' && m.record.shipmentId === s.id && activeCopyIds.has(m.record.copyId) ? [m.record] : []).sort((a,b) => a.ordinal-b.ordinal);
    const transactionId = members[0]?.transactionId;
    if (!transactionId || members.some(m => m.transactionId !== transactionId)) return [];
    const copies = members.flatMap(m => records.flatMap(c => c.collection === 'copies' && c.record.id === m.copyId ? [c.record] : []));
    const received = copies.length === members.length && copies.every(c => c.possession === 'received');
    const transit = ['InTransit','AvailableForPickup','OutForDelivery','Delivered','DeliveryFailure','Exception'].includes(s.tracking?.status ?? '');
    return [{ id: s.id, ownerUid: s.ownerUid, transactionId, copyIds: members.map(m => m.copyId), carrier: s.carrier ?? '—', trackingNumber: s.trackingNumber,
      status: received ? 'received' as const : transit ? 'inTransit' as const : 'pending' as const,
      providerStatus: s.tracking?.status, unreadCount: unreadTracking(s),
      events: (s.tracking?.events ?? []).map(event => ({ id:event.id, code:'other' as const,
        description: [event.description, event.location].filter(Boolean).join(' · ') || event.stage || '—',
        occurredAt: event.time && Number.isFinite(Date.parse(event.time)) ? new Date(event.time).toISOString() : null,
      })),
    }];
  });
}
