import {useDisplayMoney} from '@/services/display-currency';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronRight, LuCopy, LuShoppingCart, LuRefreshCw } from 'react-icons/lu';
import { Card } from '@/components/ui/surfaces';
import { PokemonArt } from '@/components/ui/pokemon-art';
import type { CardCopy, Cost } from '@/domain/schema';
import type { PurchaseDetailsView, PurchaseShipment } from '@/domain/purchase-details';
import { TransactionStatus } from './transaction-status';

export function PurchaseDetails({ view, onInspect, onRefresh, refreshing, trackingErrors, trackingFailed }: { trackingErrors?: Record<string,string> | undefined; trackingFailed?: boolean | undefined; view: PurchaseDetailsView; onInspect: (copy: CardCopy) => void; onRefresh?: (() => void) | undefined; refreshing?: boolean | undefined }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const { transaction, row, copies, shipments } = view;
  const importedRecord = 'origin' in transaction ? transaction : null;
  const imported = importedRecord !== null;
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
  const money = useDisplayMoney();
  const nativeMoney = (value: {currency: string;minor: number}) => new Intl.NumberFormat(locale,{style:'currency',currency:value.currency}).format(value.minor/100);
  const nativeTotals = importedRecord?.nativeCardTotals ?? [];
  const knownAmounts = nativeTotals.length ? nativeTotals.map(nativeMoney).join(' + ') : null;
  const cost = (c: Cost) => c.status === 'exact' ? imported ? nativeMoney(c.value) : money(c.value) : c.status === 'estimated' ? `${money(c.value)} · ${t('purchaseDetails.estimated')}` : t(`purchaseDetails.${c.status === 'unallocated' ? 'unallocated' : 'unknownCost'}`);
  const amount = (value: typeof transaction.shipping) => value.status === 'known' ? money(value.value) : t('purchaseDetails.unknownCost');
  const source = imported ? t('purchaseDetails.legacyImport') : [t(`transactionHistory.${row.sourceKind}`), row.source].filter((s, index, all) => s && all.indexOf(s) === index && !(row.sourceKind === 'manual' && index === 0 && row.source)).join(' · ');
  return <article className="purchase-details" aria-label={t('purchaseDetails.title')}>
    <Card className="purchase-summary">
      <span className="purchase-icon"><LuShoppingCart aria-hidden /></span>
      <div className="min-w-0 flex-1"><h2>{source}</h2><p>{row.date ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${row.date}T00:00:00Z`)) : t('transactionHistory.undated')}</p>
        <p>{t('transactionHistory.purchase')} · {t('transactionHistory.copies', { count: copies.length })}</p>
      </div>
      <TransactionStatus status={row.status} className="purchase-status" />
    </Card>
    {!imported && (transaction.source.listingUrl || transaction.source.itemReference) && <Card className="space-y-2 text-sm">
      {transaction.source.itemReference && <p><span className="text-slate-600">{t('newPurchase.itemReference')}: </span><bdi>{transaction.source.itemReference}</bdi></p>}
      {transaction.source.listingUrl && <a className="break-all text-blue-700 underline" href={transaction.source.listingUrl} target="_blank" rel="noopener noreferrer">{t('newPurchase.listingUrl')}</a>}
    </Card>}
    <Card className="purchase-cards" aria-labelledby={`${id}-cards`}>
      <div className="purchase-section-heading"><h2 id={`${id}-cards`}>{t('purchaseDetails.cards')}</h2><span>{t('purchaseDetails.cardCost')}</span></div>
      {!copies.length && <p className="text-sm text-slate-600">{t('transactionHistory.noCopies')}</p>}
      <ul>{copies.map(({ copy, card }) => <li key={copy.id}>
        <button type="button" className="purchase-copy-row" data-copy-id={copy.id} onClick={() => onInspect(copy)}>
          <PokemonArt src={card?.imageUrl} alt={card?.name ?? t('inventory.unidentified')} className="purchase-art" />
          <span className="purchase-card-identity"><span className="purchase-card-name">{card?.name ?? (copy.catalog.kind === 'unidentified' ? copy.catalog.description : t('inventory.unidentified'))}</span>
            <span className="purchase-card-set">{card ? `${card.setName} · #${card.number}` : t('inventory.noCatalog')}</span>
            <span className={`purchase-condition ${copy.condition.status === 'known' && copy.condition.value === 'NM' ? 'purchase-condition-nm' : ''}`}>{copy.condition.status === 'known' ? copy.condition.value : t('inventory.unknown')}</span>
          </span>
          <bdi className="purchase-card-price">{cost(copy.cardCost)}</bdi><LuChevronRight aria-hidden className="size-4 text-slate-600 rtl:rotate-180" />
        </button>
      </li>)}</ul>
    </Card>
    <Card className="purchase-breakdown" aria-labelledby={`${id}-breakdown`}>
      <h2 id={`${id}-breakdown`}>{t('purchaseDetails.breakdown')}</h2>
      <dl>{([['cards', transaction.subtotal], ['shipping', transaction.shipping], ['taxes', transaction.taxes], ['fees', transaction.fees]] as const).filter(([key, value]) => key === 'cards' || key === 'shipping' || value.status === 'unknown' || value.value.minor !== 0).map(([key, value]) => <div key={key}><dt>{t(`purchaseDetails.${key}`)}</dt><dd><bdi>{key === 'shipping' && importedRecord?.shippingIncludedInCardPrices && value.status !== 'known'
          ? '0' : key === 'cards' && row.minor === null && knownAmounts ? knownAmounts : amount(value)}</bdi></dd></div>)} 
        <div className="purchase-total"><dt>{t(imported && row.minor === null && knownAmounts ? 'purchaseDetails.knownAmounts' : imported ? 'purchaseDetails.recordedTotal' : transaction.settlement === 'paid' ? 'purchaseDetails.totalPaid' : 'transactionHistory.total')}</dt><dd><bdi>{row.currency && row.minor !== null ? money({ currency: row.currency, minor: row.minor }) : knownAmounts ?? t('purchaseDetails.unknownCost')}</bdi></dd></div>
      </dl>
      {(importedRecord?.unpricedCopyCount ?? 0) > 0 && <p className="text-xs text-slate-600">{t('purchaseDetails.unpricedCopies',{count:importedRecord?.unpricedCopyCount})}</p>}
      {view.cardCostMismatch && <p role="alert" className="text-sm text-amber-800">{t('purchaseDetails.costMismatch')}</p>}
    </Card>
    {shipments.length ? shipments.map(shipment => <ShipmentDetails key={shipment.id} shipment={shipment} trackingError={!!shipment.trackingNumber && (!!trackingFailed || !!trackingErrors?.[shipment.trackingNumber.trim().toUpperCase()])} onRefresh={onRefresh} refreshing={refreshing} />) : <Card className="purchase-shipment"><h2>{t('purchaseDetails.shipment')}</h2><p className="text-sm text-slate-600">{t('purchaseDetails.noShipment')}</p></Card>}
    {transaction.notes && <Card><h2>{t('inventory.notes')}</h2><p className="whitespace-pre-wrap break-words text-sm text-slate-600">{transaction.notes}</p></Card>}
  </article>;
}

