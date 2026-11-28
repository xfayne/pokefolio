import { useDisplayCurrency, convertDisplay } from '@/services/display-currency';
import { useHistoricalFx } from '@/services/historical-fx';
import type { CardCopy, Money } from '@/domain/schema';

export function useMarketChange(copies:readonly CardCopy[],enabled:boolean,preview:boolean) {
  const display=useDisplayCurrency();
  const currency=preview?'USD':display?.currency??'USD';
  const convert=(money:Money)=>preview?convertDisplay(money.minor,money.currency,'USD',{USD:1,GBP:.8,EUR:.9,ILS:3.7})
    :display?display.convert(money.minor,money.currency):money.currency===currency?money.minor:null;
  const eligible=copies.filter(copy=>copy.disposition==='held'&&!copy.removedFromImport&&!copy.removedFromPurchase&&(copy.possession==='received'||copy.possession==='pending'));
  const needsFx=eligible.some(copy=>[copy.cardCost,copy.shippingCost,copy.taxCost,copy.feeCost].some(cost=>
    (cost.status==='exact'||cost.status==='estimated')&&cost.value.currency!==currency));
  const dates=eligible.flatMap(copy=>copy.acquiredOn.status==='known'?[copy.acquiredOn.value]:[]);
  const fx=useHistoricalFx(dates,new Date().toISOString().slice(0,10),enabled&&!preview&&needsFx);
  return {display,currency,convert,fx};
}
