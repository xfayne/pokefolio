import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { CatalogSearch } from '@/features/catalog/catalog-search';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { Button } from '@/components/ui/button';
import { catalogCards } from '@/features/catalog/catalog';
import type { CardCopy } from '@/domain/schema';
import type { Binder } from './model';

export function eligibleBinderCopies(binder:Binder,copies:readonly CardCopy[],includePlaced=false) {
  const placed=new Set(binder.pockets.flatMap(p=>p.kind==='copy'?[p.copyId]:[]));
  return copies.filter(c=>c.ownerUid===binder.ownerUid && c.disposition==='held' && (c.possession==='received'||c.possession==='pending') && c.catalog.kind==='identified' && (includePlaced || !placed.has(c.id)));
}
export function BinderPicker({binder,copies,busy,failed,onClose,onPick,moving=false}: {moving?:boolean;binder:Binder;copies:readonly CardCopy[];busy:boolean;failed:boolean;onClose:()=>void;onPick:(copy:CardCopy)=>Promise<void>}) {
  const {t}=useTranslation();const [query,setQuery]=useState('');const [selected,setSelected]=useState<string|null>(null);
  const eligible=eligibleBinderCopies(binder,copies,moving);
  const allowed=new Set(eligible.flatMap(c=>c.catalog.kind==='identified'?[c.catalog.cardId]:[]));
  const counts:Record<string,number>={};for(const copy of eligible) if(copy.catalog.kind==='identified')counts[copy.catalog.cardId]=(counts[copy.catalog.cardId]??0)+1;
  const choices=eligible.filter(c=>c.catalog.kind==='identified'&&c.catalog.cardId===selected);
  const card=catalogCards.find(c=>c.id===selected);
  return <UtilitySheet title={t(selected?'binderUi.chooseCopy':'binderUi.add')} onClose={busy?()=>{}:onClose} {...(selected&&!busy?{onBack:()=>setSelected(null)}:{})} contentMode="contained">
    {failed && <p role="alert" className="binder-error p-3">{t('binderUi.failed')}</p>}
    {busy?<p role="status" className="p-3">{t('binderUi.saving')}</p>:selected?<div className="space-y-2 overflow-y-auto p-3"><p className="text-sm font-bold">{card?.name}</p>{choices.map((copy,index)=><Button key={copy.id} variant="outline" className="w-full justify-start text-start" onClick={()=>{void onPick(copy);}}><PokemonArt src={card?.imageUrl} alt="" /><span><span className="block">{t('binderUi.copy',{number:index+1})} · {copy.condition.status==='known'?copy.condition.value:t('inventory.unknown')} · {copy.catalog.kind==='identified'?t(`inventory.${copy.catalog.edition}`):''}</span><span className="block text-xs text-slate-600">{t(copy.possession==='pending'?'binderUi.pending':'inventory.received')}</span></span></Button>)}</div>:<CatalogSearch query={query} onQuery={setQuery} allowedCardIds={allowed} owned={counts} onSelect={card=>{const matches=eligible.filter(c=>c.catalog.kind==='identified'&&c.catalog.cardId===card.id);if(matches.length===1)void onPick(matches[0]!);else if(matches.length>1)setSelected(card.id);}} />}
  </UtilitySheet>;
}
