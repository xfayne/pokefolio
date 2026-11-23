import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LuShoppingCart, LuTag } from 'react-icons/lu';
import { Card } from '@/components/ui/surfaces';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { currencySchema, type CardCopy } from '@/domain/schema';
import type { InventoryCatalogCard } from '@/domain/inventory';
import type { ImportedPurchaseEditDraft } from '@/domain/imported-purchase-edit';
import { TransactionFormHeader } from './transaction-form-header';

export function ImportedPurchaseEditForm({ initial, copies, catalog, onSave }: {
  initial: ImportedPurchaseEditDraft;
  copies: readonly CardCopy[];
  catalog: readonly InventoryCatalogCard[];
  onSave: (draft: ImportedPurchaseEditDraft) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState('');
  const busy = useRef(false);
  const id = useId();
  const cardById = new Map(catalog.map(card => [card.id, card]));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setFailed('');
    try { await onSave(draft); }
    catch (error) { setFailed(error instanceof Error ? error.message : t('newPurchase.failed')); }
    finally { busy.current = false; setSaving(false); }
  }
  return <form id={id} aria-label={t('newPurchase.editTitle')} className="new-purchase-form" noValidate onSubmit={event => void submit(event)}>
    <fieldset disabled={saving} className="new-purchase-fields">
      <TransactionFormHeader formId={id} disabled={saving} saving={saving} label={t(saving ? 'newPurchase.saving' : 'newPurchase.saveChanges')}>
        <div className="new-purchase-kind" role="group" aria-label={t('newPurchase.editTitle')}>
          <button type="button" aria-pressed="true"><LuShoppingCart aria-hidden />{t('newPurchase.purchase')}</button>
          <button type="button" disabled><LuTag aria-hidden />{t('newPurchase.sale')}</button>
        </div>
      </TransactionFormHeader>
      <Card className="new-purchase-meta">
        <label className="new-purchase-field"><span>{t('newPurchase.date')}</span>
          <Input type="date" className="new-purchase-input" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} />
        </label>
        <p className="text-xs text-slate-600">{t('purchaseDetails.keepCopyDates')}</p>
        <label className="new-purchase-field"><span>{t('inventory.notes')}</span>
          <textarea className="new-purchase-input min-h-20 w-full rounded-xl border p-3" maxLength={2000} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} />
        </label>
      </Card>
      <Card className="new-purchase-cards">
        <div className="new-purchase-cards-heading"><h2>{t('newPurchase.cards')} · <span>{t('transactionHistory.copies', { count: draft.cards.length })}</span></h2></div>
        <ul>{draft.cards.map((field, index) => {
          const copy = copies.find(c => c.id === field.id);
          const art = copy?.catalog.kind === 'identified' ? cardById.get(copy.catalog.cardId) : undefined;
          const name = art?.name ?? (copy?.catalog.kind === 'unidentified' ? copy.catalog.description : t('inventory.unidentified'));
          return <li className="new-purchase-copy" key={field.id}>
            <PokemonArt src={art?.imageUrl} alt={name} className="new-purchase-art" />
            <div className="new-purchase-copy-body">
              <div className="new-purchase-copy-heading"><div><h3><bdi>{name}</bdi></h3><p>{art ? art.setName + ' · #' + art.number : t('inventory.noCatalog')}</p></div></div>
              <div className="new-purchase-copy-fields">
                <label className="new-purchase-field"><span>{t('newPurchase.cost')} {index + 1}</span>
                  <Input className="new-purchase-input" aria-label={t('purchaseDetails.copyCostNumber', { count: index + 1 })} inputMode="decimal" maxLength={20} placeholder={t('newPurchase.unknown')} value={field.amount} onChange={event => setDraft({ ...draft, cards: draft.cards.map(c => c.id === field.id ? { ...c, amount: event.target.value } : c) })} />
                </label>
                <label className="new-purchase-field"><span>{t('newPurchase.currency')}</span>
                  <Select aria-label={t('purchaseDetails.copyCurrencyNumber', { count: index + 1 })} className="new-purchase-input" value={field.currency} onChange={event => setDraft({ ...draft, cards: draft.cards.map(c => c.id === field.id ? { ...c, currency: currencySchema.parse(event.target.value) } : c) })}>
                    {currencySchema.options.map(currency => <option key={currency} value={currency}>{currency}</option>)}
                  </Select>
                </label>
              </div>
              {!field.amount && <p className="text-xs text-slate-600">{t('purchaseDetails.unknownCost')}</p>}
              {copy?.condition.status === 'known' && <p className="text-xs text-slate-600">{copy.condition.value}</p>}
            </div>
          </li>;
        })}</ul>
      </Card>
    </fieldset>
    {failed && <p role="alert" className="new-purchase-error">{t('newPurchase.failed')} {failed}</p>}
  </form>;
}
