import type { CardCopy } from '@/domain/schema';
import { catalogCards } from '@/features/catalog/catalog';
import type { VisualPocket } from './binder-book';
import { pocketKey, type Binder } from './model';

const cards=new Map(catalogCards.map(c=>[c.id,c]));
/** Unknown Wishlist membership (loading/error) is not evidence of removal. */
export function visualPockets(binder:Binder,copies:readonly CardCopy[],wishlistIds:readonly string[] | null): VisualPocket[] {
  const byId=new Map(copies.filter(c=>c.ownerUid===binder.ownerUid).map(c=>[c.id,c]));
  const wishes=wishlistIds===null?null:new Set(wishlistIds);
  return binder.pockets.map(p=>{
    if(p.kind==='empty') return {key:pocketKey(p),kind:'empty',card:null};
    if(p.kind==='wish') {
      const card=cards.get(p.cardId) ?? null;
      return wishes!==null && !wishes.has(p.cardId)
        ? {key:pocketKey(p),kind:'unavailable',card,wishUnavailable:true}
        : {key:pocketKey(p),kind:'wish',card};
    }
    const copy=byId.get(p.copyId);
    return {key:pocketKey(p),card:copy?.catalog.kind==='identified'?cards.get(copy.catalog.cardId) ?? null:null,
      kind:!copy || copy.disposition!=='held'?'unavailable':copy.possession==='received'?'owned':copy.possession==='pending'?'pending':'unknown'};
  });
}
