import { CatalogSearch } from '@/features/catalog/catalog-search';
import { catalogCards, catalogReference } from '@/features/catalog/catalog';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { preparePurchaseDraft, type PreparedPurchaseDraft } from '@/domain/purchase-draft';
import { useUIStore } from '@/state/ui';
import { demoTransactionOwner, useDemoPortfolio } from './demo-context';
import { NewPurchaseForm } from './new-purchase-form';
import { createPurchaseDraft } from './purchase-draft-seed';


export function NewPurchasePage() {
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const preview = params.get('transactions') === 'sample';
  const mode = preview ? 'sample' : 'account';
  const stored = useUIStore(s => s.purchaseDrafts[mode]);
  const setDraft = useUIStore(s => s.setPurchaseDraft);
  const [initial] = useState(() => createPurchaseDraft(preview));
  const draft = stored ?? initial;
  const demo = useDemoPortfolio();
  const navigate = useNavigate();
  const prepared = useRef<{ key: string; value: PreparedPurchaseDraft } | null>(null);
  useEffect(() => { document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, []);
  useEffect(() => { if (!stored) setDraft(mode, initial); }, [stored, setDraft, mode, initial]);
  async function save() {
    if (!preview) throw Error('Account adapter unavailable');
    const key = JSON.stringify(draft);
    if (prepared.current?.key !== key) prepared.current = { key, value: preparePurchaseDraft(demoTransactionOwner, draft, new Date().toISOString()) };
    await demo.save(prepared.current.value);
    setDraft(mode, createPurchaseDraft(preview));
    await navigate({ pathname: `/transactions/purchases/${draft.id}`, search: params.toString() }, { replace: true, state: { demoSaved: true } });
  }
  return <><NewPurchaseForm key={mode} draft={draft} catalog={catalogCards} onAddCard={() => setPicking(true)} onChange={next => setDraft(mode, next)} {...(preview ? { onSave: save } : {})} />{picking && <UtilitySheet title={t('searchCards')} onClose={() => setPicking(false)}><CatalogSearch query={query} onQuery={setQuery} onSelect={card => { setDraft(mode, { ...draft, cards: [...draft.cards, { id: `demo-copy-${crypto.randomUUID()}`, catalog: catalogReference(card.id), condition: 'unknown', amount: '' }] }); setPicking(false); }} /></UtilitySheet>}</>;
}
