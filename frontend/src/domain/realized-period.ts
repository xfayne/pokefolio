import {dateSchema,type Currency} from './schema';
import {safeInteger,type Metric} from './money';

/** Sale dates are transaction dates; amounts are already converted using dated FX.
 * Reversed sales are excluded upstream. Missing amounts must never become zero. */
export type RealizedSaleEvent=Readonly<{
 id:string;date:string;proceeds:Metric;basis:Metric;profit:Metric;
}>;
export type RealizedPeriodTotal=Readonly<{
 minor:number|null;currency:Currency;covered:number;total:number;estimated:boolean;
}>;
export type RealizedPeriodPoint=Readonly<{date:string;value:number|null}>;
export type RealizedPeriod=Readonly<{
 sales:number;realized:RealizedPeriodTotal;proceeds:RealizedPeriodTotal;basis:RealizedPeriodTotal;
 points:readonly RealizedPeriodPoint[];
}>;

const shiftDay=(date:string,days:number)=>new Date(Date.parse(`${date}T00:00:00Z`)+days*86_400_000).toISOString().slice(0,10);
function total(values:readonly Metric[],currency:Currency):RealizedPeriodTotal {
 const valid=values.filter((v):v is Extract<Metric,{status:'exact'|'estimated'}>=>v.status!=='unavailable');
 if(valid.some(v=>v.currency!==currency))throw Error('Unconverted realized period total');
 return {currency,minor:valid.length===values.length?safeInteger(valid.reduce((acc,v)=>acc+BigInt(v.minor),0n)):null,
  covered:valid.length,total:values.length,estimated:valid.some(v=>v.status==='estimated')};
}

/** Baseline is exactly zero at the beginning of the *selected* period.
 * Plot only observed, complete sale profits. Once a sale is missing its costs,
 * all subsequent cumulative values become unavailable rather than invented.
 * Calendar days stay evenly spaced in the existing SVG chart. */
export function selectRealizedPeriod(sales:readonly RealizedSaleEvent[],from:string,to:string,currency:Currency):RealizedPeriod {
 dateSchema.parse(from);dateSchema.parse(to);
 if(from>to)throw Error('Realized period end precedes start');
 const selected=sales.filter(s=>s.date>=from&&s.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const byDate=new Map<string,RealizedSaleEvent[]>();
 for(const sale of selected){
  dateSchema.parse(sale.date);
  const group=byDate.get(sale.date)??[];
  group.push(sale);byDate.set(sale.date,group);
 }
 const realized=total(selected.map(s=>s.profit),currency);
 const proceeds=total(selected.map(s=>s.proceeds),currency);
 const basis=total(selected.map(s=>s.basis),currency);
 if(!selected.length)return {sales:0,realized,proceeds,basis,points:[]};
 let running:bigint|null=0n;
 const points:RealizedPeriodPoint[]=[{date:shiftDay(from,-1),value:0}];
 for(let date=from;date<=to;date=shiftDay(date,1)){
  for(const sale of byDate.get(date)??[]){
   if(sale.profit.status==='unavailable'){running=null;continue;}
   if(running!==null)running+=BigInt(sale.profit.minor);
  }
  points.push({date,value:running===null?null:safeInteger(running)});
 }
 return {sales:selected.length,realized,proceeds,basis,points};
}
