import {expect,it} from 'vitest';
import {selectRealizedPeriod,type RealizedSaleEvent} from './realized-period';
import type {Metric} from './money';
const exact=(minor:number):Metric=>({status:'exact',currency:'GBP',minor});
const unavailable:Metric={status:'unavailable',reason:'Unknown frozen acquisition cost'};
const sale=(id:string,date:string,proceeds:number,basis:number):RealizedSaleEvent=>({
 id,date,proceeds:exact(proceeds),basis:exact(basis),profit:exact(proceeds-basis),
});

it('accumulates date-filtered net realized profit with zero baseline, flat days and losses',()=>{
 const events=[sale('a','2026-11-03',2500,1000),sale('b','2026-11-05',300,900)];
 const all=selectRealizedPeriod(events,'2026-11-02','2026-11-07','GBP');
 expect(all.sales).toBe(2);
 expect(all.realized).toMatchObject({minor:900,covered:2,total:2});
 expect(all.proceeds.minor).toBe(2800);
 expect(all.basis.minor).toBe(1900);
 expect(all.points).toEqual([
  {date:'2026-11-01',value:0},
  {date:'2026-11-02',value:0},
  {date:'2026-11-03',value:1500},
  {date:'2026-11-04',value:1500},
  {date:'2026-11-05',value:900},
  {date:'2026-11-06',value:900},
  {date:'2026-11-07',value:900},
 ]);
 const narrowed=selectRealizedPeriod(events,'2026-11-05','2026-11-07','GBP');
 expect(narrowed.realized.minor).toBe(-600);
 expect(narrowed.points[0]).toEqual({date:'2026-11-04',value:0});
 expect(narrowed.points.at(-1)).toEqual({date:'2026-11-07',value:-600});
 expect(narrowed.sales).toBe(1);
});

it('groups multiple sales on the same date without missing any proceeds or basis',()=>{
 const result=selectRealizedPeriod([
  sale('b','2026-11-03',1000,900),
  sale('a','2026-11-03',500,250),
 ],'2026-11-03','2026-11-05','GBP');
 expect(result.realized.minor).toBe(350);
 expect(result.points).toEqual([
  {date:'2026-11-02',value:0},
  {date:'2026-11-03',value:350},
  {date:'2026-11-04',value:350},
  {date:'2026-11-05',value:350},
 ]);
});

it('never invents a missing realized result and preserves valid proceeds independently',()=>{
 const unknown:RealizedSaleEvent={id:'unknown',date:'2026-11-04',proceeds:exact(800),basis:unavailable,profit:unavailable};
 const result=selectRealizedPeriod([sale('a','2026-11-03',2500,1000),unknown,sale('b','2026-11-05',300,900)],'2026-11-02','2026-11-06','GBP');
 expect(result.sales).toBe(3);
 expect(result.realized).toMatchObject({minor:null,covered:2,total:3});
 expect(result.basis).toMatchObject({minor:null,covered:2,total:3});
 expect(result.proceeds).toMatchObject({minor:3600,covered:3,total:3});
 expect(result.points).toEqual([
  {date:'2026-11-01',value:0},{date:'2026-11-02',value:0},
  {date:'2026-11-03',value:1500},{date:'2026-11-04',value:null},
  {date:'2026-11-05',value:null},{date:'2026-11-06',value:null},
 ]);
});

it('returns zero totals but no invented chart when there were no sales in the period',()=>{
 const result=selectRealizedPeriod([sale('old','2025-10-01',200,100)],'2026-11-01','2026-11-23','GBP');
 expect(result).toMatchObject({sales:0,realized:{minor:0,covered:0,total:0},proceeds:{minor:0},basis:{minor:0},points:[]});
});

it('rejects invalid periods and unconverted money',()=>{
 expect(()=>selectRealizedPeriod([],'2026-11-03','2026-11-02','GBP')).toThrow();
 expect(()=>selectRealizedPeriod([{...sale('a','2026-11-03',100,50),profit:{status:'exact',currency:'USD',minor:50}}],'2026-11-01','2026-11-04','GBP')).toThrow('Unconverted');
});
