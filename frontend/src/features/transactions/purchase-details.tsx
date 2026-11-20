import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronRight, LuCopy, LuShoppingCart } from 'react-icons/lu';
import { Card } from '@/components/ui/surfaces';
import { PokemonArt } from '@/components/ui/pokemon-art';
import type { CardCopy, Cost, Money } from '@/domain/schema';
import type { PurchaseDetailsView, PurchaseShipment } from '@/domain/purchase-details';
import { TransactionStatus } from './transaction-status';

export function PurchaseDetails({ view, onInspect }: { view: PurchaseDetailsView; onInspect: (copy: CardCopy) => void }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const { transaction, row, copies, shippingRange, shipments } = view;
  const imported = 'origin' in transaction;
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
  const money = (m: Money) => new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(m.minor / 100);
  const cost = (c: Cost) => c.status === 'exact' ? money(c.value) : c.status === 'estimated' ? `${money(c.value)} · ${t('purchaseDetails.estimated')}` : t(`purchaseDetails.${c.status === 'unallocated' ? 'unallocated' : 'unknownCost'}`);
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
    <Card className="purchase-cards" aria-labelledby={`${id}-cards`}>
      <div className="purchase-section-heading"><h2 id={`${id}-cards`}>{t('purchaseDetails.cards')}</h2><span>{t('purchaseDetails.cardCost')}</span></div>
      {!copies.length && <p className="text-sm text-slate-600">{t('transactionHistory.noCopies')}</p>}
      <ul>{copies.map(({ copy, card }) => <li key={copy.id}>
        <button type="button" className="purchase-copy-row" onClick={() => onInspect(copy)}>
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
      <dl>{([['cards', transaction.subtotal], ['shipping', transaction.shipping], ['taxes', transaction.taxes], ['fees', transaction.fees]] as const).filter(([key, value]) => key === 'cards' || key === 'shipping' || value.status === 'unknown' || value.value.minor !== 0).map(([key, value]) => <div key={key}><dt>{t(`purchaseDetails.${key}`)}</dt><dd><bdi>{amount(value)}</bdi></dd></div>)}
        <div className="purchase-total"><dt>{t(imported ? 'purchaseDetails.recordedTotal' : transaction.settlement === 'paid' ? 'purchaseDetails.totalPaid' : 'transactionHistory.total')}</dt><dd><bdi>{row.currency && row.minor !== null ? money({ currency: row.currency, minor: row.minor }) : t('purchaseDetails.unknownCost')}</bdi></dd></div>
      </dl>
      <p className="purchase-shipping-note">{shippingRange ? shippingRange.min === shippingRange.max
        ? t('purchaseDetails.perCopy', { amount: money({ currency: shippingRange.currency, minor: shippingRange.min }) })
        : t('purchaseDetails.roundedShipping', { min: money({ currency: shippingRange.currency, minor: shippingRange.min }), max: money({ currency: shippingRange.currency, minor: shippingRange.max }) })
        : t('purchaseDetails.allocationUnknown')}</p>
      {transaction.settlement !== 'paid' && <p className="text-xs text-slate-600">{t(`purchaseDetails.${transaction.settlement === 'partial' ? 'partialPayment' : transaction.settlement === 'unpaid' ? 'unpaid' : 'settlementUnknown'}`)}</p>}
      {view.cardCostMismatch && <p role="alert" className="text-sm text-amber-800">{t('purchaseDetails.costMismatch')}</p>}
    </Card>
    {shipments.length ? shipments.map(shipment => <ShipmentDetails key={shipment.id} shipment={shipment} />) : <Card className="purchase-shipment"><h2>{t('purchaseDetails.shipment')}</h2><p className="text-sm text-slate-600">{t('purchaseDetails.noShipment')}</p></Card>}
    {transaction.notes && <Card><h2>{t('inventory.notes')}</h2><p className="whitespace-pre-wrap break-words text-sm text-slate-600">{transaction.notes}</p></Card>}
  </article>;
}

function ShipmentDetails({ shipment }: { shipment: PurchaseShipment }) {
  const { t, i18n } = useTranslation();
  const [copyResult, setCopyResult] = useState<'idle' | 'copied' | 'failed'>('idle');
  const id = useId();
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
  async function copyTracking() {
    if (!shipment.trackingNumber) return;
    try { await navigator.clipboard.writeText(shipment.trackingNumber); setCopyResult('copied'); } catch { setCopyResult('failed'); }
  }
  return <Card className="purchase-shipment" aria-labelledby={`${id}-shipment`}>
    <h2 id={`${id}-shipment`}>{t('purchaseDetails.shipment')}</h2>
    <TransactionStatus status={shipment.status} className="purchase-status" />
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
