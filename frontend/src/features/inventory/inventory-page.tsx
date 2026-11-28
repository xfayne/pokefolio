import { useWishlist } from '@/features/wishlist/use-wishlist';
import { addWish, removeWish } from '@/features/wishlist/model';
import { useDemoTransactionData } from '@/features/transactions/demo-data';
import { useInventoryPrices } from './use-inventory-prices';
import { PortfolioStatus } from '@/features/portfolio-status';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useNavigate } from 'react-router';
import { catalogCards } from '@/features/catalog/catalog';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/surfaces';
import { planCopyMetadataEdit } from '@/domain/inventory';
import type { Revision } from '@/domain/schema';
import { CollectionCards, type SaveCopy } from './collection-cards';
import { createSampleCopies, sampleCatalog, sampleOwner, sampleQuotes } from './sample';

export function InventoryPage() {
  const account = usePortfolio();
  const wish = useWishlist();

  const navigate = useNavigate();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const preview = params.get('inventory') === 'sample';
  const transactionPreview = params.get('transactions') === 'sample';
  const cardCopyId = params.get('cardCopy');
  const navigationProps = {
    initialDeliveryFilter: params.get('delivery') === 'pending' ? 'pending' as const : params.get('delivery') === 'received' ? 'received' as const : 'all' as const,
    inspectCopyId: params.get('copy') ?? undefined,
    cardCopyId,
    onCloseCard: () => {
      if (!cardCopyId) return;
      const next = new URLSearchParams(params);
      next.delete('cardCopy');
      setParams(next, { replace: true, preventScrollReset: true });
    },
  };
  // Explicit sample collection/transactions must not commit real Wishlist changes.
  const wishlistProps = { wishlistIds: wish.wishlist.cardIds, wishlistBusy: wish.busy, onToggleWishlist: wish.owner && !preview && !transactionPreview && !wish.loading && !wish.error ? async (id: string) => { await wish.update(ids => ids.includes(id) ? removeWish(ids,id) : addWish(ids,id)); } : undefined };
  const demo = useDemoTransactionData();
  const prices=useInventoryPrices(account.history.copies,!preview && !transactionPreview && !!account.owner);
  const [state, setState] = useState(() => ({ copies: createSampleCopies(), audits: [] as Revision[] }));
  const save: SaveCopy = async (before, patch) => {
    const current = state.copies.find(c => c.id === before.id);
    if (!preview || current?.revision !== before.revision) throw Error('Stale or unavailable inventory');
    const plan = planCopyMetadataEdit(sampleOwner, current, patch, new Date().toISOString(), `sample-${crypto.randomUUID()}`, 'Sample copy metadata edit');
    if (plan) setState(previous => ({ copies: previous.copies.map(c => c.id === before.id ? plan.change.after : c), audits: [...previous.audits, plan.audit] }));
  };
  if (transactionPreview) return <CollectionCards {...wishlistProps} {...navigationProps} data={{ownerUid:demo.history.ownerUid,copies:demo.history.copies,catalog:catalogCards,quotes:[],currency:'USD'}} onViewPurchase={id => { void navigate(`/transactions/purchases/${id}?transactions=sample`); }} />;
  if (!preview && (account.loading || account.error)) return <PortfolioStatus loading={account.loading} error={account.error} />;
  if (!preview && account.owner) return <>{prices.failed && <Button variant="outline" onClick={prices.retry}>{t('reload')}</Button>}<CollectionCards {...wishlistProps} {...navigationProps} pricesLoading={prices.loading} data={{ownerUid:account.owner,copies:account.history.copies,catalog:catalogCards,quotes:prices.quotes,currency:'USD'}} onViewPurchase={id => { void navigate(`/transactions/purchases/${id}`); }} onSave={async (copy, patch) => {
    const plan = planCopyMetadataEdit(account.owner!, copy, patch, new Date().toISOString(), `audit-${crypto.randomUUID()}`, 'Copy metadata edited');
    if (plan) await account.save({ownerUid:account.owner!,idempotencyKey:plan.audit.id,creates:[{collection:'revisions',record:plan.audit}],updates:[{before:{collection:'copies',record:plan.change.before},after:{collection:'copies',record:plan.change.after}}]});
  }} /></>;
  if (!preview) return <EmptyState title={t('inventory.disconnected')} description={t('inventory.connectionDetail')} action={<Button onClick={() => { const next = new URLSearchParams(params); next.set('inventory', 'sample'); setParams(next); }}>{t('inventory.explore')}</Button>} />;
  return <CollectionCards {...wishlistProps} {...navigationProps} data={{ ownerUid: sampleOwner, copies: state.copies, catalog: sampleCatalog, quotes: sampleQuotes, currency: 'USD' }} onSave={save} />;
}
