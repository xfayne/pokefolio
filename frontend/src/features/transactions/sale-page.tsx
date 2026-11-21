import { saleCopyNumber } from './sale-copy-number';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LuPencil, LuTag, LuTrash2 } from 'react-icons/lu';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { useDisplayMoney } from '@/services/display-currency';
import { PortfolioStatus } from '@/features/portfolio-status';
import { CardDetailsSheet } from '@/features/inventory/collection-cards';
import { type InventoryGroup } from '@/domain/inventory';
import { reverseSaleCommit, selectSaleDetails } from '@/domain/sale';
import type { Metric } from '@/domain/money';
import { useSaleData } from './use-sale-data';
import type { PortfolioCommit } from '@/domain/persistence';

export function SalePage() {
  const data = useSaleData();
  const { transactionId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const money = useDisplayMoney();
  const navigate = useNavigate();
  const [inspect,setInspect] = useState<string | null>(null);
  useEffect(()=>{document.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});window.scrollTo(0,0);},[transactionId]);
  if (data.loading || data.error) return <PortfolioStatus loading={data.loading} error={data.error} />;
  const view = selectSaleDetails(data.history,transactionId);
  if (!view) return <EmptyState title={t('sale.unavailable')} description={t('sale.unavailableDetail')} />;
  const { sale } = view;
  const metric = (m: Metric) => m.status === 'unavailable' ? t('sale.unknown') : `${money(m)}${m.status==='estimated'?` · ${t('sale.estimated')}`:''}`;
  const original = (key: 'cardProceeds' | 'buyerShipping' | 'sellingFees' | 'sellerShipping' | 'sellingTaxes') => {const a=sale[key];return a.status==='known'?money(a.value):t('sale.unknown');};
  const chosen = view.copies.find(c=>c.copy.id===inspect);
  const group: InventoryGroup | null = chosen ? { key: chosen.card?.id ?? chosen.copy.id, card: chosen.card ?? null, copies: [{copy:chosen.copy,paid:chosen.copy.cardCost,basis:chosen.basis,market:{status:'unavailable',reason:'No quote'}}], receivedCount:0,pendingCount:0,unknownPossessionCount:0,market:{currency:sale.currency,minor:0,pricedCount:0,missingCount:1} } : null;
  return <article className="purchase-details" aria-label={t('sale.title')}>
    <Card className="purchase-summary"><span className="purchase-icon"><LuTag aria-hidden /></span><div className="min-w-0 flex-1"><h2>{sale.source.seller || t(`transactionHistory.${sale.source.kind}`)}</h2><p>{new Intl.DateTimeFormat(i18n.language==='he'?'he-IL':'en-US',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${sale.transactionOn}T00:00:00Z`))}</p><p>{t('newPurchase.sale')} · {t('transactionHistory.copies',{count:view.copies.length})}</p></div><span className="text-sm font-bold">{t(sale.reversedAt?'sale.reversed':'transactionHistory.completed')}</span></Card>
    {sale.source.itemReference && <Card><p className="text-sm"><span className="text-slate-600">{t('newPurchase.itemReference')}: </span><bdi>{sale.source.itemReference}</bdi></p></Card>}
    {sale.source.listingUrl && <Card><a className="break-all text-sm text-blue-700 underline" href={sale.source.listingUrl} target="_blank" rel="noopener noreferrer">{t('newPurchase.listingUrl')}</a></Card>}
    <Card className="purchase-cards"><div className="purchase-section-heading"><h2>{t('newPurchase.cards')}</h2><span>{t('sale.net')}</span></div><ul>{view.copies.map(({copy,card,net,profit})=><li key={copy.id}>
      <button type="button" className="purchase-copy-row" onClick={()=>setInspect(copy.id)} aria-label={`${t('sale.inspect')}: ${card?.name ?? copy.id}`}><PokemonArt src={card?.imageUrl} alt={card?.name??t('inventory.unidentified')} className="purchase-art" /><span className="purchase-card-identity"><span className="purchase-card-name">{card?.name??t('inventory.unidentified')}</span><span className="purchase-card-set">{card?`${card.setName} · #${card.number}`:''}</span><span className="text-xs text-slate-600">{copy.condition.status==='known'?copy.condition.value:t('sale.unknown')} · {t('inventory.copy',{number:saleCopyNumber(copy,data.history.copies)})}</span></span><bdi className="purchase-card-price">{metric(net)}</bdi></button>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 text-sm">{!sale.reversedAt && <span>{t('sale.profit')}: <bdi>{metric(profit)}</bdi></span>}{copy.acquisition.kind==='purchase' && <Button type="button" variant="outline" onClick={()=>{if(copy.acquisition.kind==='purchase') void navigate({pathname:`/transactions/purchases/${copy.acquisition.transactionId}`,search:data.search});}}>{t('sale.original')}</Button>}</div>
    </li>)}</ul></Card>
    <Card className="purchase-breakdown"><h2>{t('sale.breakdown')}</h2><dl>{(['cardProceeds','buyerShipping','sellingFees','sellerShipping','sellingTaxes'] as const).map(key=><div key={key}><dt>{t(key==='cardProceeds'?'newPurchase.cards':`sale.${key}`)}</dt><dd><bdi>{original(key)}</bdi></dd></div>)}<div className="purchase-total"><dt>{t('sale.net')}</dt><dd><bdi>{metric(view.net)}</bdi></dd></div></dl></Card>
    {!sale.reversedAt && <Card className="purchase-breakdown"><dl><div><dt>{t('sale.basis')}</dt><dd><bdi>{metric(view.basis)}</bdi></dd></div><div className="purchase-total"><dt>{t('sale.profit')}</dt><dd><bdi>{metric(view.profit)}</bdi></dd></div></dl>{view.profit.status==='unavailable'&&<p className="text-sm text-slate-600">{t('sale.unknownProfit')}</p>}</Card>}
    {view.copies.length>1 && <p className="text-sm text-slate-600">{t('sale.allocation')}</p>}
    {sale.notes && <Card><h2>{t('sale.notes')}</h2><p className="whitespace-pre-wrap break-words text-sm text-slate-600">{sale.notes}</p></Card>}
    {sale.reversedAt && <Card><p>{t('sale.reversed')}</p></Card>}
    {group && <CardDetailsSheet group={group} catalog={chosen!.copy.catalog} quotes={[]} currency={sale.currency} initialCopy={null} initialInspection={chosen!.copy.id} money={m=>money(m)} cost={c=>c.status==='exact'||c.status==='estimated'?money(c.value):t('sale.unknown')} metric={metric} onClose={()=>setInspect(null)} />}
  </article>;
}
export function SaleActions({ id }: { id: string }) {
  const data = useSaleData();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [confirm,setConfirm] = useState<PortfolioCommit | null>(null);
  const [busy,setBusy] = useState(false);
  const [failed,setFailed] = useState(false);
  const lock = useRef(false);
  const sale = data.history.transactions.find(t=>t.id===id && t.kind==='sale');
  if (!sale || sale.kind!=='sale' || sale.reversedAt || !sale.copyIds) return null;
  return <><button type="button" aria-label={t('sale.edit')} className="flex size-11 items-center justify-center rounded-xl text-white focus-visible:outline-white" onClick={()=>{void navigate({pathname:`/transactions/sales/${id}/edit`,search:data.search});}}><LuPencil aria-hidden className="size-6" /></button>
    <button type="button" aria-label={t('sale.reverse')} className="flex size-11 items-center justify-center rounded-xl text-white focus-visible:outline-white" onClick={()=>{setFailed(false);setConfirm(reverseSaleCommit(data.owner!,id,data.records,new Date().toISOString()));}}><LuTrash2 aria-hidden className="size-6" /></button>
    {confirm && <UtilitySheet title={t('sale.reverseTitle')} onClose={()=>{if(!lock.current)setConfirm(null);}}><div className="space-y-4"><p>{t('sale.reverseDetail')}</p>{failed&&<p role="alert" className="new-purchase-error">{t('sale.failed')}</p>}<Button disabled={busy} onClick={()=>{if(lock.current)return;lock.current=true;setBusy(true);setFailed(false);void data.save(confirm).then(()=>setConfirm(null)).catch(()=>setFailed(true)).finally(()=>{lock.current=false;setBusy(false);});}}>{t(busy?'newPurchase.saving':'sale.confirmReverse')}</Button><Button disabled={busy} variant="outline" onClick={()=>setConfirm(null)}>{t('sale.cancel')}</Button></div></UtilitySheet>}
  </>;
}
