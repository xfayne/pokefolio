import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CardDetailsSheet } from '@/features/inventory/collection-cards';
import type { InventoryCatalogCard } from '@/domain/inventory';
import { catalogMarketReference } from './catalog';
import { fetchMarketQuotes } from './market-prices';
export function CatalogDetails({card,onClose}: {card:InventoryCatalogCard; onClose:()=>void}) {
 const {t,i18n} = useTranslation(); const catalog = catalogMarketReference(card.id);
 const query = useQuery({queryKey:['catalog-market',card.id,catalog], queryFn:({signal})=>fetchMarketQuotes(card,catalog,signal),staleTime:15*60_000,retry:1});
 return <CardDetailsSheet transition="subtle" group={{key:card.id,card,copies:[],receivedCount:0,pendingCount:0,unknownPossessionCount:0,market:{currency:'USD',minor:0,pricedCount:0,missingCount:0}}} catalog={catalog} quotes={query.data ?? []} priceStatus={query.isPending ? t('loading') : query.isError ? (i18n.language === 'he' ? 'טעינת המחיר נכשלה' : 'Price unavailable. Try again.') : undefined} onRetryPrice={query.isError ? () => { void query.refetch(); } : undefined} currency="USD" initialCopy={null} onClose={onClose} money={m=>new Intl.NumberFormat(i18n.language,{style:'currency',currency:m.currency}).format(m.minor/100)} cost={()=>t('inventory.unavailable')} metric={()=>t('inventory.unavailable')} />;
}
