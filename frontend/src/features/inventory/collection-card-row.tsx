import type { ReactNode } from 'react';
import { PokemonArt } from '@/components/ui/pokemon-art';
import type { MarketChange } from './market-change';

export function CollectionCardRow({name,subtitle,imageUrl,detailsLabel,onOpen,metric,action,detail}:{name:string;subtitle:string;imageUrl:string|undefined;detailsLabel:string;onOpen:()=>void;metric:ReactNode;action:ReactNode;detail?:string|undefined}) {
  return <div className="flex items-stretch">
    <button type="button" onClick={onOpen} className="flex min-h-16 min-w-0 flex-1 items-center gap-2 rounded-xl py-1 ps-2 text-start">
      <span className="sr-only">{detailsLabel}: </span><PokemonArt src={imageUrl} alt={name}/>
      <span className="min-w-0 flex-1"><span className={`block ${detail?'truncate':'break-words'} text-base font-bold leading-[1.125rem] tracking-tight text-slate-950`}>{name}</span><span className="mt-0.5 block truncate text-xs leading-[0.875rem] text-slate-600">{subtitle}</span>{detail&&<span className="mt-0.5 block truncate text-[10px] leading-3 text-slate-600" title={detail}>{detail}</span>}</span>
      <span className="ms-1 flex min-h-11 w-24 shrink-0 flex-col justify-center border-s border-blue-200 ps-3">{metric}</span>
    </button>{action}
  </div>;
}
export function MarketChangeMetric({change,format,locale,unavailable,pricedLabel}:{change:MarketChange|undefined;format:(minor:number)=>string;locale:string;unavailable:string;pricedLabel:string}) {
  const gain=change?.gain??null,roi=change?.roi??null;
  const tone=gain===null?'text-slate-600':gain>0?'text-green-800':gain<0?'text-rose-700':'text-slate-950';
  const percent=roi===null?'—':new Intl.NumberFormat(locale,{style:'percent',signDisplay:'exceptZero',maximumFractionDigits:1}).format(roi/100);
  return <span className={`flex flex-col ${tone}`}>
    <bdi className="text-xl font-bold tracking-tight tabular-nums">{gain===null?'—':format(gain)}</bdi>
    <bdi className="text-xs font-medium leading-4">{gain===null?unavailable:percent}{gain!==null&&change&&change.covered<change.total?` · ${change.covered}/${change.total} ${pricedLabel}`:''}</bdi>
  </span>;
}

export function marketChangeDetail(change:MarketChange|undefined,format:(minor:number)=>string,costLabel:string,marketLabel:string) {
  return change&&change.basis!==null&&change.market!==null?`${costLabel} ${format(change.basis)} · ${marketLabel} ${format(change.market)}`:undefined;
}
