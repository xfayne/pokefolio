import { unreadTracking } from '@/domain/shipment-tracking';
import { updateShipment } from '@/domain/receipt';
import {useDisplayMoney} from '@/services/display-currency';
import { PortfolioStatus } from '@/features/portfolio-status';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/surfaces';
import { selectPurchaseDetails } from '@/domain/purchase-details';
import type { HistoryData } from '@/domain/transaction-history';
import type { InventoryGroup } from '@/domain/inventory';
import { idSchema } from '@/domain/schema';
import { CardDetailsSheet } from '@/features/inventory/collection-cards';
import { PurchaseDetails } from './purchase-details';
import { useDemoTransactionData } from './demo-data';

const disconnected: HistoryData = { ownerUid: 'disconnected', transactions: [], copies: [], catalog: [], saleLines: [], inTransit: [] };
export function PurchasePage({onRefresh,refreshing,trackingErrors,trackingFailed}: {trackingErrors?: Record<string,string> | undefined; trackingFailed?: boolean | undefined; onRefresh?: (() => void) | undefined; refreshing?: boolean | undefined}) {
  const { t } = useTranslation();
  const { transactionId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [inspecting, setInspecting] = useState<string | null>(null);
  const location = useLocation();
  const demo = useDemoTransactionData();
  const account = usePortfolio();
  const preview = params.get('transactions') === 'sample';
  const reading = useRef(false);
  const readMarker = account.records.find(e => e.collection === 'shipments' && account.records.some(m => m.collection === 'memberships' && m.record.shipmentId === e.record.id && m.record.transactionId === transactionId));
  useEffect(() => {
    if (preview || reading.current || readMarker?.collection !== 'shipments' || !readMarker.record.tracking || !unreadTracking(readMarker.record)) return;
    reading.current = true;
    const s = readMarker.record;
    void account.save(updateShipment(s, {tracking:{...s.tracking!,seenEventIds:s.tracking!.events.map(e => e.id)}},new Date().toISOString()))
      .catch(() => { /* A concurrent refresh keeps the events unread until the next visit. */ })
      .finally(() => { reading.current = false; });
  }, [preview, readMarker, account]);
  const view = useMemo(() => idSchema.safeParse(transactionId).success ? selectPurchaseDetails(preview ? demo.history : account.owner ? account.history : disconnected, transactionId, preview ? demo.shipments : account.shipments) : null, [preview, transactionId, demo, account.history, account.owner, account.shipments]);
  useEffect(() => { document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [transactionId]);
  const selected = view?.copies.find(c => c.copy.id === inspecting);
  const currency = view?.row.currency ?? 'USD';
  const group: InventoryGroup | null = selected ? {
    key: selected.card?.id ?? selected.copy.id, card: selected.card,
    copies: [{ copy: selected.copy, paid: selected.copy.cardCost, basis: selected.basis, market: { status: 'unavailable', reason: 'No quote' } }],
    receivedCount: Number(selected.copy.possession === 'received'), pendingCount: Number(selected.copy.possession === 'pending'), unknownPossessionCount: Number(selected.copy.possession === 'unknown'),
    market: { currency, minor: 0, pricedCount: 0, missingCount: 1 },
  } : null;
  const money = useDisplayMoney();
  if (!preview && (account.loading || account.error)) return <PortfolioStatus loading={account.loading} error={account.error} />;
  if (!view) return <EmptyState title={t('purchaseDetails.notFound')} description={t('purchaseDetails.notFoundDetail')} action={<Button variant="outline" onClick={() => { void navigate({ pathname: '/transactions/history', search: params.toString() }); }}>{t('purchaseDetails.back')}</Button>} />;
  return <>
    {(location.state as { demoSaved?: boolean } | null)?.demoSaved && <p role="status" className="text-sm text-slate-600">{t('newPurchase.demoSaved')}</p>}
    <PurchaseDetails view={view} onInspect={copy => setInspecting(copy.id)} {...(!preview ? {onRefresh,refreshing,trackingErrors,trackingFailed} : {})} />
    {selected && group && <CardDetailsSheet key={selected.copy.id} group={group} catalog={selected.copy.catalog} quotes={[]} currency={currency} initialCopy={null} initialInspection={selected.copy.id} onClose={() => setInspecting(null)} onViewPurchase={() => setInspecting(null)} money={money}
      cost={c => c.status === 'exact' ? money(c.value) : c.status === 'estimated' ? `${money(c.value)} · ${t('inventory.estimated')}` : t(c.status === 'unallocated' ? 'inventory.unallocated' : 'inventory.unavailable')}
      metric={() => t('inventory.unpriced')} />}
  </>;
}
