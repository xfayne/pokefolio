import {expect,it} from 'vitest';
import {copy,known,unknown,metadata} from './fixtures.test-support';
import {selectPerformance,referenceConverter,type PriceSeries,type PerformanceInput} from './performance';
import {receivePurchase} from './receipt';
import {saleCommit,reverseSaleCommit,newSaleDraft} from './sale';
import type {PortfolioRecord} from './persistence';
import type {CardCopy} from './schema';
const current:CardCopy={...copy,cardCost:{status:'exact',value:{currency:'USD',minor:1000},evidenceRef:'purchase'},shippingCost:{status:'exact',value:{currency:'USD',minor:100},evidenceRef:'purchase'},taxCost:{status:'exact',value:{currency:'USD',minor:0},evidenceRef:'purchase'},feeCost:{status:'exact',value:{currency:'USD',minor:0},evidenceRef:'purchase'}};
const price:PriceSeries={catalog:current.catalog,condition:'LP',currency:'USD',current:{minor:2000,observedAt:'2026-11-21T00:00:00Z'},history:[{date:'2026-11-20',minor:1500},{date:'2026-11-21',minor:2000}],source:'Synthetic',stale:false};
const input=(copies:CardCopy[]=[current],other:PortfolioRecord[]=[]):PerformanceInput=>({owner:'owner',records:[...copies.map(record=>({collection:'copies' as const,record})),...other],catalog:[],prices:[price],fx:[],currency:'USD',asOf:'2026-11-21T12:00:00Z'});
it('counts distinct received physical copies and excludes pending/sold/lost holdings',()=>{
 const copies=[current,{...current,id:'duplicate'},{...current,id:'pending',possession:'pending' as const},{...current,id:'sold',disposition:'sold' as const,dispositionRecordId:'sale'},{...current,id:'lost',disposition:'lost' as const,dispositionRecordId:'lost-record'}];
 const result=selectPerformance(input(copies));
 expect(result.value).toMatchObject({minor:4000,covered:2,total:2});
 expect(result.knownCost.minor).toBe(2200);expect(result.unrealized.minor).toBe(1800);expect(result.pending).toBe(1);
 expect(result.roi).toBeCloseTo(1800/2200*100);expect(result.top).toHaveLength(2);
});
it('keeps unknown cost, missing condition/edition and lot allocations outside matched ROI',()=>{
 const noCost={...current,id:'old',cardCost:unknown};
 const noPrice={...current,id:'no-grade',condition:unknown};
 const lot={...current,id:'lot',cardCost:{status:'unallocated' as const,lotId:'lot-one'}};
 const result=selectPerformance(input([current,noCost,noPrice,lot]));
 expect(result.value).toMatchObject({minor:6000,covered:3,total:4});expect(result.knownCost).toMatchObject({minor:2200,covered:2,total:4});
 expect(result.unrealized).toMatchObject({minor:900,covered:1,total:4});
 expect(result.roi).toBeCloseTo(900/1100*100);
 const unavailable=selectPerformance({...input([current]),prices:[]});expect(unavailable.value.minor).toBeNull();expect(unavailable.unrealized.minor).toBeNull();
 expect(selectPerformance(input([])).value.minor).toBe(0);
});
it('does not reinterpret pending purchase dates as historical receipt dates',()=>{
 const pending={...current,possession:'pending' as const};
 const purchase={...metadata,id:'purchase',kind:'purchase' as const,transactionOn:'2026-11-20',currency:'USD' as const,source:{kind:'manual' as const,seller:null,listingUrl:null,itemReference:null},notes:'',pricingMode:'per-copy' as const,lotId:null,subtotal:known({currency:'USD' as const,minor:1000}),shipping:known({currency:'USD' as const,minor:100}),taxes:known({currency:'USD' as const,minor:0}),fees:known({currency:'USD' as const,minor:0}),payable:{currency:'USD' as const,minor:1100},settlement:'unknown' as const};
 const records:PortfolioRecord[]=[{collection:'copies',record:pending},{collection:'transactions',record:purchase}];
 const command=receivePurchase('owner','purchase',records,'2026-11-21T09:00:00Z')[0]!;
 const received=command.updates[0]!.after.record as CardCopy;
 const result=selectPerformance(input([received],[{collection:'transactions',record:purchase},...command.creates]));
 expect(result.points[0]).toMatchObject({date:'2026-11-20',held:0});expect(result.points[1]?.held).toBe(1);
 const missing=selectPerformance(input([received]));expect(missing.points[0]?.unknownHistory).toBe(1);
});
it('reconciles partial sales with frozen acquisition basis and skips reversals',()=>{
 const draft={...newSaleDraft(),id:'sale',date:'2026-11-21',currency:'USD' as const,cards:[{copyId:current.id,amount:'30'}],sellingFees:'2'};
 const sale=saleCommit('owner',draft,[current],'2026-11-21T08:00:00Z');
 const sold=sale.updates[0]!.after.record as CardCopy;
 const result=selectPerformance(input([sold,{...current,id:'sibling'}],sale.creates));
 expect(result.realized).toMatchObject({minor:1700,covered:1,total:1});
 expect(result.realizedProceeds).toMatchObject({minor:2800,covered:1,total:1});
 expect(result.soldCostBasis).toMatchObject({minor:1100,covered:1,total:1});
 expect(result.value.minor).toBe(2000);
 expect(result.points[0]?.held).toBe(2);expect(result.points[1]?.held).toBe(1);
 const records=[{collection:'copies' as const,record:sold},...sale.creates];
 const reversal=reverseSaleCommit('owner','sale',records,'2026-11-21T10:00:00Z');
 const merged=new Map(records.map(e=>[`${e.collection}/${e.record.id}`,e]));
 for(const e of [...reversal.creates,...reversal.updates.map(u=>u.after)])merged.set(`${e.collection}/${e.record.id}`,e);
 const reversed=selectPerformance({...input(),records:[...merged.values()]});
 expect(reversed.realized.minor).toBe(0);
 expect(reversed.realizedProceeds).toMatchObject({minor:0,total:0});
 expect(reversed.soldCostBasis).toMatchObject({minor:0,total:0});
});
it('uses dated FX for costs and dates both price observations without inventing quotes across gaps',()=>{
 const fx=[{date:'2026-11-20',quote:'GBP' as const,rate:0.5},{date:'2026-11-21',quote:'GBP' as const,rate:0.4}];
 const result=selectPerformance({...input([{...current,cardCost:{status:'estimated',value:{currency:'GBP',minor:1000},method:'Lot split'},shippingCost:{status:'exact',value:{currency:'GBP',minor:0},evidenceRef:'p'},taxCost:{status:'exact',value:{currency:'GBP',minor:0},evidenceRef:'p'},feeCost:{status:'exact',value:{currency:'GBP',minor:0},evidenceRef:'p'}}]),fx});
 expect(result.knownCost).toMatchObject({minor:2000,estimated:true});expect(result.unrealized.minor).toBe(0);
 const sterling=selectPerformance({...input(),fx,currency:'GBP'});
 expect(sterling.points[1]?.matchedChange).toBeCloseTo(100/3); // USD 15 -> 20, excludes GBP FX movement
 const missing=selectPerformance({...input(),prices:[{...price,history:[price.history[1]!]}]});expect(missing.points[0]?.value.minor).toBeNull();expect(missing.points[1]?.matchedChange).toBeNull();
 const convert=referenceConverter(fx);expect(convert({currency:'GBP',minor:-1},'USD','2026-11-20')).toMatchObject({minor:-2});
 expect(convert({currency:'GBP',minor:1},'USD','2020-01-01').status).toBe('unavailable');
});
it('rejects foreign/duplicate records and conflicting price series before publishing totals',()=>{
 expect(()=>selectPerformance(input([current,current]))).toThrow('duplicate');
 expect(()=>selectPerformance({...input(),owner:'someone'})).toThrow('Foreign');
 expect(()=>selectPerformance({...input(),prices:[price,price]})).toThrow('Duplicate');
});
it('isolates new additions from matched-price appreciation',()=>{
 const newcomer={...current,id:'new-copy',createdAt:'2026-11-21T00:00:00Z',updatedAt:'2026-11-21T00:00:00Z'};
 const result=selectPerformance(input([current,newcomer]));
 expect(result.points.map(p=>p.value.minor)).toEqual([1500,4000]);
 expect(result.points[1]?.matchedCount).toBe(1);expect(result.points[1]?.matchedChange).toBeCloseTo(100/3);
});
it('uses the actual historical condition from the audit instead of todays condition',()=>{
 const before={...current,condition:known('MP' as const)};
 const after={...current,revision:2,updatedAt:'2026-11-21T01:00:00Z'};
 const audit:PortfolioRecord={collection:'revisions',record:{...metadata,id:'edit',actorUid:'owner',recordId:current.id,operation:'edit',reason:'Condition corrected',createdAt:after.updatedAt,updatedAt:after.updatedAt,before,after}};
 const mp={...price,condition:'MP' as const,current:{minor:1000,observedAt:price.current!.observedAt},history:[{date:'2026-11-20',minor:900}]};
 const result=selectPerformance({...input([after],[audit]),prices:[price,mp]});
 expect(result.points[0]?.value.minor).toBe(900);expect(result.points[1]?.value.minor).toBe(2000);
 expect(result.points[1]?.matchedChange).toBeNull();
});

it('keeps sale proceeds available while the frozen cost basis and realized profit are missing',()=>{
 const draft={...newSaleDraft(),id:'sale-unknown',date:'2026-11-21',currency:'USD' as const,cards:[{copyId:current.id,amount:'30'}],sellingFees:'2'};
 const sale=saleCommit('owner',draft,[current],'2026-11-21T08:00:00Z');
 const sold=sale.updates[0]!.after.record as CardCopy;
 const rows=sale.creates.map(entry=>entry.collection==='lines'&&'basisCosts' in entry.record
  ?{...entry,record:{...entry.record,basisCosts:undefined}}
  :entry) as PortfolioRecord[];
 const result=selectPerformance(input([sold],rows));
 expect(result.realizedProceeds).toMatchObject({minor:2800,covered:1,total:1});
 expect(result.soldCostBasis).toMatchObject({minor:null,covered:0,total:1});
 expect(result.realized).toMatchObject({minor:null,covered:0,total:1});
});
