import { TransactionFormHeader } from './transaction-form-header';
import { saleCopyNumber } from './sale-copy-number';
import { useId, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LuPlus, LuShoppingCart, LuTag, LuX } from 'react-icons/lu';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SearchInput } from '@/components/ui/search-input';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { PortfolioStatus } from '@/features/portfolio-status';
import { catalogCards } from '@/features/catalog/catalog';
import { useUIStore } from '@/state/ui';
import { useDisplayMoney } from '@/services/display-currency';
import { currencySchema, type CardCopy } from '@/domain/schema';
import { newSaleDraft, draftFromSale, editSaleCommit, eligibleSaleCopies, prepareSale, saleCommit, saleCopyLimit, type SaleDraft } from '@/domain/sale';
import { netSaleProceeds } from '@/domain/money';
import type { PortfolioCommit } from '@/domain/persistence';
import { useSaleData } from './use-sale-data';

export function NewSalePage({ editing = false }: { editing?: boolean }) {
  const data = useSaleData();
  const { transactionId = '' } = useParams();
  const { t } = useTranslation();
  if (data.loading || data.error) return <PortfolioStatus loading={data.loading} error={data.error} />;
  let initial: SaleDraft | undefined;
  if (editing) {
    try { initial = draftFromSale(data.records, transactionId); } catch { return <EmptyState title={t('sale.unavailable')} description={t('sale.unavailableDetail')} />; }
  }
  return <SaleEditor key={`${data.owner}-${editing ? transactionId : 'new'}`} data={data} editing={editing} initial={initial} />;
}
function SaleEditor({ data, editing, initial }: { data: ReturnType<typeof useSaleData>; editing: boolean; initial: SaleDraft | undefined }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mode = data.preview ? 'sample' : `account-${data.owner ?? 'signed-out'}`;
  const stored = useUIStore(s => s.saleDrafts[mode]);
  const setStored = useUIStore(s => s.setSaleDraft);
  const [local, setLocal] = useState(() => initial ?? stored ?? newSaleDraft());
  const [baseline] = useState(data.records);
  const command = useRef<{ key: string; value: PortfolioCommit } | null>(null);
  const [picking, setPicking] = useState(false);
  const draft = local;
  const copies = data.history.copies;
  const onChange = (next: SaleDraft) => { setLocal(next); if (!editing) setStored(mode, next); };
  async function save() {
    if (!data.owner) throw Error('Sign in before saving');
    const key = JSON.stringify(draft);
    if (command.current?.key !== key) command.current = { key, value: editing ? editSaleCommit(data.owner, draft, baseline, new Date().toISOString()) : saleCommit(data.owner, draft, copies, new Date().toISOString()) };
    await data.save(command.current.value);
    if (!editing) setStored(mode, null);
    await navigate({ pathname: `/transactions/sales/${draft.id}`, search: data.search }, { replace: true });
  }
  return <><SaleForm draft={draft} copies={copies} owner={data.owner} onChange={onChange} editing={editing} onPick={() => setPicking(true)} onPurchase={() => { void navigate({ pathname: '/transactions/new', search: data.search }); }} {...(data.owner ? { onSave: save } : {})} />
    {picking && <CopyPicker copies={copies} owner={data.owner ?? 'disconnected'} selected={draft.cards.map(c => c.copyId)} onClose={() => setPicking(false)} onSelect={ids => { onChange({ ...draft, cards: ids.map(copyId => draft.cards.find(c => c.copyId === copyId) ?? { copyId, amount: '' }) }); setPicking(false); }} title={t('sale.selectTitle')} />}</>;
}
export function SaleForm({ draft, copies, owner, onChange, editing, onPick, onPurchase, onSave }: {
  draft: SaleDraft; copies: readonly CardCopy[]; owner: string | undefined; onChange: (next: SaleDraft) => void; editing: boolean; onPick: () => void; onPurchase: () => void; onSave?: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [undo, setUndo] = useState<SaleDraft | null>(null);
  const busy = useRef(false);
  const formId = useId();
  let plan: ReturnType<typeof prepareSale> | null = null;
  try { plan = prepareSale(owner ?? 'disconnected', draft, editing ? copies.map(c => c.dispositionRecordId === draft.id ? { ...c, disposition: 'held', dispositionRecordId: null } : c) : copies, new Date().toISOString()); } catch { /* Incomplete draft. */ }
  const net = plan ? netSaleProceeds(plan.sale) : null;
  const money = (minor: number) => new Intl.NumberFormat(i18n.language === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: draft.currency }).format(minor/100);
  const change = (next: SaleDraft) => { setFailed(false); setUndo(null); onChange(next); };
  const amount = (key: 'buyerShipping' | 'sellingFees' | 'sellerShipping' | 'sellingTaxes') => <label className="new-purchase-field"><span>{t(`sale.${key}`)}</span><Input className="new-purchase-input" inputMode="decimal" maxLength={20} value={draft[key]} onChange={e => change({ ...draft, [key]: e.target.value })} /></label>;
  return <form id={formId} className="new-purchase-form" aria-label={t(editing ? 'sale.edit' : 'sale.new')} noValidate onSubmit={event => { event.preventDefault(); if (busy.current || !onSave) return; setSubmitted(true); if (!plan) return; busy.current = true; setSaving(true); setFailed(false); void onSave().catch(() => setFailed(true)).finally(() => { busy.current = false; setSaving(false); }); }}>
    <fieldset disabled={saving} className="new-purchase-fields">
      <TransactionFormHeader formId={formId} disabled={saving || !onSave} saving={saving} label={t(saving ? 'newPurchase.saving' : editing ? 'newPurchase.saveChanges' : 'sale.save')}>
      <div className="new-purchase-kind" role="group" aria-label={t('newPurchase.title')}>
        <button type="button" disabled={editing} onClick={onPurchase}><LuShoppingCart aria-hidden />{t('newPurchase.purchase')}</button><button type="button" aria-pressed="true"><LuTag aria-hidden />{t('newPurchase.sale')}</button>
      </div>
      </TransactionFormHeader>
      <Card className="new-purchase-meta">
        <label className="new-purchase-field"><span>{t('newPurchase.date')}</span><Input className="new-purchase-input" type="date" value={draft.date} onChange={e => change({ ...draft, date: e.target.value })} /></label>
        <label className="new-purchase-field"><span>{t('newPurchase.source')}</span><Select className="new-purchase-input" value={draft.source} onChange={e => change({ ...draft, source: e.target.value as SaleDraft['source'] })}>{(['manual','ebay','other'] as const).map(k => <option key={k} value={k}>{t(`transactionHistory.${k}`)}</option>)}</Select></label>
        <label className="new-purchase-field"><span>{t('sale.buyer')} {t('newPurchase.optional')}</span><Input className="new-purchase-input" aria-label={t('sale.buyer')} maxLength={200} value={draft.buyer} onChange={e => change({ ...draft, buyer: e.target.value })} /></label>
        <label className="new-purchase-field"><span>{t('newPurchase.currency')}</span><Select className="new-purchase-input" value={draft.currency} onChange={e => { setUndo(draft); onChange({ ...draft, currency: currencySchema.parse(e.target.value), cards: draft.cards.map(c=>({...c,amount:''})), buyerShipping:'0', sellingFees:'0', sellerShipping:'0', sellingTaxes:'0' }); }}>{currencySchema.options.map(c => <option key={c} value={c}>{c}</option>)}</Select></label>
        <label className="new-purchase-field"><span>{t('newPurchase.listingUrl')}</span><Input className="new-purchase-input" type="url" maxLength={2000} value={draft.listingUrl} onChange={e => change({ ...draft, listingUrl: e.target.value })} /></label>
        <label className="new-purchase-field"><span>{t('newPurchase.itemReference')}</span><Input className="new-purchase-input" maxLength={200} value={draft.itemReference} onChange={e => change({ ...draft, itemReference: e.target.value })} /></label>
      </Card>
      <Card className="new-purchase-cards">
        <div className="new-purchase-cards-heading"><h2>{t('newPurchase.cards')} · {t('transactionHistory.copies', { count: draft.cards.length })}</h2></div>
        {!editing && <Button className="new-purchase-add" variant="outline" type="button" onClick={onPick}><LuPlus aria-hidden />{t('sale.select')}</Button>}
        <ul>{draft.cards.map((line,index) => { const copy = copies.find(c=>c.id===line.copyId); const card = copy?.catalog.kind === 'identified' ? catalogCards.find(c=>copy.catalog.kind === 'identified' && c.id===copy.catalog.cardId) : undefined; return <li key={line.copyId} className="new-purchase-copy">
          <PokemonArt src={card?.imageUrl} alt={card?.name ?? t('inventory.unidentified')} className="new-purchase-art" />
          <div className="new-purchase-copy-body"><div className="new-purchase-copy-heading"><div><h3>{card?.name ?? t('inventory.unidentified')}</h3><p>{card ? `${card.setName} · #${card.number}` : line.copyId}</p><p>{copy?.condition.status === 'known' ? copy.condition.value : t('sale.unknown')} · {copy?.catalog.kind === 'identified' ? t(`inventory.${copy.catalog.edition === 'first-edition' ? 'first-edition' : copy.catalog.edition === 'unlimited' ? 'unlimited' : 'unknown'}`) : ''} · {copy ? t('inventory.copy', {number:saleCopyNumber(copy,copies)}) : t('sale.unknown')}</p></div>{!editing && <button type="button" aria-label={`${t('newPurchase.remove')} ${index+1}`} onClick={()=>change({...draft,cards:draft.cards.filter(c=>c.copyId!==line.copyId)})}><LuX aria-hidden /></button>}</div>
          <label className="new-purchase-field"><span>{t('sale.price')} · {draft.currency}</span><Input className="new-purchase-input" aria-label={`${t('sale.price')} ${index+1}`} inputMode="decimal" maxLength={20} value={line.amount} onChange={e=>change({...draft,cards:draft.cards.map(c=>c.copyId===line.copyId?{...c,amount:e.target.value}:c)})} /></label></div>
        </li>; })}</ul>
      </Card>
      <Card className="new-purchase-meta">{amount('buyerShipping')}{amount('sellingFees')}{amount('sellerShipping')}{amount('sellingTaxes')}</Card>
      <Card className="new-purchase-totals"><dl><div><dt>{t('newPurchase.cards')}</dt><dd>{plan?.sale.cardProceeds.status === 'known' ? money(plan.sale.cardProceeds.value.minor) : '—'}</dd></div><div><dt>{t('sale.net')}</dt><dd>{net && net.status !== 'unavailable' ? money(net.minor) : '—'}</dd></div></dl></Card>
      {draft.cards.length > 1 && <p className="text-sm text-slate-600">{t('sale.allocation')}</p>}
      <Card><label className="new-purchase-field"><span>{t('sale.notes')}</span><Input className="new-purchase-input" maxLength={2000} value={draft.notes} onChange={e=>change({...draft,notes:e.target.value})} /></label></Card>
    </fieldset>
    {undo && <p role="status" className="new-purchase-notice">{t('sale.currencyChanged')} <Button type="button" variant="outline" disabled={saving} onClick={()=>{onChange(undo);setUndo(null);}}>{t('newPurchase.undo')}</Button></p>}
    {submitted && !plan && <p role="alert" className="new-purchase-error">{t('sale.invalid')}</p>}
    {failed && <p role="alert" className="new-purchase-error">{t('sale.failed')}</p>}
    {!onSave && <p className="new-purchase-notice">{t('newPurchase.unavailable')}</p>}
  </form>;
}
function CopyPicker({ copies, owner, selected, onSelect, onClose, title }: { copies: readonly CardCopy[]; owner: string; selected: readonly string[]; onSelect: (ids: string[]) => void; onClose: () => void; title: string }) {
  const { t } = useTranslation();
  const [query,setQuery] = useState('');
  const [ids,setIds] = useState([...selected]);
  const money = useDisplayMoney();
  const eligible = eligibleSaleCopies(owner,copies);
  const rows = eligible.map(copy=>({copy,card:copy.catalog.kind === 'identified' ? catalogCards.find(c=>copy.catalog.kind === 'identified' && c.id===copy.catalog.cardId) : undefined})).filter(({copy,card})=>`${card?.name} ${card?.setName} ${card?.number} ${copy.id} ${copy.condition.status === 'known' ? copy.condition.value : ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <UtilitySheet title={title} onClose={onClose} contentMode="contained"><div className="space-y-2"><SearchInput label={t('inventory.search')} value={query} onChange={e=>setQuery(e.target.value)} /><p className="text-sm text-slate-600">{t('sale.eligible')} {t('sale.limit')}</p></div><div className="catalog-scroll-region space-y-2">
    {!eligible.length && <EmptyState title={t('sale.empty')} description={t('sale.emptyDetail')} />}
    {!!eligible.length && !rows.length && <EmptyState title={t('transactionHistory.noResults')} description={t('transactionHistory.noResultsDetail')} />}
    {rows.map(({copy,card})=><Card key={copy.id}><label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="checkbox" checked={ids.includes(copy.id)} disabled={!ids.includes(copy.id) && ids.length>=saleCopyLimit} onChange={e=>setIds(e.target.checked?[...ids,copy.id]:ids.filter(id=>id!==copy.id))} /><PokemonArt src={card?.imageUrl} alt="" className="new-purchase-art" /><span className="min-w-0 flex-1 text-sm"><span className="block font-bold">{card?.name ?? t('inventory.unidentified')}</span><span className="block text-slate-600">{card ? `${card.setName} · #${card.number}` : ''}</span><span className="block">{copy.condition.status==='known'?copy.condition.value:t('sale.unknown')} · {copy.catalog.kind==='identified'?t(`inventory.${copy.catalog.edition}`):t('sale.unknown')} · {t('inventory.copy',{number:saleCopyNumber(copy,copies)})}</span><span className="block text-slate-600">{t('inventory.paidShort')} {copy.cardCost.status==='exact'||copy.cardCost.status==='estimated'?money(copy.cardCost.value):t('sale.unknown')}</span></span></label></Card>)}
  </div><Button type="button" onClick={()=>onSelect(ids)}>{t('sale.done')} · {ids.length}</Button></UtilitySheet>;
}
