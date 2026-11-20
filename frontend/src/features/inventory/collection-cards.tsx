import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronRight, LuPencil, LuArrowLeft, LuSlidersHorizontal } from 'react-icons/lu';
import { UtilitySheet } from '@/components/layout/utility-sheet';
import { Button } from '@/components/ui/button';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { selectInventory, type CopyMetadataEdit, type CopyView, type InventoryCatalogCard, type CopyQuote, type InventoryGroup } from '@/domain/inventory';
import { CardMarketPrice } from './card-market-price';
import { bestCopy } from './copy-condition';
import { conditionSchema, type CardCopy, type Money, type CatalogRef } from '@/domain/schema';

export type InventoryData = Readonly<{ ownerUid: string; copies: readonly CardCopy[]; catalog: readonly InventoryCatalogCard[]; quotes: readonly CopyQuote[]; currency: Money['currency'] }>;
export type SaveCopy = (copy: CardCopy, patch: CopyMetadataEdit) => Promise<void>;
const selectClass = 'min-h-11 min-w-0 rounded-xl border border-blue-200 bg-white px-3 text-base';

function Art({ card, large = false }: { card: InventoryCatalogCard | null; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`${large ? 'mx-auto w-48 sm:w-56' : 'w-12 shrink-0'} aspect-[245/342] overflow-hidden rounded-md bg-blue-100`}>
    {card && !failed ? <img src={card.imageUrl} alt={card.name} loading={large ? 'eager' : 'lazy'} width="245" height="342" className="h-full w-full object-contain" onError={() => setFailed(true)} /> : <span aria-hidden className="flex h-full items-center justify-center text-blue-700">?</span>}
  </div>;
}
export function CollectionCards({ data, onSave }: { data: InventoryData; onSave: SaveCopy }) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [sort, setSort] = useState('name');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [initialCopy, setInitialCopy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const id = useId();
  const inventory = selectInventory(data.ownerUid, data.copies, data.catalog, data.quotes, data.currency);
  const money = (m: Money) => new Intl.NumberFormat(i18n.language === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: m.currency }).format(m.minor / 100);
  const cost = (v: CopyView['paid']) => v.status === 'exact' ? money(v.value) : v.status === 'estimated' ? `${money(v.value)} · ${t('inventory.estimated')}` : t(`inventory.${v.status === 'unallocated' ? 'unallocated' : 'unavailable'}`);
  const metric = (v: CopyView['market']) => v.status === 'unavailable' ? t('inventory.unpriced') : money(v);
  const title = (g: InventoryGroup) => g.card?.name ?? (g.copies[0]?.copy.catalog.kind === 'unidentified' ? g.copies[0].copy.catalog.description : g.key);
  const needle = search.trim().toLocaleLowerCase(i18n.language);
  const groups = inventory.groups.filter(g => `${title(g)} ${g.card?.setName ?? ''} ${g.card?.number ?? ''}`.toLocaleLowerCase(i18n.language).includes(needle) && (filter === 'all' || g.copies.some(v => v.copy.possession === filter)));
  groups.sort((a, b) => sort === 'value' ? Number(b.market.pricedCount > 0) - Number(a.market.pricedCount > 0) || b.market.minor - a.market.minor || title(a).localeCompare(title(b)) : sort === 'copies' ? b.copies.length - a.copies.length || title(a).localeCompare(title(b)) : title(a).localeCompare(title(b), i18n.language));
  const selectedGroup = inventory.groups.find(g => g.key === selected);
  const toggle = (key: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  return <section aria-label={t('inventory.title')} className="space-y-4">
    <div className="collection-toolbar">
      <div className="flex gap-2">
        <label htmlFor={`${id}-search`} className="sr-only">{t('inventory.search')}</label>
        <input id={`${id}-search`} type="search" placeholder={t('inventory.search')} value={search} onChange={e => setSearch(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 text-base" />
        <button type="button" onClick={() => setOptionsOpen(v => !v)} aria-label={t('inventory.options')} aria-expanded={optionsOpen} aria-controls={`${id}-options`} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-700"><LuSlidersHorizontal aria-hidden className="size-5" /></button>
      </div>
      <div id={`${id}-options`} className="collection-options" data-open={optionsOpen} aria-hidden={!optionsOpen} inert={!optionsOpen}>
        <div className="overflow-hidden"><div className="pt-3">    <div className="flex flex-wrap gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium">{t('inventory.sort')}<select aria-label={t('inventory.sort')} className={selectClass} value={sort} onChange={e => setSort(e.target.value)}><option value="name">{t('inventory.name')}</option><option value="value">{t('inventory.value')}</option><option value="copies">{t('inventory.quantity')}</option></select></label>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium">{t('inventory.delivery')}<select aria-label={t('inventory.delivery')} className={selectClass} value={filter} onChange={e => setFilter(e.target.value)}>{['all', 'received', 'pending', 'unknown'].map(k => <option key={k} value={k}>{t(`inventory.${k}`)}</option>)}</select></label>
    </div>
</div></div>
      </div>
    </div>
    <p role="status" className="sr-only">{notice}</p>
    {!groups.length && <EmptyState title={t('inventory.empty')} description={t('inventory.emptyDetail')} />}
    <ul className="space-y-2">{groups.map(g => <li key={g.key} className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <div className="relative">
        <button type="button" onClick={() => { setInitialCopy(null); setSelected(g.key); }} className="flex min-h-24 w-full items-center gap-3 rounded-2xl p-3 text-start">
          <span className="sr-only">{t('inventory.details')}: </span><Art card={g.card} />
          <span className="min-w-0 flex-1"><span className="block break-words text-base font-semibold text-slate-900">{title(g)}</span><span className="mt-1 block truncate text-xs text-slate-600">{g.card ? `${g.card.setName} · #${g.card.number}` : t('inventory.noCatalog')}</span></span>
          <span className="shrink-0 pb-7 text-end text-sm font-semibold text-blue-700">{g.market.pricedCount ? money(g.market) : t('inventory.unpriced')}</span>
        </button>
        <button type="button" aria-label={`${t('inventory.copies', { count: g.copies.length })}: ${title(g)}`} aria-expanded={expanded.has(g.key)} aria-controls={`${id}-${g.key}`} onClick={() => toggle(g.key)} className="absolute bottom-1 flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-blue-800" style={{ insetInlineEnd: '0.5rem' }}>
          <span className="rounded-md bg-blue-50 px-2 py-0.5">{t('inventory.copies', { count: g.copies.length })}</span>{expanded.has(g.key) ? <LuChevronDown aria-hidden /> : <LuChevronRight aria-hidden className="rtl:rotate-180" />}
        </button>
      </div>
      {expanded.has(g.key) && <div id={`${id}-${g.key}`} className="border-t border-blue-100 bg-blue-50/70 px-3">{g.copies.map((v, n) => <div key={v.copy.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-blue-100 py-2 last:border-0"><div><span className="text-xs font-semibold">{t('inventory.copy', { number: n + 1 })} · {v.copy.condition.status === 'known' ? v.copy.condition.value : t('inventory.unknown')}</span><p className="text-xs text-slate-600">{t(`inventory.${v.copy.possession}`)} · {v.copy.catalog.kind === 'identified' ? t(`inventory.${v.copy.catalog.edition}`) : t('inventory.unidentified')}</p></div><div className="text-xs"><p>{t('inventory.paid')}: <b>{cost(v.paid)}</b></p><p className="text-slate-600">{t('inventory.market')}: {metric(v.market)}</p></div><button type="button" onClick={() => { setInitialCopy(v.copy.id); setSelected(g.key); }} aria-label={`${t('inventory.edit')} ${v.copy.id}`} className="flex size-11 items-center justify-center rounded-xl text-blue-700"><LuPencil aria-hidden /></button></div>)}</div>}
    </li>)}</ul>
    {selectedGroup && <CardDetailsSheet key={selectedGroup.key} group={selectedGroup} catalog={(bestCopy(selectedGroup.copies)?.copy ?? selectedGroup.copies[0]!.copy).catalog} quotes={data.quotes} currency={data.currency} initialCopy={initialCopy} onClose={() => setSelected(null)} onSave={async (copy, patch) => { await onSave(copy, patch); setNotice(t('inventory.saved')); }} money={money} cost={cost} metric={metric} />}
  </section>;
}

export function CardDetailsSheet({ group, catalog, quotes, currency, initialCopy, onClose, onSave, money, cost, metric }: { group: InventoryGroup; catalog: CatalogRef; quotes: readonly CopyQuote[]; currency: Money['currency']; initialCopy: string | null; onClose: () => void; onSave: SaveCopy; money: (m: Money) => string; cost: (v: CopyView['paid']) => string; metric: (v: CopyView['market']) => string }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<string | null>(initialCopy);
  const [purchase, setPurchase] = useState<string | null>(null);
  const selected = group.copies.find(v => v.copy.id === editing);
  const linked = group.copies.find(v => v.copy.id === purchase)?.copy;
  return <UtilitySheet title={selected ? t('inventory.edit') : linked ? t('inventory.purchaseRef') : t('inventory.details')} onClose={onClose}>
    {selected ? <CopyEditor key={selected.copy.id} copy={selected.copy} onSave={onSave} onBack={() => setEditing(null)} /> : linked ? <div className="space-y-4"><Button variant="outline" onClick={() => setPurchase(null)}><LuArrowLeft aria-hidden className="rtl:rotate-180" />{t('inventory.back')}</Button><Card className="space-y-3"><h2 className="text-lg font-bold">{t('inventory.purchaseRef')}</h2>{linked.acquisition.kind === 'purchase' && <dl className="space-y-3 text-sm"><div><dt className="text-slate-600">{t('inventory.transactionId')}</dt><dd className="break-all font-medium" dir="ltr">{linked.acquisition.transactionId}</dd></div><div><dt className="text-slate-600">{t('inventory.lineId')}</dt><dd className="break-all" dir="ltr">{linked.acquisition.lineId}</dd></div></dl>}<p className="text-sm text-slate-600">{t('inventory.purchaseNext')}</p></Card></div> : <div className="space-y-5">
      <Art card={group.card} large /><div className="text-center"><h2 className="text-2xl font-bold">{group.card?.name ?? group.key}</h2><p className="mt-1 text-sm text-slate-600">{group.card ? `${group.card.setName} · #${group.card.number}` : t('inventory.noCatalog')}</p></div>
      <CardMarketPrice catalog={catalog} quotes={quotes} currency={currency} copies={group.copies} money={money} />
      {group.copies.length > 0 && <h2 className="text-lg font-bold">{t('inventory.ownCopies')}</h2>}
      {group.copies.map((v, n) => <Card key={v.copy.id} className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{t('inventory.copy', { number: n + 1 })} · {v.copy.condition.status === 'known' ? v.copy.condition.value : t('inventory.unknown')}</h3><span className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-800">{t(`inventory.${v.copy.possession}`)}</span></div><p className="break-all text-xs text-slate-500" dir="ltr">{v.copy.id}</p><p className="text-sm">{t('inventory.edition')}: {v.copy.catalog.kind === 'identified' ? t(`inventory.${v.copy.catalog.edition}`) : t('inventory.unidentified')}</p><dl className="grid grid-cols-2 gap-3 text-sm">{[['paid', cost(v.paid)], ['basis', v.basis.status === 'unavailable' ? t('inventory.unavailable') : `${money(v.basis)}${v.basis.status === 'estimated' ? ` · ${t('inventory.estimated')}` : ''}`], ['market', metric(v.market)], ['acquired', v.copy.acquiredOn.status === 'known' ? v.copy.acquiredOn.value : t('inventory.unknown')]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-600">{t(`inventory.${label}`)}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl><p className="text-xs text-slate-600">{t('inventory.nativePrice')}</p>{v.copy.notes && <p className="whitespace-pre-wrap break-words text-sm">{v.copy.notes}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditing(v.copy.id)}>{t('inventory.edit')}</Button>{v.copy.acquisition.kind === 'purchase' ? <Button variant="outline" onClick={() => setPurchase(v.copy.id)}>{t('inventory.purchase')}</Button> : <span className="text-sm text-slate-600">{t(`inventory.${v.copy.acquisition.kind}`)}</span>}</div></Card>)}
    </div>}
  </UtilitySheet>;
}
function CopyEditor({ copy, onSave, onBack }: { copy: CardCopy; onSave: SaveCopy; onBack: () => void }) {
  const { t } = useTranslation();
  const [condition, setCondition] = useState(copy.condition.status === 'known' ? copy.condition.value : 'unknown');
  const [edition, setEdition] = useState(copy.catalog.kind === 'identified' ? copy.catalog.edition : 'unknown');
  const [notes, setNotes] = useState(copy.notes);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  async function submit(e: FormEvent) {
    e.preventDefault(); if (saving) return; setSaving(true); setFailed(false);
    try {
      const nextCondition = condition === (copy.condition.status === 'known' ? copy.condition.value : 'unknown') ? copy.condition : condition === 'unknown' ? copy.condition.status === 'unknown' ? copy.condition : { status: 'unknown' as const, reason: 'Condition not recorded' } : { status: 'known' as const, value: conditionSchema.parse(condition), source: 'user' as const };
      const patch: CopyMetadataEdit = { condition: nextCondition, notes, ...(copy.catalog.kind === 'identified' ? { edition } : {}) };
      await onSave(copy, patch); onBack();
    } catch { setFailed(true); } finally { setSaving(false); }
  }
  return <form onSubmit={e => void submit(e)} className="space-y-5"><p className="break-all text-sm font-medium" dir="ltr">{copy.id}</p><fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
    <label className="flex flex-col gap-2 text-sm font-medium">{t('inventory.condition')}<select aria-label={t('inventory.condition')} className={selectClass} value={condition} onChange={e => setCondition(e.target.value)}>{['unknown', ...conditionSchema.options].map(c => <option key={c} value={c}>{c === 'unknown' ? t('inventory.unknown') : c}</option>)}</select></label>
    {copy.catalog.kind === 'identified' && <label className="flex flex-col gap-2 text-sm font-medium">{t('inventory.edition')}<select aria-label={t('inventory.edition')} className={selectClass} value={edition} onChange={e => setEdition(e.target.value as typeof edition)}>{(['unknown', 'unlimited', 'first-edition'] as const).map(c => <option key={c} value={c}>{t(`inventory.${c}`)}</option>)}</select></label>}
    <div className="space-y-2"><label htmlFor={`${id}-notes`} className="block text-sm font-medium">{t('inventory.notes')}</label><textarea id={`${id}-notes`} maxLength={2000} rows={4} value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-xl border border-slate-500 bg-white p-3 text-base" aria-describedby={`${id}-limit`} /><p id={`${id}-limit`} className="text-xs text-slate-600">{t('inventory.noteLimit')} · {notes.length}/2000</p></div>
    {failed && <p role="alert" className="text-sm text-rose-700">{t('inventory.saveFailed')}</p>}<div className="flex gap-2"><Button type="submit">{t(saving ? 'inventory.saving' : 'inventory.save')}</Button><Button type="button" variant="outline" onClick={onBack}>{t('inventory.cancel')}</Button></div>
  </fieldset></form>;
}
