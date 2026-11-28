import { SingleCardDeals } from '@/features/deals/deals-page';
import {useDisplayMoney} from '@/services/display-currency';
import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronRight, LuPencil, LuArrowLeft, LuFilter, LuZoomIn, LuHeart, LuTag, LuPlus, LuSparkles, LuLayers } from 'react-icons/lu';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { Button } from '@/components/ui/button';
import { DisclosureButton, DisclosureContent, DisclosureChevron } from '@/components/ui/disclosure';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { SearchInput } from '@/components/ui/search-input';
import { ListCard } from '@/components/ui/list-card';
import { Select } from '@/components/ui/select';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { selectInventory, visibleCopyMarket, type CopyMetadataEdit, type CopyView, type InventoryCatalogCard, type CopyQuote, type InventoryGroup } from '@/domain/inventory';
import { CardMarketPrice } from './card-market-price';
import { bestCopy } from './copy-condition';
import { compareCollectionGroups, type CollectionSort } from './sort-collection';
import { conditionSchema, type CardCopy, type Money, type CatalogRef } from '@/domain/schema';

export type InventoryData = Readonly<{ ownerUid: string; copies: readonly CardCopy[]; catalog: readonly InventoryCatalogCard[]; quotes: readonly CopyQuote[]; currency: Money['currency'] }>;
export type SaveCopy = (copy: CardCopy, patch: CopyMetadataEdit) => Promise<void>;
export function CollectionCards({ data, onSave, onViewPurchase, pricesLoading = false, inspectCopyId, cardCopyId, initialDeliveryFilter = 'all', onCloseCard, wishlistIds, onToggleWishlist, wishlistBusy }: { inspectCopyId?: string | undefined; cardCopyId?: string | null; initialDeliveryFilter?: 'all' | 'pending'; onCloseCard?: () => void; pricesLoading?: boolean; data: InventoryData; onSave?: SaveCopy | undefined; onViewPurchase?: (id: string) => void; wishlistIds?: readonly string[]; onToggleWishlist?: ((id: string) => Promise<void>) | undefined; wishlistBusy?: boolean }) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(initialDeliveryFilter === 'pending');
  const [sort, setSort] = useState<CollectionSort>('acquired');
  const [filter, setFilter] = useState<string>(initialDeliveryFilter);
  const [expansionOverrides, setExpansionOverrides] = useState<ReadonlyMap<string, boolean>>(new Map());
  const inventory = selectInventory(data.ownerUid, data.copies, data.catalog, data.quotes, data.currency);
  const initialGroup = inventory.groups.find(g => g.copies.some(c => c.copy.id === (cardCopyId ?? inspectCopyId)));
  const [initialInspection, setInitialInspection] = useState<string | null>(initialGroup && !cardCopyId ? inspectCopyId ?? null : null);
  const [initialCopy, setInitialCopy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(initialGroup?.key ?? null);
  const [notice, setNotice] = useState('');
  const id = useId();
  const money = useDisplayMoney();
  const rowMoney = useDisplayMoney(0);
  const rowCost = (v: CopyView['paid']) => v.status === 'exact' ? rowMoney(v.value) : v.status === 'estimated' ? `${rowMoney(v.value)} · ${t('inventory.estimated')}` : t(`inventory.${v.status === 'unallocated' ? 'unallocated' : 'unavailable'}`);
  const rowMetric = (v: CopyView['market']) => v.status === 'unavailable' ? t(pricesLoading ? 'loading' : 'inventory.unpriced') : rowMoney(v);
  const cost = (v: CopyView['paid']) => v.status === 'exact' ? money(v.value) : v.status === 'estimated' ? `${money(v.value)} · ${t('inventory.estimated')}` : t(`inventory.${v.status === 'unallocated' ? 'unallocated' : 'unavailable'}`);
  const metric = (v: CopyView['market']) => v.status === 'unavailable' ? t(pricesLoading ? 'loading' : 'inventory.unpriced') : money(v);
  const title = (g: InventoryGroup) => g.card?.name ?? (g.copies[0]?.copy.catalog.kind === 'unidentified' ? g.copies[0].copy.catalog.description : g.key);
  const needle = search.trim().toLocaleLowerCase(i18n.language);
  const groups = inventory.groups.filter(g => `${title(g)} ${g.card?.setName ?? ''} ${g.card?.number ?? ''}`.toLocaleLowerCase(i18n.language).includes(needle) && (filter === 'all' || g.copies.some(v => v.copy.possession === filter)));
  const quotedGroups = new Map(groups.map(g => [g.key,visibleCopyMarket(g.copies,data.currency)]));
  const visibleMarket = (g: InventoryGroup) => quotedGroups.get(g.key)!;
  groups.sort((a, b) => compareCollectionGroups(a, b, sort, visibleMarket, i18n.language));
  const selectedGroup = inventory.groups.find(g => g.key === selected);
  const isExpanded = (group: InventoryGroup) => expansionOverrides.get(group.key) ?? false;
  const toggle = (group: InventoryGroup) => setExpansionOverrides(previous => { const next = new Map(previous); next.set(group.key, !(previous.get(group.key) ?? false)); return next; });
  return <section aria-label={t('inventory.title')} className="flex flex-col gap-2">
    <div className="collection-toolbar">
      <SearchInput id={`${id}-search`} label={t('inventory.search')} placeholder={t('inventory.search')} value={search} onChange={e => setSearch(e.target.value)} />
      <div className="collection-list-controls flex min-w-0 items-center gap-2 py-2">
        <p className="min-w-0 flex-1 text-sm font-extrabold text-slate-600">{t('inventory.listCounts', { cards: groups.length, copies: groups.reduce((count, group) => count + group.copies.length, 0) })}</p>
        <label className="min-w-0 border-s border-blue-200 ps-2"><span className="sr-only">{t('inventory.sort')}</span><Select aria-label={t('inventory.sort')} className="max-w-36 font-semibold text-blue-700" value={sort} onChange={e => setSort(e.target.value as CollectionSort)}><option value="value">{t('inventory.value')} ↓</option><option value="name">{t('inventory.name')}</option><option value="copies">{t('inventory.quantity')}</option><option value="acquired">{t('inventory.purchaseDate')} ↓</option><option value="setNumber">{t('inventory.setNumber')}</option></Select></label>
        <button type="button" onClick={() => setOptionsOpen(v => !v)} aria-label={t('inventory.options')} aria-expanded={optionsOpen} aria-controls={`${id}-options`} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-300 bg-white/80 text-blue-700 shadow-sm"><LuFilter aria-hidden className="size-5" /></button>
      </div>
      <div id={`${id}-options`} className="collection-options" data-open={optionsOpen} aria-hidden={!optionsOpen} inert={!optionsOpen}>
        <div className="overflow-hidden"><label className="flex flex-col gap-1 pb-2 text-xs font-medium">{t('inventory.delivery')}<Select aria-label={t('inventory.delivery')}  value={filter} onChange={e => setFilter(e.target.value)}>{['all', 'received', 'pending', 'unknown'].map(k => <option key={k} value={k}>{t(`inventory.${k}`)}</option>)}</Select></label></div>
      </div>
    </div>
    <p role="status" className="sr-only">{notice}</p>
    {!groups.length && <EmptyState title={t('inventory.empty')} description={t('inventory.emptyDetail')} />}
    <ul className="space-y-1.5">{groups.map(g => <ListCard key={g.key}>
      <div className="flex items-stretch">
        <button type="button" onClick={() => { setInitialInspection(null); setInitialCopy(null); setSelected(g.key); }} className="flex min-h-16 min-w-0 flex-1 items-center gap-2 rounded-xl py-1 ps-2 text-start">
          <span className="sr-only">{t('inventory.details')}: </span><PokemonArt src={g.card?.imageUrl} alt={g.card?.name ?? title(g)} />
          <span className="min-w-0 flex-1"><span className="block break-words text-base font-bold leading-[1.125rem] tracking-tight text-slate-950">{title(g)}</span><span className="mt-0.5 block truncate text-xs leading-[0.875rem] text-slate-600">{g.card ? `${g.card.setName} · #${g.card.number}` : t('inventory.noCatalog')}</span></span>
          <span className="ms-1 flex min-h-11 w-24 shrink-0 flex-col justify-center border-s border-blue-200 ps-3"><span className="text-xs font-medium leading-4 text-slate-600">{t('inventory.marketValue')}</span><span className={`text-xl font-bold tracking-tight ${visibleMarket(g).pricedCount ? 'text-slate-950' : 'text-amber-800'}`}>{visibleMarket(g).pricedCount ? rowMoney(visibleMarket(g)) : t(pricesLoading ? 'loading' : 'inventory.unpriced')}</span>{visibleMarket(g).pricedCount > 0 && visibleMarket(g).missingCount > 0 && <span className="text-[10px] text-slate-600">{visibleMarket(g).pricedCount}/{g.copies.length} {t('inventory.priced')}</span>}</span>
        </button>
        <DisclosureButton aria-label={`${t('inventory.copies', { count: g.copies.length })}: ${title(g)}`} open={isExpanded(g)} contentId={`${id}-${g.key}`} onClick={() => toggle(g)} className="flex w-11 shrink-0 items-center justify-center rounded-xl text-slate-950">
          <DisclosureChevron open={isExpanded(g)} />
        </DisclosureButton>
      </div>
      <DisclosureContent id={`${id}-${g.key}`} className="copy-accordion" open={isExpanded(g)}><div className="mx-2 mb-2 rounded-xl bg-blue-100/50 px-2">
        <div className="flex items-center justify-between gap-2 py-1 text-[11px] font-medium text-slate-600"><span>{t('inventory.copyCondition')}</span><span className="me-11">{t('inventory.marketValue')}</span></div>
        {g.copies.map((v, n) => <div key={v.copy.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 border-t border-blue-200">
          <button type="button" className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-2 rounded-lg text-start text-xs" onClick={() => { setInitialInspection(v.copy.id); setInitialCopy(null); setSelected(g.key); }}>
            <span className="sr-only">{t('inventory.copyDetails')} {v.copy.id}: </span><span className="font-semibold">{t('inventory.copy', { number: n + 1 })}</span>
            <span className={`condition-badge rounded-full px-2 py-0.5 font-medium ${v.copy.condition.status === 'known' && v.copy.condition.value === 'NM' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>{v.copy.condition.status === 'known' ? v.copy.condition.value : t('inventory.unknown')}</span>
            <span className="border-s border-blue-200 ps-2 text-slate-600">{t('inventory.cost')}: {rowCost(v.paid)}</span>
          </button>
          <span className={`text-sm font-bold tabular-nums ${v.market.status === 'unavailable' ? 'text-amber-800' : ''}`}>{rowMetric(v.market)}</span>
          <button type="button" aria-label={`${t('inventory.edit')} ${v.copy.id}`} disabled={!onSave} onClick={() => { setInitialInspection(null); setInitialCopy(v.copy.id); setSelected(g.key); }} className="flex size-8 items-center justify-center rounded-lg text-blue-700"><LuPencil aria-hidden /></button>
        </div>)}
      </div></DisclosureContent>
    </ListCard>)}</ul>
    {selectedGroup && <CardDetailsSheet livePrices={!!onViewPurchase && !!onSave} onViewPurchase={onViewPurchase} wishlistIds={wishlistIds} onToggleWishlist={onToggleWishlist} wishlistBusy={!!wishlistBusy} key={selectedGroup.key} group={selectedGroup} catalog={(bestCopy(selectedGroup.copies)?.copy ?? selectedGroup.copies[0]!.copy).catalog} quotes={data.quotes} currency={data.currency} initialCopy={initialCopy} initialInspection={initialInspection} onClose={() => { setSelected(null); onCloseCard?.(); }} onSave={onSave ? async (copy, patch) => { await onSave(copy, patch); setNotice(t('inventory.saved')); } : undefined} money={money} cost={cost} metric={metric} />}
  </section>;
}

export function CardDetailsSheet({ group, catalog, quotes, currency, initialCopy, initialInspection = null, onClose, onSave, onViewPurchase, wishlistIds, onToggleWishlist, wishlistBusy = false, livePrices = false, transition, priceStatus, onRetryPrice, onEditionChange, money, cost, metric }: { livePrices?: boolean; onEditionChange?: ((first: boolean) => void) | undefined; transition?: 'slide' | 'subtle'; priceStatus?: string | undefined; onRetryPrice?: (() => void) | undefined; group: InventoryGroup; catalog: CatalogRef; quotes: readonly CopyQuote[]; currency: Money['currency']; initialCopy: string | null; initialInspection?: string | null; onClose: () => void; onSave?: SaveCopy | undefined; onViewPurchase?: ((transactionId: string) => void) | undefined; wishlistIds?: readonly string[] | undefined; onToggleWishlist?: ((cardId: string) => Promise<void>) | undefined; wishlistBusy?: boolean; money: (m: Money) => string; cost: (v: CopyView['paid']) => string; metric: (v: CopyView['market']) => string }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<string | null>(initialCopy);
  const [inspecting, setInspecting] = useState<string | null>(initialInspection);
  const [zoomed, setZoomed] = useState(false);
  const [purchase, setPurchase] = useState<string | null>(null);
  const [wishError, setWishError] = useState(false);
  const [showDeals,setShowDeals]=useState(false);
  const dealsScroll=useRef<{element:HTMLElement;top:number}|null>(null);
  useLayoutEffect(()=>{
    const previous=dealsScroll.current;
    if(!previous)return;
    previous.element.scrollTop=showDeals?0:previous.top;
    if(!showDeals)dealsScroll.current=null;
  },[showDeals]);
  const [dealsEdition,setDealsEdition]=useState(catalog.kind==='identified'&&catalog.edition==='first-edition');
  const dealsReference:CatalogRef=catalog.kind==='identified'?{...catalog,edition:dealsEdition?'first-edition':'unlimited'}:catalog;
  const wishCardId = catalog.kind === 'identified' ? catalog.cardId : null;
  const isWished = !!wishCardId && !!wishlistIds?.includes(wishCardId);
  const [copiesOpenOverride, setCopiesOpen] = useState<boolean | null>(null);
  const copiesOpen = copiesOpenOverride ?? group.copies.length === 1;
  const copiesId = useId();
  const selected = group.copies.find(v => v.copy.id === editing);
  const inspected = group.copies.find(v => v.copy.id === inspecting);
  const linked = group.copies.find(v => v.copy.id === purchase)?.copy;
  return <UtilitySheet transition={transition} backLabel={t('inventory.back')} onBack={showDeals ? () => setShowDeals(false) : zoomed ? () => setZoomed(false) : selected ? () => setEditing(null) : linked ? () => setPurchase(null) : inspected ? () => setInspecting(null) : onClose} title={zoomed ? t('inventory.image') : inspected && !selected && !linked ? t('inventory.copyDetails') : selected ? t('inventory.edit') : linked ? t('inventory.purchaseRef') : t('inventory.details')} onClose={onClose}>
    {showDeals && wishCardId ? <SingleCardDeals cardId={wishCardId} reference={dealsReference}/> : zoomed ? <div className="space-y-3"><p className="text-sm text-slate-600">{t('inventory.imageHint')}</p>{group.card && <PokemonArt src={group.card.imageUrl} alt={group.card.name} size="zoom" />}</div> : selected && onSave ? <CopyEditor key={selected.copy.id} copy={selected.copy} onSave={onSave} onBack={() => setEditing(null)} /> : linked ? <div className="space-y-4"><Button variant="outline" onClick={() => setPurchase(null)}><LuArrowLeft aria-hidden className="rtl:rotate-180" />{t('inventory.back')}</Button><Card className="space-y-3"><h2 className="text-lg font-bold">{t('inventory.purchaseRef')}</h2>{linked.acquisition.kind === 'purchase' && <dl className="space-y-3 text-sm"><div><dt className="text-slate-600">{t('inventory.transactionId')}</dt><dd className="break-all font-medium" dir="ltr">{linked.acquisition.transactionId}</dd></div><div><dt className="text-slate-600">{t('inventory.lineId')}</dt><dd className="break-all" dir="ltr">{linked.acquisition.lineId}</dd></div></dl>}<p className="text-sm text-slate-600">{t('inventory.purchaseNext')}</p></Card></div> : inspected ? <div className="space-y-3">      {[inspected].map(v => <Card key={v.copy.id} className="space-y-3"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">{group.copies.length > 1 && `${t('inventory.copy', { number: group.copies.findIndex(c => c.copy.id === v.copy.id) + 1 })} · `}{v.copy.condition.status === 'known' ? v.copy.condition.value : t('inventory.unknown')}</h2><span className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-800">{t(`inventory.${v.copy.possession}`)}</span></div><p className="text-sm">{t('inventory.edition')}: {v.copy.catalog.kind === 'identified' ? t(`inventory.${v.copy.catalog.edition}`) : t('inventory.unidentified')}</p><dl className="grid grid-cols-2 gap-3 text-sm">{[['paid', cost(v.paid)], ['basis', v.basis.status === 'unavailable' ? t('inventory.unavailable') : `${money(v.basis)}${v.basis.status === 'estimated' ? ` · ${t('inventory.estimated')}` : ''}`], ['market', metric(v.market)], ['acquired', v.copy.acquiredOn.status === 'known' ? v.copy.acquiredOn.value : t('inventory.unknown')]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-600">{t(`inventory.${label}`)}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl><p className="text-xs text-slate-600">{t('inventory.nativePrice')}</p>{v.copy.notes && <p className="whitespace-pre-wrap break-words text-sm">{v.copy.notes}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditing(v.copy.id)} disabled={!onSave}>{t('inventory.edit')}</Button>{v.copy.acquisition.kind === 'purchase' ? <Button variant="outline" onClick={() => { if (onViewPurchase && v.copy.acquisition.kind === 'purchase') onViewPurchase(v.copy.acquisition.transactionId); else setPurchase(v.copy.id); }}>{t('inventory.purchase')}</Button> : <span className="text-sm text-slate-600">{t(`inventory.${v.copy.acquisition.kind}`)}</span>}</div></Card>)}</div> : <div className="card-details">
      <button type="button" onClick={() => setZoomed(true)} disabled={!group.card} aria-label={t('inventory.enlarge')} className="relative mx-auto block w-fit rounded-lg"><PokemonArt src={group.card?.imageUrl} alt={group.card?.name ?? group.key} size="detail" /><span className="absolute end-1 top-1 flex size-8 items-center justify-center rounded-lg surface-field text-blue-700"><LuZoomIn aria-hidden /></span></button><div className="card-identity text-center"><h2 className="text-[1.625rem] font-black leading-tight">{group.card?.name ?? group.key}</h2><p className="mt-1 text-sm text-slate-600">{group.card ? `${group.card.setName} · #${group.card.number}` : t('inventory.noCatalog')}</p><div className="mt-2 flex flex-wrap justify-center gap-2 text-xs font-semibold text-blue-800">{catalog.kind === 'identified' && <>{catalog.finish.status === 'known' && <span className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1"><LuSparkles aria-hidden />{catalog.finish.value === 'holo' ? t('inventory.holo') : catalog.finish.value}</span>}<span className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1"><LuLayers aria-hidden />{t(`inventory.${catalog.edition}`)}</span></>}</div></div>
      <CardMarketPrice live={livePrices} onEditionChange={first=>{setDealsEdition(first);onEditionChange?.(first);}} status={priceStatus} onRetry={onRetryPrice} catalog={catalog} quotes={quotes} currency={currency} copies={group.copies} money={money} />
      {group.copies.length > 0 && <Card className="copies-panel !p-0 overflow-hidden"><h2><DisclosureButton className="flex min-h-11 w-full items-center gap-3 px-3 text-start text-base font-bold" open={copiesOpen} contentId={copiesId} onClick={() => setCopiesOpen(!copiesOpen)}><span>{t('inventory.ownCopies')}</span><span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{t('inventory.owned', { count: group.copies.length })}</span><DisclosureChevron open={copiesOpen} className="ms-auto" /></DisclosureButton></h2><DisclosureContent id={copiesId} className="copy-accordion" open={copiesOpen}><ul className="divide-y divide-blue-100">{group.copies.map((v, n) => <li key={v.copy.id} aria-label={`${t('inventory.copy', { number: n + 1 })} · ${v.copy.condition.status === 'known' ? v.copy.condition.value : t('inventory.unknown')}`} className="flex flex-wrap items-center gap-x-2 px-3 py-0">
        <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-start" onClick={() => setInspecting(v.copy.id)} aria-label={`${t('inventory.copyDetails')} ${n + 1}`}><span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold">{v.copy.condition.status === 'known' ? v.copy.condition.value : t('inventory.unknown')}</span>
        <span className="min-w-0 text-sm text-slate-600">{t('inventory.paidShort')} {cost(v.paid)}{v.copy.possession !== 'received' && <span className="ms-2 text-xs text-slate-600">{t(`inventory.${v.copy.possession}`)}</span>}</span></button>
        {v.copy.acquisition.kind === 'purchase' && <button type="button" className="min-h-11 rounded-lg px-2 text-sm font-semibold text-blue-700" onClick={() => { if (onViewPurchase && v.copy.acquisition.kind === 'purchase') onViewPurchase(v.copy.acquisition.transactionId); else setPurchase(v.copy.id); }}>{t('inventory.purchase')}<LuChevronRight aria-hidden className="ms-1 inline size-4 rtl:rotate-180" /></button>}
      </li>)}</ul></DisclosureContent></Card>}
      <div className="card-detail-actions space-y-2">{wishError && <p role="alert" className="text-xs text-red-700">{t('inventory.wishlistFailed')}</p>}<div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="min-w-0 gap-1.5 px-2 text-sm" aria-label={t(isWished ? 'inventory.removeWishlist' : 'inventory.addWishlist')} disabled={!wishCardId || !onToggleWishlist || wishlistBusy} aria-pressed={isWished} onClick={() => { if (wishCardId && onToggleWishlist) void onToggleWishlist(wishCardId).then(() => setWishError(false)).catch(() => setWishError(true)); }}><LuHeart aria-hidden className="shrink-0" fill={isWished ? "currentColor" : "none"} /><span className="min-w-0">{t(isWished ? 'inventory.removeWishlistShort' : 'inventory.addWishlist')}</span></Button>
        <Button variant="outline" disabled={!wishCardId || !livePrices} onClick={event=>{const element=event.currentTarget.closest<HTMLElement>('.sheet-content');if(element)dealsScroll.current={element,top:element.scrollTop};setShowDeals(true);}}><LuTag aria-hidden />{t('inventory.findDeals')}</Button>
      </div><Button className="w-full" disabled><LuPlus aria-hidden />{t('inventory.recordPurchase')}</Button></div>
    </div>}
  </UtilitySheet>;
}
function CopyEditor({ copy, onSave, onBack }: { copy: CardCopy; onSave: SaveCopy; onBack: () => void }) {
  const { t } = useTranslation();
  const [baseline] = useState(copy);
  const [condition, setCondition] = useState(baseline.condition.status === 'known' ? baseline.condition.value : 'unknown');
  const [edition, setEdition] = useState(baseline.catalog.kind === 'identified' ? baseline.catalog.edition : 'unknown');
  const [notes, setNotes] = useState(baseline.notes);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  async function submit(e: FormEvent) {
    e.preventDefault(); if (saving) return; setSaving(true); setFailed(false);
    try {
      const nextCondition = condition === (baseline.condition.status === 'known' ? baseline.condition.value : 'unknown') ? baseline.condition : condition === 'unknown' ? baseline.condition.status === 'unknown' ? baseline.condition : { status: 'unknown' as const, reason: 'Condition not recorded' } : { status: 'known' as const, value: conditionSchema.parse(condition), source: 'user' as const };
      const patch: CopyMetadataEdit = { condition: nextCondition, notes, ...(baseline.catalog.kind === 'identified' ? { edition } : {}) };
      await onSave(baseline, patch); onBack();
    } catch { setFailed(true); } finally { setSaving(false); }
  }
  return <form onSubmit={e => void submit(e)} className="space-y-5"><p className="break-all text-sm font-medium" dir="ltr">{baseline.id}</p><fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
    <label className="flex flex-col gap-2 text-sm font-medium">{t('inventory.condition')}<Select aria-label={t('inventory.condition')}  value={condition} onChange={e => setCondition(e.target.value)}>{['unknown', ...conditionSchema.options].map(c => <option key={c} value={c}>{c === 'unknown' ? t('inventory.unknown') : c}</option>)}</Select></label>
    {baseline.catalog.kind === 'identified' && <label className="flex min-h-9 items-center gap-2 text-sm font-medium"><input aria-label={t('inventory.edition')} type="checkbox" checked={edition === 'first-edition'} onChange={e => setEdition(e.target.checked ? 'first-edition' : 'unlimited')} />First Edition</label>}
    <div className="space-y-2"><label htmlFor={`${id}-notes`} className="block text-sm font-medium">{t('inventory.notes')}</label><textarea id={`${id}-notes`} maxLength={2000} rows={4} value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-xl border border-slate-500 bg-white p-3 text-base" aria-describedby={`${id}-limit`} /><p id={`${id}-limit`} className="text-xs text-slate-600">{t('inventory.noteLimit')} · {notes.length}/2000</p></div>
    {failed && <p role="alert" className="text-sm text-rose-700">{t('inventory.saveFailed')}</p>}<div className="flex gap-2"><Button type="submit">{t(saving ? 'inventory.saving' : 'inventory.save')}</Button><Button type="button" variant="outline" onClick={onBack}>{t('inventory.cancel')}</Button></div>
  </fieldset></form>;
}
