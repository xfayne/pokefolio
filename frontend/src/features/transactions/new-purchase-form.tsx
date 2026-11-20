import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuPlus, LuShoppingCart, LuTag, LuX } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surfaces';
import { DisclosureButton, DisclosureContent } from '@/components/ui/disclosure';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { conditionSchema, currencySchema, type Money } from '@/domain/schema';
import { previewPurchaseDraft, type PurchaseDraft } from '@/domain/purchase-draft';
import type { InventoryCatalogCard } from '@/domain/inventory';

export function NewPurchaseForm({ draft, catalog, onChange, onSave, onAddCard }: {
  draft: PurchaseDraft; catalog: readonly InventoryCatalogCard[]; onChange: (draft: PurchaseDraft) => void;
  onSave?: () => Promise<void>; onAddCard?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [undoCurrency, setUndoCurrency] = useState<PurchaseDraft | null>(null);
  const busy = useRef(false);
  const id = useId();
  const preview = previewPurchaseDraft(draft);
  const cards = new Map(catalog.map(c => [c.id, c]));
  const money = (value: Money) => new Intl.NumberFormat(i18n.language === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: value.currency }).format(value.minor / 100);
  const symbol = new Intl.NumberFormat('en-US', { style: 'currency', currency: draft.currency }).formatToParts(0).find(p => p.type === 'currency')?.value ?? draft.currency;
  const error = (field: string) => submitted ? preview.issues.find(i => i.field === field) : undefined;
  const errorText = (field: string) => { const issue = error(field); return issue ? t(`newPurchase.${issue.code}Error`) : ''; };
  function change(next: PurchaseDraft) { setUndoCurrency(null); setNotice(''); setFailed(false); onChange(next); }
  function changeCurrency(currency: PurchaseDraft['currency']) {
    if (currency === draft.currency) return;
    setUndoCurrency(draft); setNotice(t('newPurchase.currencyChanged')); setFailed(false);
    onChange({ ...draft, currency, shipping: '', lotTotal: '', cards: draft.cards.map(c => ({ ...c, amount: '' })) });
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current || !onSave) return;
    setSubmitted(true); setFailed(false);
    if (preview.issues.length) { requestAnimationFrame(() => document.getElementById(`${id}-${preview.issues[0]!.field}`)?.focus()); return; }
    busy.current = true; setSaving(true);
    try { await onSave(); } catch { setFailed(true); } finally { busy.current = false; setSaving(false); }
  }
  const fieldError = (field: string) => error(field) ? <span id={`${id}-${field}-error`} className="new-purchase-error">{errorText(field)}</span> : null;
  const inputProps = (field: string) => ({ id: `${id}-${field}`, 'aria-invalid': !!error(field), 'aria-describedby': error(field) ? `${id}-${field}-error` : undefined });
  const amountInput = (field: string, label: string, value: string, update: (value: string) => void, disabled = false, accessibleLabel = label) => <label className="new-purchase-field" htmlFor={`${id}-${field}`}>
    <span>{label}</span><span className="new-purchase-money" dir="ltr"><span aria-hidden>{symbol}</span><Input {...inputProps(field)} aria-label={accessibleLabel} className="new-purchase-input" inputMode="decimal" maxLength={20} value={disabled ? '' : value} placeholder={disabled ? t('newPurchase.unallocated') : '0.00'} disabled={disabled} onChange={e => update(e.target.value)} /></span>{fieldError(field)}
  </label>;
  return <form className="new-purchase-form" aria-label={t('newPurchase.title')} noValidate onSubmit={e => void submit(e)}>
    <fieldset disabled={saving} className="new-purchase-fields">
      <div className="new-purchase-kind" role="group" aria-label={t('newPurchase.title')}>
        <button type="button" aria-pressed="true"><LuShoppingCart aria-hidden />{t('newPurchase.purchase')}</button>
        <button type="button" aria-disabled="true" onClick={() => setNotice(t('newPurchase.saleSoon'))}><LuTag aria-hidden />{t('newPurchase.sale')}</button>
      </div>
      <Card className="new-purchase-meta">
        <label className="new-purchase-field" htmlFor={`${id}-date`}><span>{t('newPurchase.date')}</span><Input {...inputProps('date')} className="new-purchase-input" type="date" value={draft.date} onChange={e => change({ ...draft, date: e.target.value })} />{fieldError('date')}</label>
        <label className="new-purchase-field"><span>{t('newPurchase.source')}</span><Select aria-label={t('newPurchase.source')} className="new-purchase-input" value={draft.source} onChange={e => change({ ...draft, source: e.target.value as PurchaseDraft['source'] })}>{(['ebay', 'manual', 'other'] as const).map(source => <option value={source} key={source}>{t(`transactionHistory.${source}`)}</option>)}</Select></label>
        <label className="new-purchase-field" htmlFor={`${id}-seller`}><span>{t('newPurchase.seller')}</span><Input {...inputProps('seller')} className="new-purchase-input" maxLength={200} value={draft.seller} onChange={e => change({ ...draft, seller: e.target.value })} />{fieldError('seller')}</label>
        <label className="new-purchase-field"><span>{t('newPurchase.currency')}</span><Select aria-label={t('newPurchase.currency')} className="new-purchase-input" value={draft.currency} onChange={e => changeCurrency(currencySchema.parse(e.target.value))}>{currencySchema.options.map(c => <option key={c} value={c}>{c}</option>)}</Select></label>
      </Card>
      <Card className="new-purchase-cards">
        <div className="new-purchase-cards-heading"><h2>{t('newPurchase.cards')} · <span>{t('transactionHistory.copies', { count: draft.cards.length })}</span></h2>
          <div className="new-purchase-pricing" role="group" aria-label={t('newPurchase.cost')}>{(['per-copy', 'lot-total'] as const).map(mode => <button key={mode} type="button" aria-pressed={draft.pricingMode === mode} onClick={() => change({ ...draft, pricingMode: mode })}>{t(mode === 'per-copy' ? 'newPurchase.perCopy' : 'newPurchase.lot')}</button>)}</div>
        </div>
        <Button id={`${id}-cards`} className="new-purchase-add" variant="outline" type="button" aria-invalid={!!error('cards')} aria-describedby={error('cards') ? `${id}-cards-error` : undefined} aria-disabled={!onAddCard} onClick={() => onAddCard ? onAddCard() : setNotice(t('newPurchase.pickerSoon'))}><LuPlus aria-hidden />{t('newPurchase.add')}</Button>
        {fieldError('cards')}
        {draft.pricingMode === 'lot-total' && <div className="new-purchase-lot">{amountInput('lotTotal', t('newPurchase.lotTotal'), draft.lotTotal, lotTotal => change({ ...draft, lotTotal }))}<p>{t('newPurchase.lotNote')}</p></div>}
        <ul>{draft.cards.map((copy, index) => { const card = copy.catalog.kind === 'identified' ? cards.get(copy.catalog.cardId) : undefined; const name = card?.name ?? (copy.catalog.kind === 'unidentified' ? copy.catalog.description : t('inventory.unidentified')); return <li key={copy.id} className="new-purchase-copy">
          <PokemonArt src={card?.imageUrl} alt={name} className="new-purchase-art" />
          <div className="new-purchase-copy-body"><div className="new-purchase-copy-heading"><div><h3><bdi>{name}</bdi></h3><p>{card ? `${card.setName} · #${card.number}` : t('inventory.noCatalog')}</p></div><button type="button" aria-label={`${t('newPurchase.remove')} ${index + 1}: ${name}`} onClick={() => change({ ...draft, cards: draft.cards.filter(c => c.id !== copy.id) })}><LuX aria-hidden /></button></div>
            <div className="new-purchase-copy-fields">
              <label className="new-purchase-field"><span>{t('newPurchase.condition')}</span><Select className="new-purchase-input" aria-label={`${t('newPurchase.condition')} ${index + 1}`} value={copy.condition} onChange={e => change({ ...draft, cards: draft.cards.map(c => c.id === copy.id ? { ...c, condition: e.target.value as typeof c.condition } : c) })}><option value="unknown">{t('newPurchase.unknown')}</option>{conditionSchema.options.map(c => <option value={c} key={c}>{c}</option>)}</Select></label>
              {amountInput(`cost-${copy.id}`, t('newPurchase.cost'), copy.amount, amount => change({ ...draft, cards: draft.cards.map(c => c.id === copy.id ? { ...c, amount } : c) }), draft.pricingMode === 'lot-total', `${t('newPurchase.cost')} ${index + 1}`)}
            </div>
          </div>
        </li>; })}</ul>
      </Card>
      <Card className="new-purchase-shipping"><div><h2>{t('newPurchase.shipping')}</h2><p>{preview.range ? preview.range.min === preview.range.max ? t('newPurchase.split', { amount: money({ currency: draft.currency, minor: preview.range.min }) }) : t('newPurchase.splitRounded', { min: money({ currency: draft.currency, minor: preview.range.min }), max: money({ currency: draft.currency, minor: preview.range.max }) }) : t('newPurchase.splitEmpty')}</p></div>{amountInput('shipping', t('newPurchase.shipping'), draft.shipping, shipping => change({ ...draft, shipping }))}</Card>
      <Card className="new-purchase-totals" aria-label={t('purchaseDetails.breakdown')}><dl><div><dt>{t('newPurchase.cards')}</dt><dd><bdi>{preview.subtotal ? money(preview.subtotal) : '—'}</bdi></dd></div><div><dt>{t('newPurchase.total')}</dt><dd><bdi>{preview.total ? money(preview.total) : '—'}</bdi></dd></div></dl></Card>
      <Card className="new-purchase-shipment"><h2><DisclosureButton open={shipmentOpen} contentId={`${id}-shipment`} onClick={() => setShipmentOpen(v => !v)}><span>{t('newPurchase.shipment')} <span className="font-normal">{t('newPurchase.optional')}</span></span><LuChevronDown aria-hidden className={`size-4 transition-transform ${shipmentOpen ? 'rotate-180' : ''}`} /></DisclosureButton></h2>
        <DisclosureContent id={`${id}-shipment`} open={shipmentOpen}><div className="new-purchase-shipment-fields"><label className="new-purchase-field"><span>{t('newPurchase.carrier')}</span><Input className="new-purchase-input" aria-label={t('newPurchase.carrier')} maxLength={200} value={draft.carrier} onChange={e => change({ ...draft, carrier: e.target.value })} /></label><label className="new-purchase-field"><span>{t('newPurchase.tracking')}</span><Input className="new-purchase-input" aria-label={t('newPurchase.tracking')} maxLength={100} value={draft.trackingNumber} onChange={e => change({ ...draft, trackingNumber: e.target.value })} /></label></div></DisclosureContent>
      </Card>
    </fieldset>
    <p role="status" className={notice ? 'new-purchase-notice' : 'sr-only'}>{notice}{undoCurrency && <Button type="button" variant="outline" disabled={saving} onClick={() => { onChange(undoCurrency); setUndoCurrency(null); setNotice(''); }}>{t('newPurchase.undo')}</Button>}</p>
    {submitted && preview.issues.length > 0 && <p role="alert" className="new-purchase-error">{t('newPurchase.invalid')}</p>}
    {failed && <p role="alert" className="new-purchase-error">{t('newPurchase.failed')}</p>}
    {!onSave && <p className="new-purchase-notice">{t('newPurchase.unavailable')}</p>}
    <div className="new-purchase-save"><Button type="submit" disabled={saving || !onSave}>{t(saving ? 'newPurchase.saving' : 'newPurchase.save')}</Button></div>
  </form>;
}
