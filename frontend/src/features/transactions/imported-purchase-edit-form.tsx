import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus, LuShoppingCart, LuTag, LuX } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surfaces';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { conditionSchema, type CardCopy } from '@/domain/schema';
import type { InventoryCatalogCard } from '@/domain/inventory';
import type { ImportedPurchaseEditDraft } from '@/domain/imported-purchase-edit';
import { TransactionFormHeader } from './transaction-form-header';

export function ImportedPurchaseEditForm({ initial, copies, catalog, onSave, onAddCard }: {
  initial: ImportedPurchaseEditDraft;
  copies: readonly CardCopy[];
  catalog: readonly InventoryCatalogCard[];
  onSave: (draft: ImportedPurchaseEditDraft) => Promise<void>;
  onAddCard: (draft: ImportedPurchaseEditDraft, setDraft: (draft: ImportedPurchaseEditDraft) => void) => void;
}) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState('');
  const busy = useRef(false);
  const id = useId();
  const catalogById = new Map(catalog.map(card => [card.id, card]));
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
  const currencyLabel = (currency: string) =>
    new Intl.NumberFormat(i18n.language === 'he' ? 'he-IL' : 'en-US', {
      style: 'currency', currency,
    }).formatToParts(0).find(part => part.type === 'currency')?.value ?? currency;
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
          <Input type="date" className="new-purchase-input" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
        </label>
        <label className="new-purchase-field"><span>{t('inventory.notes')}</span>
          <textarea className="new-purchase-input min-h-20 w-full rounded-xl border p-3" maxLength={2000} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
        </label>
      </Card>
      <Card className="new-purchase-cards">
        <div className="new-purchase-cards-heading">
          <h2>{t('newPurchase.cards')} · <span>{t('transactionHistory.copies', { count: draft.cards.length })}</span></h2>
        </div>
        <Button id={id+'-cards'} className="new-purchase-add" variant="outline" type="button"
          onClick={() => onAddCard(draft,setDraft)}>
          <LuPlus aria-hidden />{t('newPurchase.add')}
        </Button>
        <ul>{draft.cards.map((field, index) => {
          const copy = copies.find(c => c.id === field.id);
          const catalogRef = copy?.catalog ?? field.catalog;
          const card = catalogRef.kind === 'identified' ? catalogById.get(catalogRef.cardId) : undefined;
          const name = card?.name ?? (catalogRef.kind === 'unidentified' ? catalogRef.description : t('inventory.unidentified'));
          return <li className="new-purchase-copy" key={field.id}>
            <PokemonArt src={card?.imageUrl} alt={name} className="new-purchase-art" />
            <div className="new-purchase-copy-body">
              <div className="new-purchase-copy-heading">
                <div><h3><bdi>{name}</bdi></h3><p>{card ? card.setName+' · #'+card.number : t('inventory.noCatalog')}</p></div>
                <button type="button" aria-label={t('newPurchase.remove')+' '+(index+1)+': '+name}
                  onClick={() => setDraft({ ...draft,cards:draft.cards.filter(c=>c.id!==field.id) })}><LuX aria-hidden /></button>
              </div>
              <div className="new-purchase-copy-fields">
                <label className="new-purchase-field"><span>{t('newPurchase.condition')}</span>
                  <Select className="new-purchase-input" aria-label={t('newPurchase.condition')+' '+(index+1)}
                    value={field.condition} onChange={e => setDraft({...draft,cards:draft.cards.map(c=>c.id===field.id?{...c,condition:e.target.value as typeof field.condition}:c)})}>
                    <option value="unknown">{t('newPurchase.unknown')}</option>
                    {conditionSchema.options.map(condition=><option key={condition} value={condition}>{condition}</option>)}
                  </Select>
                </label>
                <label className="new-purchase-field"><span>{t('newPurchase.cost')}</span>
                  <span className="new-purchase-money" dir="ltr">
                    <span aria-hidden>{currencyLabel(field.currency)}</span>
                    <Input className="new-purchase-input" aria-label={t('purchaseDetails.copyCostNumber',{count:index+1})}
                      inputMode="decimal" maxLength={20} placeholder={t('newPurchase.unknown')} value={field.amount}
                      onChange={e => setDraft({...draft,cards:draft.cards.map(c=>c.id===field.id?{...c,amount:e.target.value}:c)})} />
                  </span>
                </label>
              </div>
            </div>
          </li>;
        })}</ul>
      </Card>
    </fieldset>
    {failed && <p role="alert" className="new-purchase-error">{t('newPurchase.failed')} {failed}</p>}
  </form>;
}
