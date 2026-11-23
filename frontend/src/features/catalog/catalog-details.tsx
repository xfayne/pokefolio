import { useWishlist } from '@/features/wishlist/use-wishlist';
import { addWish, removeWish } from '@/features/wishlist/model';
import {useDisplayMoney} from '@/services/display-currency';
import { useTranslation } from 'react-i18next';
import { CardDetailsSheet } from '@/features/inventory/collection-cards';
import type { InventoryCatalogCard } from '@/domain/inventory';
import { catalogMarketReference } from './catalog';
export function CatalogDetails({card,onClose}: {card:InventoryCatalogCard; onClose:()=>void}) {
 const {t} = useTranslation(); const money=useDisplayMoney(); const wish=useWishlist(); const catalog = catalogMarketReference(card.id);
 return <CardDetailsSheet livePrices transition="subtle" group={{key:card.id,card,copies:[],receivedCount:0,pendingCount:0,unknownPossessionCount:0,market:{currency:'USD',minor:0,pricedCount:0,missingCount:0}}} catalog={catalog} quotes={[]} currency="USD" initialCopy={null} onClose={onClose} wishlistIds={wish.wishlist.cardIds} wishlistBusy={wish.busy} onToggleWishlist={wish.owner && !wish.loading && !wish.error ? async id => { await wish.update(ids => ids.includes(id) ? removeWish(ids,id) : addWish(ids,id)); } : undefined} money={money} cost={()=>t('inventory.unavailable')} metric={()=>t('inventory.unavailable')} />;
}
