import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { usePortfolio } from '@/hooks/use-portfolio';
import { draftFromPurchase, purchaseCommit } from '@/domain/purchase-commit';
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
  let draft: PurchaseDraft | null = null;
  try {
    draft = draftFromPurchase(account.records, transactionId);
  } catch {
    /* Invalid or unavailable purchase. */
  }
  return draft ? (
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
  // Freeze the revision observed when editing began; query refreshes must not rebase a stale draft.
  const [baseline] = useState(account.records);
  const navigate = useNavigate();
  const prepared = useRef<{ key: string; command: PortfolioCommit } | null>(
    null,
  );
  return (
    <NewPurchaseForm
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
    />
  );
}
