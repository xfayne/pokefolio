import { CatalogSearch } from '@/features/catalog/catalog-search';
import { initialCatalogSearch } from '@/features/catalog/search-state';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { purchaseCatalogReference } from '@/features/catalog/catalog';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { usePortfolio } from '@/hooks/use-portfolio';
import { draftFromPurchase, purchaseCommit } from '@/domain/purchase-commit';
import { importedPurchaseEditCommit, importedPurchaseEditDraft } from '@/domain/imported-purchase-edit';
import type { ImportedPurchaseEditDraft } from '@/domain/imported-purchase-edit';
import { ImportedPurchaseEditForm } from './imported-purchase-edit-form';
import type { PortfolioCommit } from '@/domain/persistence';
import type { PurchaseDraft } from '@/domain/purchase-draft';
import { NewPurchaseForm } from './new-purchase-form';
import { catalogCards } from '@/features/catalog/catalog';
import { EmptyState, LoadingState } from '@/components/ui/surfaces';
export function EditPurchasePage() {
  const account = usePortfolio();
  const { transactionId = '' } = useParams();
  const { t } = useTranslation();
  if (account.loading) return <LoadingState label={t('loading')} />;
  const imported = account.records.find(e => e.collection === 'transactions' && e.record.id === transactionId && e.record.kind === 'purchase' && 'origin' in e.record);
  const copies = account.records.filter(e => e.collection === 'copies' && e.record.acquisition.kind === 'purchase' && e.record.acquisition.transactionId === transactionId);
  if (imported) {
    let initial: ImportedPurchaseEditDraft | null = null;
    try { initial = importedPurchaseEditDraft(account.records, transactionId); } catch { /* incomplete import relationship */ }
    return initial && copies.filter(e => e.collection === 'copies' && !e.record.removedFromImport).every(e => e.collection === 'copies' && e.record.disposition === 'held')
      ? <ImportedEditor key={account.owner + '-' + transactionId} initial={initial} account={account} />
      : <EmptyState title={t('purchaseDetails.notFound')} description={t('purchaseDetails.notFoundDetail')} />;
  }
  let draft: PurchaseDraft | null = null;
  try {
    draft = draftFromPurchase(account.records, transactionId);
  } catch {
    /* Invalid or unavailable purchase. */
  }
  const editable = copies.length > 0 && copies.every(e => e.collection === 'copies' && e.record.possession === 'pending' && e.record.disposition === 'held');
  return draft && editable ? (
    <Editor key={`${account.owner}-${transactionId}`} initial={draft} account={account} />
  ) : (
    <EmptyState
      title={t('purchaseDetails.notFound')}
      description={t('purchaseDetails.notFoundDetail')}
    />
  );
}
function Editor({
  initial,
  account,
}: {
  initial: PurchaseDraft;
  account: ReturnType<typeof usePortfolio>;
}) {
  const [draft, setDraft] = useState(initial);
  const [picking,setPicking] = useState(false);
  const [query,setQuery] = useState('');
  const [catalogUi,setCatalogUi] = useState(initialCatalogSearch);
  const {t} = useTranslation();
  // Freeze the revision observed when editing began; query refreshes must not rebase a stale draft.
  const [baseline] = useState(account.records);
  const navigate = useNavigate();
  const prepared = useRef<{ key: string; command: PortfolioCommit } | null>(
    null,
  );
  return (
    <><NewPurchaseForm
      onAddCard={() => setPicking(true)}
      editing
      draft={draft}
      catalog={catalogCards}
      onChange={setDraft}
      onSave={async () => {
        const key = JSON.stringify(draft);
        if (prepared.current?.key !== key)
          prepared.current = {
            key,
            command: purchaseCommit(
              account.owner!,
              draft,
              new Date().toISOString(),
              baseline,
            ),
          };
        await account.save(prepared.current.command);
        await navigate(`/transactions/purchases/${draft.id}`, {
          replace: true,
        });
      }}
    />{picking && <UtilitySheet title={t('searchCards')} onClose={() => setPicking(false)} contentMode="contained"><CatalogSearch state={catalogUi} onState={setCatalogUi} query={query} onQuery={setQuery} onSelect={card => {setDraft({...draft,cards:[...draft.cards,{id:`copy-${crypto.randomUUID()}`,catalog:purchaseCatalogReference(card.id),condition:'unknown',amount:''}]});setPicking(false);}} /></UtilitySheet>}</>
  );
}

function ImportedEditor({ initial, account }: { initial: ImportedPurchaseEditDraft; account: ReturnType<typeof usePortfolio> }) {
  // Hold the exact opening version, including each copy's acquiredOn date.
  const [baseline] = useState(account.records);
  const navigate = useNavigate();
  const prepared = useRef<{ key: string; command: PortfolioCommit | null } | null>(null);
  const copies = baseline.flatMap(entry => entry.collection === 'copies' && !entry.record.removedFromImport && entry.record.acquisition.kind === 'purchase' && entry.record.acquisition.transactionId === initial.id ? [entry.record] : []);
  const [picking,setPicking] = useState(false);
  const [query,setQuery] = useState('');
  const [catalogUi,setCatalogUi] = useState(initialCatalogSearch);
  const pendingAddition = useRef<{draft:ImportedPurchaseEditDraft;setDraft:(draft:ImportedPurchaseEditDraft)=>void}|null>(null);
  const {t} = useTranslation();
  return <><ImportedPurchaseEditForm initial={initial} copies={copies} catalog={catalogCards}
    onAddCard={(draft,setDraft)=>{pendingAddition.current={draft,setDraft};setPicking(true);}}
    onSave={async draft => {
    const key = JSON.stringify(draft);
    if (prepared.current?.key !== key) prepared.current = {
      key,
      command: importedPurchaseEditCommit(account.owner!, draft, new Date().toISOString(), baseline),
    };
    if (prepared.current.command) await account.save(prepared.current.command);
    await navigate('/transactions/purchases/' + draft.id, { replace: true });
  }} />{picking && <UtilitySheet title={t('searchCards')} onClose={()=>setPicking(false)} contentMode="contained">
    <CatalogSearch query={query} onQuery={setQuery} state={catalogUi} onState={setCatalogUi} onSelect={card=>{
      const pending = pendingAddition.current;
      if (pending) pending.setDraft({...pending.draft,cards:[...pending.draft.cards,{
        id:'copy-'+crypto.randomUUID(),catalog:purchaseCatalogReference(card.id),
        condition:'unknown',amount:'',currency:pending.draft.cards[0]?.currency ?? 'USD',
      }]});
      setPicking(false);
    }} />
  </UtilitySheet>}</>;
}
