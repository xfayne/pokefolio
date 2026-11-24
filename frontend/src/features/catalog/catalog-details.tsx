import { useWishlist } from '@/features/wishlist/use-wishlist';
import { addWish, removeWish } from '@/features/wishlist/model';
import { useDisplayMoney } from '@/services/display-currency';
import { useTranslation } from 'react-i18next';
import { CardDetailsSheet, type SaveCopy } from '@/features/inventory/collection-cards';
import { bestCopy } from '@/features/inventory/copy-condition';
import { useInventoryPrices } from '@/features/inventory/use-inventory-prices';
import { planCopyMetadataEdit, selectInventory, type CopyView, type InventoryCatalogCard, type InventoryGroup } from '@/domain/inventory';
import type { usePortfolio } from '@/hooks/use-portfolio';
import { catalogMarketReference } from './catalog';

export function CatalogDetails({card,onClose,allowWishlist=true,portfolio,onViewPurchase}: {
  card: InventoryCatalogCard;
  onClose: () => void;
  allowWishlist?: boolean;
  portfolio?: ReturnType<typeof usePortfolio> | undefined;
  onViewPurchase?: ((id: string) => void) | undefined;
}) {
  const {t} = useTranslation();
  const money = useDisplayMoney();
  const wish = useWishlist();
  const owner = portfolio?.owner;
  const copies = owner && portfolio ? portfolio.history.copies.filter(copy =>
    copy.catalog.kind === 'identified' && copy.catalog.cardId === card.id && copy.disposition === 'held') : [];
  const prices = useInventoryPrices(copies, !!owner);
  const group: InventoryGroup = (owner ? selectInventory(owner, copies, [card], prices.quotes, 'USD').groups[0] : undefined) ??
    {key:card.id,card,copies:[],receivedCount:0,pendingCount:0,unknownPossessionCount:0,market:{currency:'USD',minor:0,pricedCount:0,missingCount:0}};
  const catalog = (bestCopy(group.copies)?.copy ?? group.copies[0]?.copy)?.catalog ?? catalogMarketReference(card.id);
  const cost = (v: CopyView['paid']) => v.status === 'exact' ? money(v.value) : v.status === 'estimated' ? `${money(v.value)} · ${t('inventory.estimated')}` : t(`inventory.${v.status === 'unallocated' ? 'unallocated' : 'unavailable'}`);
  const metric = (v: CopyView['market']) => v.status === 'unavailable' ? t(prices.loading ? 'loading' : 'inventory.unpriced') : money(v);
  const onSave: SaveCopy | undefined = owner && portfolio && !portfolio.loading && !portfolio.error ? async (copy, patch) => {
    const plan = planCopyMetadataEdit(owner, copy, patch, new Date().toISOString(), `audit-${crypto.randomUUID()}`, 'Copy metadata edited');
    if (plan) await portfolio.save({ownerUid:owner,idempotencyKey:plan.audit.id,creates:[{collection:'revisions',record:plan.audit}],updates:[{before:{collection:'copies',record:plan.change.before},after:{collection:'copies',record:plan.change.after}}]});
  } : undefined;
  return <CardDetailsSheet livePrices transition="subtle" group={group} catalog={catalog} quotes={prices.quotes} currency="USD" initialCopy={null} onClose={onClose} onSave={onSave} onViewPurchase={owner ? onViewPurchase : undefined} wishlistIds={wish.wishlist.cardIds} wishlistBusy={wish.busy} onToggleWishlist={allowWishlist && wish.owner && !wish.loading && !wish.error ? async id => { await wish.update(ids => ids.includes(id) ? removeWish(ids,id) : addWish(ids,id)); } : undefined} money={money} cost={cost} metric={metric} />;
}