function ShipmentDetails({ shipment, onRefresh, refreshing, trackingError }: {trackingError?: boolean | undefined;  shipment: PurchaseShipment; onRefresh?: (() => void) | undefined; refreshing?: boolean | undefined }) {
  const { t, i18n } = useTranslation();
  const [copyResult, setCopyResult] = useState<'idle' | 'copied' | 'failed'>('idle');
  const id = useId();
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
  async function copyTracking() {
    if (!shipment.trackingNumber) return;
    try { await navigator.clipboard.writeText(shipment.trackingNumber); setCopyResult('copied'); } catch { setCopyResult('failed'); }
  }
  return <Card className="purchase-shipment" aria-labelledby={`${id}-shipment`}>
    <div className="flex items-center justify-between gap-2"><h2 id={`${id}-shipment`}>{t('purchaseDetails.shipment')}</h2>{shipment.trackingNumber && onRefresh && <button type="button" onClick={onRefresh} disabled={refreshing} aria-label={t('purchaseDetails.refreshTracking')} className="purchase-copy-tracking disabled:opacity-40"><LuRefreshCw aria-hidden className={`size-4 ${refreshing ? 'animate-spin' : ''}`} /></button>}</div>
    {trackingError ? <p role="status" className="text-sm text-slate-600">{t('purchaseDetails.trackingError')}</p> : shipment.providerStatus && <p className="text-sm text-slate-600">{t('purchaseDetails.carrierStatus')}: {t(`purchaseDetails.statuses.${shipment.providerStatus}`, {defaultValue:shipment.providerStatus})}</p>}
    {!trackingError && <TransactionStatus status={shipment.status} className="purchase-status" />}
    <div className="purchase-tracking"><span>{shipment.carrier}{shipment.trackingNumber && <> · <bdi title={shipment.trackingNumber}>{`…${shipment.trackingNumber.slice(-7)}`}</bdi></>}</span>
      {shipment.trackingNumber && <button type="button" onClick={() => void copyTracking()} aria-label={`${t('purchaseDetails.copyTracking')}: ${shipment.trackingNumber}`} className="purchase-copy-tracking"><LuCopy aria-hidden className="size-4" /></button>}
    </div>
    <p role={copyResult === 'failed' ? 'alert' : 'status'} className={copyResult === 'idle' ? 'sr-only' : 'purchase-shipping-note'}>{copyResult === 'copied' ? t('purchaseDetails.copied') : copyResult === 'failed' ? t('purchaseDetails.copyFailed') : ''}</p>
    {copyResult === 'failed' && <p className="select-all break-all text-sm" dir="ltr">{shipment.trackingNumber}</p>}
    {shipment.events.length ? <ol className="purchase-timeline">{shipment.events.map(event => <li key={event.id}>
      <span className="purchase-timeline-dot" aria-hidden /><div><p className="purchase-event-title" title={event.description}>{event.code === 'other' ? event.description : t(`purchaseDetails.${event.code}`)}</p>
        {event.occurredAt ? <time dateTime={event.occurredAt} title={event.occurredAt}>{new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(event.occurredAt))} · {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(new Date(event.occurredAt))} UTC</time> : <span className="text-xs text-slate-600">{t('purchaseDetails.unknownTime')}</span>}
      </div>
    </li>)}</ol> : <p className="text-sm text-slate-600">{t('purchaseDetails.noEvents')}</p>}
  </Card>;
}
