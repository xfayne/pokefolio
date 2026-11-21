import {expect,it} from 'vitest';
import {stagingYearPlan} from './year-plan';
import {selectPerformance,type PriceSeries} from '@/domain/performance';
import {catalogIdentity} from '@/domain/inventory';
import {validateReceiptCommit} from '@/domain/receipt';
import {validateSaleCommit} from '@/domain/sale';
import {copy} from '@/domain/fixtures.test-support';

it('plans a year of real-domain purchases, receipts, partial sales and a reversal without touching existing copies',()=>{
 const original={collection:'copies' as const,record:copy};
 const plan=stagingYearPlan('owner','2026-11-21',[original]);
 expect(plan.records.find(e=>e.record.id===copy.id)).toEqual(original);
 for(const c of plan.commands){if(!validateReceiptCommit(c))validateSaleCommit('owner',c);}
 const copies=plan.records.flatMap(e=>e.collection==='copies'&&e.record.id!==copy.id?[e.record]:[]);
 expect(copies).toHaveLength(26);
 expect(copies.filter(c=>c.possession==='pending')).toHaveLength(2);
 expect(copies.filter(c=>c.disposition==='sold')).toHaveLength(2);
 const prices=new Map<string,PriceSeries>();
 for(const c of copies)prices.set(catalogIdentity(c.catalog),{catalog:c.catalog,condition:'LP',currency:'USD',current:{minor:5000,observedAt:'2026-11-21T00:00:00Z'},source:'test',stale:false,history:Array.from({length:366},(_,i)=>({date:new Date(Date.UTC(2025,10,21+i)).toISOString().slice(0,10),minor:4000+i}))});
 const result=selectPerformance({owner:'owner',records:plan.records,catalog:[],prices:[...prices.values()],fx:[],currency:'USD',asOf:'2026-11-21T15:00:00Z'});
 expect(result.points).toHaveLength(366);
 expect(result.points.every(p=>p.unknownHistory===0)).toBe(true);
 expect(result.points.filter(p=>p.value.covered>0).length).toBe(366);
 expect(result.top).toHaveLength(3);
 expect(result.realized.total).toBe(2);
 expect(()=>stagingYearPlan('owner','2026-11-21',plan.records)).toThrow('already present');
});
