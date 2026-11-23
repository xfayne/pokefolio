import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuHeart } from 'react-icons/lu';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { CatalogSearch } from '@/features/catalog/catalog-search';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { Button } from '@/components/ui/button';
import { catalogCards } from '@/features/catalog/catalog';
import type { CardCopy } from '@/domain/schema';
import type { Binder } from './model';

const catalogIds = new Set(catalogCards.map(card => card.id));

export function eligibleBinderCopies(binder:Binder,copies:readonly CardCopy[],includePlaced=false) {
  const placed=new Set(binder.pockets.flatMap(p=>p.kind==='copy'?[p.copyId]:[]));
  return copies.filter(c=>c.ownerUid===binder.ownerUid && c.disposition==='held' && (c.possession==='received'||c.possession==='pending') && c.catalog.kind==='identified' && (includePlaced || !placed.has(c.id)));
}

/** A Wishlist reservation is a catalog identity, never a fabricated physical copy. */
export function eligibleBinderWishes(binder:Binder,cardIds:readonly string[],includePlaced=false) {
  const placed=new Set(binder.pockets.flatMap(p=>p.kind==='wish'?[p.cardId]:[]));
  return [...new Set(cardIds)].filter(id=>catalogIds.has(id) && (includePlaced || !placed.has(id)));
}
export function BinderPicker({binder,copies,wishCardIds=[],busy,failed,onClose,onPick,onPickWish,moving=false}: {
  moving?:boolean;binder:Binder;copies:readonly CardCopy[];wishCardIds?:readonly string[];
  busy:boolean;failed:boolean;onClose:()=>void;onPick:(copy:CardCopy)=>Promise<void>;
  onPickWish?:(cardId:string)=>Promise<void>;
}) {
  const {t}=useTranslation();const [query,setQuery]=useState('');const [selected,setSelected]=useState<string|null>(null);
  const eligible=eligibleBinderCopies(binder,copies,moving);
  const wishes=new Set(onPickWish ? eligibleBinderWishes(binder,wishCardIds,moving) : []);
  const allowed=new Set([...eligible.flatMap(c=>c.catalog.kind==='identified'?[c.catalog.cardId]:[]),...wishes]);
  const counts:Record<string,number>={};for(const copy of eligible) if(copy.catalog.kind==='identified')counts[copy.catalog.cardId]=(counts[copy.catalog.cardId]??0)+1;
  const choices=eligible.filter(c=>c.catalog.kind==='identified'&&c.catalog.cardId===selected);
  const card=catalogCards.find(c=>c.id===selected);
  return <UtilitySheet title={t(selected?'binderUi.chooseCopy':'binderUi.add')} onClose={busy?()=>{}:onClose} {...(selected&&!busy?{onBack:()=>setSelected(null)}:{})} contentMode="contained">
    {failed && <p role="alert" className="binder-error p-3">{t('binderUi.failed')}</p>}
    {busy?<p role="status" className="p-3">{t('binderUi.saving')}</p>:selected?<div className="space-y-2 overflow-y-auto p-3"><p className="text-sm font-bold">{card?.name}</p>{choices.map((copy,index)=><Button key={copy.id} variant="outline" className="w-full justify-start text-start" onClick={()=>{void onPick(copy);}}><PokemonArt src={card?.imageUrl} alt="" /><span><span className="block">{t('binderUi.copy',{number:index+1})} · {copy.condition.status==='known'?copy.condition.value:t('inventory.unknown')} · {copy.catalog.kind==='identified'?t(`inventory.${copy.catalog.edition}`):''}</span><span className="block text-xs text-slate-600">{t(copy.possession==='pending'?'binderUi.pending':'inventory.received')}</span></span></Button>)}
      {wishes.has(selected) && <Button variant="outline" className="w-full justify-start text-start" onClick={()=>{void onPickWish?.(selected);}}><LuHeart aria-hidden />{t('binderUi.wishes')}</Button>}
    </div>:<CatalogSearch query={query} onQuery={setQuery} allowedCardIds={allowed} owned={counts} wishlist={[...wishes]} onSelect={card=>{
      const matches=eligible.filter(c=>c.catalog.kind==='identified'&&c.catalog.cardId===card.id);
      if(matches.length===1 && !wishes.has(card.id))void onPick(matches[0]!);
      else if(!matches.length && wishes.has(card.id))void onPickWish?.(card.id);
      else setSelected(card.id);
    }} />}
  </UtilitySheet>;
}
