import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CatalogSearch } from '@/features/catalog/catalog-search';
import { initialCatalogSearch } from '@/features/catalog/search-state';
import { purchaseCatalogReference, catalogCards } from '@/features/catalog/catalog';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { usePortfolio } from '@/hooks/use-portfolio';
import { draftFromPurchase, purchaseCommit } from '@/domain/purchase-commit';
import { importedPurchaseFormCommit, importedPurchaseFormSeed } from '@/domain/imported-purchase-form';
import type { PortfolioCommit } from '@/domain/persistence';
import type { PurchaseDraft } from '@/domain/purchase-draft';
import { NewPurchaseForm } from './new-purchase-form';
import { EmptyState, LoadingState } from '@/components/ui/surfaces';

export function EditPurchasePage() {
  const account = usePortfolio();
  const { transactionId = '' } = useParams();
  const { t } = useTranslation();
  if (account.loading) return <LoadingState label={t('loading')} />;
  const purchase = account.records.find(entry =>
    entry.collection === 'transactions' && entry.record.id === transactionId &&
    entry.record.kind === 'purchase');
  const imported = purchase?.collection === 'transactions' && 'origin' in purchase.record;
  const copies = account.records.filter(entry =>
    entry.collection === 'copies' && !entry.record.removedFromImport && !entry.record.removedFromPurchase &&
    entry.record.acquisition.kind === 'purchase' && entry.record.acquisition.transactionId === transactionId);
  let initial: PurchaseDraft | null = null;
  let currencyChosen = true;
  try {
    if (imported) {
      const seed = importedPurchaseFormSeed(account.records,transactionId);
      initial = seed.draft;
      currencyChosen = seed.currencyChosen;
    } else initial = draftFromPurchase(account.records,transactionId);
  } catch { /* Unavailable or inconsistent purchase */ }
  const editable = imported
    ? copies.every(entry => entry.collection === 'copies' && entry.record.disposition === 'held')
    : copies.length > 0 && copies.every(entry =>
      entry.collection === 'copies' && entry.record.possession === 'pending' && entry.record.disposition === 'held');
  return initial && editable
    ? <Editor key={account.owner+'-'+transactionId} initial={initial} imported={imported}
        initialCurrencyChosen={currencyChosen} account={account} />
    : <EmptyState title={t('purchaseDetails.notFound')} description={t('purchaseDetails.notFoundDetail')} />;
}

/** Identical form/picker for normal and imported purchases; only their save adapters differ. */
function Editor({initial,imported,initialCurrencyChosen,account}: {
  initial: PurchaseDraft;
  imported: boolean;
  initialCurrencyChosen: boolean;
  account: ReturnType<typeof usePortfolio>;
}) {
  const [draft,setDraft] = useState(initial);
  const [currencyChosen,setCurrencyChosen] = useState(initialCurrencyChosen);
  const [picking,setPicking] = useState(false);
  const [query,setQuery] = useState('');
  const [catalogUi,setCatalogUi] = useState(initialCatalogSearch);
  const {t} = useTranslation();
  const [baseline] = useState(account.records);
  const navigate = useNavigate();
  const prepared = useRef<{key:string;command:PortfolioCommit|null}|null>(null);
  return <>
    <NewPurchaseForm
      editing draft={draft} catalog={catalogCards} onChange={setDraft}
      onAddCard={() => setPicking(true)}
      currencyChosen={currencyChosen}
      {...(imported ? {onCurrencyChosen:() => setCurrencyChosen(true)} : {})}
      onSave={async () => {
        const key = JSON.stringify({draft,currencyChosen});
        if (prepared.current?.key !== key) prepared.current = {
          key,
          command:imported
            ? importedPurchaseFormCommit(account.owner!,draft,new Date().toISOString(),baseline,currencyChosen)
            : purchaseCommit(account.owner!,draft,new Date().toISOString(),baseline),
        };
        if (prepared.current.command) await account.save(prepared.current.command);
        await navigate('/transactions/purchases/'+draft.id,{replace:true});
      }}
    />
    {picking && <UtilitySheet title={t('searchCards')} onClose={() => setPicking(false)} contentMode="contained">
      <CatalogSearch state={catalogUi} onState={setCatalogUi} query={query} onQuery={setQuery}
        onSelect={card => {
          setDraft(current => ({
            ...current,
            cards:[...current.cards,{id:'copy-'+crypto.randomUUID(),catalog:purchaseCatalogReference(card.id),condition:'unknown',amount:''}],
          }));
          setPicking(false);
        }} />
    </UtilitySheet>}
  </>;
}
