import type { CopyView } from '@/domain/inventory';
import { safeInteger } from '@/domain/money';
import { acquisitionBasis, referenceConverter } from '@/domain/performance';
import type { Currency, Money } from '@/domain/schema';

export type CopyComparison = { market:number|null; basis:number|null; gain:number|null; roi:number|null };
export type MarketChange = CopyComparison & { covered:number; total:number };

export function compareCopyToMarket(view:CopyView,currency:Currency,historical:ReturnType<typeof referenceConverter>,convert:(money:Money)=>number|null):CopyComparison {
  const copy=view.copy;
  const english=copy.catalog.kind==='identified' && copy.catalog.language.status==='known' && ['en','english'].includes(copy.catalog.language.value.toLowerCase());
  const eligible=copy.possession==='received'||copy.possession==='pending';
  const market=eligible&&english&&view.market.status!=='unavailable'?convert(view.market):null;
  const basis=acquisitionBasis([copy.cardCost,copy.shippingCost,copy.taxCost,copy.feeCost],copy.acquiredOn.status==='known'?copy.acquiredOn.value:null,currency,historical);
  const amount=basis.status==='unavailable'?null:basis.minor;
  const gain=market!==null&&amount!==null?safeInteger(BigInt(market)-BigInt(amount)):null;
  return {market,basis:amount,gain,roi:gain!==null&&amount!==null&&amount>0?gain/amount*100:null};
}

/** Aggregate only matched cost/market pairs. Coverage prevents partial groups from appearing complete. */
export function summarizeMarketChange(comparisons:readonly CopyComparison[]):MarketChange {
  const known=comparisons.filter(row=>row.gain!==null&&row.basis!==null&&row.market!==null);
  const sum=(key:'market'|'basis'|'gain')=>known.length?safeInteger(known.reduce((total,row)=>total+BigInt(row[key]!),0n)):null;
  const market=sum('market'),basis=sum('basis'),gain=sum('gain');
  return {market,basis,gain,roi:gain!==null&&basis!==null&&basis>0?gain/basis*100:null,covered:known.length,total:comparisons.length};
}

export function compareMarketChanges(a:MarketChange|undefined,b:MarketChange|undefined,ascending:boolean):number {
  const x=a?.gain??null,y=b?.gain??null;
  if(x===null)return y===null?0:1;
  if(y===null)return -1;
  return ascending?x-y:y-x;
}
