import { usePortfolio } from '@/hooks/use-portfolio';
import { purchaseCommit } from '@/domain/purchase-commit';
import { initialCatalogSearch } from '@/features/catalog/search-state';
import { useDemoTransactionData } from './demo-data';
import { CatalogSearch } from '@/features/catalog/catalog-search';
import { catalogCards, purchaseCatalogReference } from '@/features/catalog/catalog';
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
  const [catalogUi, setCatalogUi] = useState(initialCatalogSearch);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const preview = params.get('transactions') === 'sample';
  const account = usePortfolio();
  const mode = preview ? 'sample' : `account-${account.owner ?? 'signed-out'}`;
  const stored = useUIStore(s => s.purchaseDrafts[mode]);
  const setDraft = useUIStore(s => s.setPurchaseDraft);
  const [initial] = useState(() => createPurchaseDraft(preview));
  const draft = stored ?? initial;
  const demo = useDemoPortfolio();
  const data = useDemoTransactionData();
  const owned: Record<string, number> = {};
  for (const copy of (preview ? data.history.copies : account.history.copies)) { if (copy.catalog.kind === 'identified' && copy.disposition === 'held' && copy.possession === 'received') owned[copy.catalog.cardId] = (owned[copy.catalog.cardId] ?? 0) + 1; }
  const navigate = useNavigate();
  const accountPrepared = useRef<{key:string;command:ReturnType<typeof purchaseCommit>} | null>(null);
  const prepared = useRef<{ key: string; value: PreparedPurchaseDraft } | null>(null);
  useEffect(() => { document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, []);

  useEffect(() => { if (!stored) setDraft(mode, initial); }, [stored,setDraft,mode,initial]);
  async function save() {
    if (!preview) {
      if (!account.owner) throw Error('Sign in before saving');
      const key=JSON.stringify(draft);
      if (accountPrepared.current?.key!==key) accountPrepared.current={key,command:purchaseCommit(account.owner,draft,new Date().toISOString())};
      await account.save(accountPrepared.current.command);
      setDraft(mode, createPurchaseDraft(false));
      await navigate(`/transactions/purchases/${draft.id}`, {replace:true});
      return;
    }
    const key = JSON.stringify(draft);
    if (prepared.current?.key !== key) prepared.current = { key, value: preparePurchaseDraft(demoTransactionOwner, draft, new Date().toISOString()) };
    await demo.save(prepared.current.value);
    setDraft(mode, createPurchaseDraft(preview));
    await navigate({ pathname: `/transactions/purchases/${draft.id}`, search: params.toString() }, { replace: true, state: { demoSaved: true } });
  }
  return <><NewPurchaseForm key={mode} draft={draft} catalog={catalogCards} onAddCard={() => setPicking(true)} onChange={next => setDraft(mode, next)} {...((preview || account.owner) ? { onSave: save } : {})} />{picking && <UtilitySheet title={t('searchCards')} onClose={() => setPicking(false)} contentMode="contained"><CatalogSearch state={catalogUi} onState={setCatalogUi} owned={owned} query={query} onQuery={setQuery} onSelect={card => { setDraft(mode, { ...draft, cards: [...draft.cards, { id: `${preview ? 'demo-copy' : 'copy'}-${crypto.randomUUID()}`, catalog: purchaseCatalogReference(card.id), condition: 'unknown', amount: '' }] }); setPicking(false); }} /></UtilitySheet>}</>;
}
