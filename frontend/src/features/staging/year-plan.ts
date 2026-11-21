import {purchaseCommit} from '@/domain/purchase-commit';
import {receivePurchase} from '@/domain/receipt';
import {newSaleDraft,saleCommit,reverseSaleCommit} from '@/domain/sale';
import {prepareCommit,recordKey,type PortfolioRecord,type PortfolioCommit} from '@/domain/persistence';
import type {Currency} from '@/domain/schema';
import {purchaseCatalogReference} from '@/features/catalog/catalog';

/** Explicit staging fixture plan. Dates model historical events, never actual imports. */
export function stagingYearPlan(owner:string,today:string,existing:readonly PortfolioRecord[]){
 const end=new Date(`${today}T12:00:00Z`),year=end.getUTCFullYear();
 const prefix=`staging-year-v1-${year}`;
 if(existing.some(e=>e.record.id.startsWith(prefix)))throw Error('This year is already present; no records were changed.');
 const records=new Map(existing.map(e=>[recordKey(e),e])),commands:PortfolioCommit[]=[];
 const add=(raw:PortfolioCommit)=>{
  const command=prepareCommit(owner,raw,450);commands.push(command);
  for(const e of [...command.creates,...command.updates.map(u=>u.after)])records.set(recordKey(e),e);
 };
 const date=(offset:number,day:number)=>new Date(Date.UTC(year,end.getUTCMonth()-12+offset,day)).toISOString().slice(0,10);
 const cards=['base3-5','neo2-13','basep-9'];
 for(let i=0;i<13;i++){
  const d=date(i,5),id=`${prefix}-purchase-${i}`,currency:Currency=(['USD','EUR','GBP'] as const)[i%3]!;
  const unit=(24+i*3).toFixed(2);
  add(purchaseCommit(owner,{id,date:d,source:'manual',seller:['Card shop','Weekend market','Local collector'][i%3]!,currency,pricingMode:'per-copy',shipping:'4',lotTotal:'',trackingNumber:'',carrier:'',cards:[0,1].map(n=>({id:`${id}-copy-${n}`,catalog:purchaseCatalogReference(cards[(i+n)%3]!),condition:'LP',amount:unit}))},`${d}T09:00:00Z`));
  // Keep the latest acquisition pending; older purchases have actual receipt audits.
  if(i<12)for(const command of receivePurchase(owner,id,[...records.values()],`${date(i,9)}T12:00:00Z`))add(command);
 }
 for(const [n,offset] of [4,8,11].entries()){
  const id=`${prefix}-sale-${n}`,d=date(offset,18),copyId=`${prefix}-purchase-${n}-copy-0`;
  const copies=[...records.values()].flatMap(e=>e.collection==='copies'?[e.record]:[]);
  add(saleCommit(owner,{...newSaleDraft(),id,date:d,currency:'USD',buyer:'Local collector',cards:[{copyId,amount:String(55+n*15)}],sellingFees:'2'},copies,`${d}T12:00:00Z`));
  if(n===1)add(reverseSaleCommit(owner,id,[...records.values()],`${date(offset+1,18)}T12:00:00Z`));
 }
 return {commands,records:[...records.values()],prefix,purchases:13,copies:26,sales:3};
}
