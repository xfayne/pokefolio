import { publicPriceClient } from '@/services/public-price-client';
import { promoProducts } from './promo-products';
import { z } from 'zod';
import type { InventoryCatalogCard, CopyQuote } from '@/domain/inventory';
import type { CatalogRef } from '@/domain/schema';
const BASE = 'https://openapi.tcgtracking.com/v1/3';
const overrides: Record<string, {set: string; product: number}> = { 'basep-3': {set:'WoTC Promo',product:87414}, 'basep-5':{set:'WoTC Promo',product:84909}, 'movie2000-ancient-mew':{set:'Miscellaneous Cards & Products',product:108589}, 'base1-8':{set:'Deck Exclusives',product:42425} };
const key = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/♀/g,'f').replace(/♂/g,'m').replace(/[^a-z0-9]/g,'');
const setsSchema = z.object({sets:z.array(z.object({id:z.number().int().positive(),name:z.string()}))});
const cardsSchema = z.object({products:z.array(z.object({id:z.number(),name:z.string(),number:z.union([z.string(),z.number()]).nullish()}))});
const skusSchema = z.object({updated:z.string().optional(),products:z.record(z.string(),z.record(z.string(),z.object({lng:z.string(),cnd:z.string(),var:z.string().optional(),var_a:z.string().optional(),mkt:z.number().finite().nonnegative().nullable().optional()})))});
async function json(path: string, signal: AbortSignal) {
 const value = await publicPriceClient.fetchQuery({queryKey:['tcg-source',path],queryFn:async({signal:sharedSignal})=>{
  const response=await fetch(`${BASE}${path}`,{signal:AbortSignal.any([sharedSignal,AbortSignal.timeout(13000)]),credentials:'omit'});
  if(!response.ok) throw Error('Price provider unavailable');
  return response.json() as Promise<unknown>;
 }});
 // An individual printing must not cancel a shared set request used by other copies.
 signal.throwIfAborted(); return value;
}

export async function fetchMarketQuotes(card: InventoryCatalogCard, catalog: CatalogRef, signal: AbortSignal): Promise<CopyQuote[]> {
 if (catalog.kind !== 'identified' || catalog.edition === 'unknown' || catalog.finish.status !== 'known') return [];
 const promo = card.id.startsWith('basep-') ? promoProducts[Number(card.id.slice(6))] : undefined;
 const special = promo ? {set:'WoTC Promo',product:promo.product} : overrides[card.id];
 const wanted = special?.set ?? (card.setName === 'Wizards Black Star Promos' ? 'WoTC Promo' : card.setName);
 const groups = setsSchema.parse(await json('/sets',signal));
 const group = groups.sets.find(g => key(g.name) === key(wanted));
 if (!group) return [];
 const [rawCards, rawSkus] = await Promise.all([json(`/sets/${group.id}/cards`,signal),json(`/sets/${group.id}/skus`,signal)]);
 const products = cardsSchema.parse(rawCards).products;
 const matches = products.filter(p => special ? p.id === special.product : String(p.number).replace(/^0+/,'').split('/')[0] === card.number.split('/')[0] && key(p.name.replace(/\s*\(\d{1,3}\)\s*$/,'')) === key(card.name));
 if (matches.length !== 1) return [];
 const skus = skusSchema.parse(rawSkus); const rows = Object.values(skus.products[String(matches[0]!.id)] ?? {});
 const isFirst = catalog.edition === 'first-edition';
 const finish = catalog.finish.value;
 const accepted = rows.filter(row => { const variant = (row.var ?? row.var_a ?? '').toLowerCase(); return row.lng === 'EN' && /1st|first edition/.test(variant) === isFirst && (finish === 'holo' || finish === 'shining' ? /holo/.test(variant) && !/reverse/.test(variant) : finish === 'reverse' ? /reverse/.test(variant) : !/holo|foil/.test(variant)); });
 const observedAt = skus.updated && Number.isFinite(Date.parse(skus.updated)) ? new Date(skus.updated).toISOString() : new Date().toISOString();
 return accepted.flatMap(row => ['NM','LP','MP','HP','DMG'].includes(row.cnd) && typeof row.mkt === 'number' && Number.isSafeInteger(Math.round(row.mkt * 100)) ? [{catalog,condition:(row.cnd === 'DMG' ? 'DAMAGED' : row.cnd) as CopyQuote['condition'],money:{currency:'USD' as const,minor:Math.round(row.mkt*100)},observedAt,source:'TCGTracking / TCGplayer'}] : []);
}
