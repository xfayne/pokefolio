import { createPurchaseDraft } from '@/features/transactions/purchase-draft-seed';
import { currencySchema, type CatalogRef } from '@/domain/schema';
import type { PurchaseDraft } from '@/domain/purchase-draft';
import type { DealItem } from './scan';

/** A listing is evidence of an offer, not payment. Keep uncertain amounts blank. */
export function createListingDraft(item:DealItem, catalog:CatalogRef):PurchaseDraft{
 const base=createPurchaseDraft(false);
 const currency=currencySchema.safeParse(item.currentBid.currency);
 const knownShipping=!!item.shipping&&currency.success&&item.shipping.currency===currency.data;
 const knownPrice=currency.success&&knownShipping&&item.format==='FIXED_PRICE'&&item.verificationStatus==='strong'&&!item.bestOffer;
 return {...base,source:'ebay',seller:item.sellerName,currency:currency.success?currency.data:'USD',listingUrl:item.url,itemReference:item.itemId,
  shipping:knownShipping?item.shipping!.value.toFixed(2):'',cards:[{id:'copy-'+crypto.randomUUID(),catalog,condition:'unknown',amount:knownPrice?item.currentBid.value.toFixed(2):''}]};
}
