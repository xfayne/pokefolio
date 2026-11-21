import { expect, it } from 'vitest';
import { copy, gbp, unknown } from './fixtures.test-support';
import { draftFromSale, editSaleCommit, eligibleSaleCopies, newSaleDraft, prepareSale, reverseSaleCommit, saleCommit, selectSaleDetails, validateSaleCommit, type SaleDraft } from './sale';
import { recordKey, type PortfolioCommit, type PortfolioRecord } from './persistence';
import { groupHistory, selectHistory, type HistoryData } from './transaction-history';
const at = '2026-11-22T00:00:00Z';
const later = '2026-11-23T00:00:00Z';
const draft = (): SaleDraft => ({...newSaleDraft(), id:'sale-one',date:'2026-11-21',buyer:'Buyer',currency:'GBP',cards:[{copyId:copy.id,amount:'30'}],buyerShipping:'3',sellingFees:'2',sellerShipping:'4'});
const apply = (records: readonly PortfolioRecord[], command: PortfolioCommit) => [...new Map([...records,...command.creates,...command.updates.map(u=>u.after)].map(e=>[recordKey(e),e])).values()];
function history(records: readonly PortfolioRecord[]): HistoryData {
  return {ownerUid:'owner', catalog:[], inTransit:[],transactions:records.flatMap(e=>e.collection==='transactions'?[e.record]:[]),copies:records.flatMap(e=>e.collection==='copies'?[e.record]:[]),saleLines:records.flatMap(e=>e.collection==='lines'&&'copyId'in e.record?[e.record]:[])};
}
it('records the exact copy, known landed basis and reconciled net/P&L without changing siblings or organization',()=>{
  const command=saleCommit('owner',draft(),[copy,{...copy,id:'sibling'}],at);
  expect(validateSaleCommit('owner',command)).toBe(true);
  expect(command.updates.map(u=>u.before.record.id)).toEqual([copy.id]);
  expect(command.creates.some(e=>e.collection==='copies')).toBe(false);
  const view=selectSaleDetails(history(apply([],command)),'sale-one')!;
  expect(view.net).toEqual({status:'exact',currency:'GBP',minor:2700});
  expect(view.basis.status).toBe('exact');
  expect(view.profit.status).toBe('exact');
  expect(view.copies[0]!.copy.acquisition).toEqual(copy.acquisition);
});
it('rejects pending/unknown/sold/foreign copies, repeated selections and dates before acquisition',()=>{
  for (const change of [{possession:'pending' as const},{possession:'unknown' as const},{disposition:'sold' as const,dispositionRecordId:'other'},{ownerUid:'foreign'}]) expect(()=>saleCommit('owner',draft(),[{...copy,...change}],at)).toThrow();
  expect(()=>saleCommit('owner',{...draft(),cards:[...draft().cards,...draft().cards]},[copy],at)).toThrow();
  expect(()=>saleCommit('owner',{...draft(),date:'2026-11-01'},[copy],at)).toThrow();
  expect(eligibleSaleCopies('owner',[copy,{...copy,id:'pending',possession:'pending'}]).map(c=>c.id)).toEqual([copy.id]);
});
it('keeps missing costs and historical FX unknown, and estimated costs estimated',()=>{
  const missing=apply([],saleCommit('owner',draft(),[{...copy,cardCost:unknown}],at));
  expect(selectSaleDetails(history(missing),'sale-one')!.profit.status).toBe('unavailable');
  const fx=apply([],saleCommit('owner',{...draft(),currency:'USD'},[copy],at));
  expect(selectSaleDetails(history(fx),'sale-one')!.profit).toEqual({status:'unavailable',reason:'Historical FX required'});
  const estimated=apply([],saleCommit('owner',draft(),[{...copy,cardCost:{status:'estimated',value:gbp(2000),method:'Manual allocation'}}],at));
  expect(selectSaleDetails(history(estimated),'sale-one')!.profit.status).toBe('estimated');
});
it('reconciles penny rounding across multiple copies and labels per-copy expense splits as estimates',()=>{
  const d={...draft(),cards:[{copyId:copy.id,amount:'30'},{copyId:'sibling',amount:'20'}],buyerShipping:'0.01',sellingFees:'0.01',sellerShipping:'0'};
  const plan=prepareSale('owner',d,[copy,{...copy,id:'sibling'}],at);
  expect(plan.lines.map(l=>l.proceeds.status)).toEqual(['estimated','estimated']);
  const command=saleCommit('owner',d,[copy,{...copy,id:'sibling'}],at);
  expect(validateSaleCommit('owner',command)).toBe(true);
  const view=selectSaleDetails(history(apply([],command)),d.id)!;
  expect(view.net).toEqual({status:'exact',currency:'GBP',minor:5000});
  expect(view.profit.status).toBe('exact');
  expect(view.copies.every(c=>c.profit.status==='estimated')).toBe(true);
});
it('edits amounts with frozen basis and exact membership; reversal restores the same copy and zeros its history contribution',()=>{
  const created=saleCommit('owner',draft(),[copy],at);
  let records=apply([],created);
  const edit=editSaleCommit('owner',{...draftFromSale(records,'sale-one'),sellingFees:'5'},records,later);
  expect(validateSaleCommit('owner',edit)).toBe(true);
  records=apply(records,edit);
  expect(selectSaleDetails(history(records),'sale-one')!.net).toEqual({status:'exact',currency:'GBP',minor:2400});
  const reverse=reverseSaleCommit('owner','sale-one',records,'2026-11-24T00:00:00Z');
  expect(validateSaleCommit('owner',reverse)).toBe(true);
  records=apply(records,reverse);
  const restored=records.find(e=>e.collection==='copies')!;
  expect(restored.record).toMatchObject({id:copy.id,disposition:'held',dispositionRecordId:null,acquisition:copy.acquisition});
  const rows=selectHistory(history(records));
  expect(rows[0]).toMatchObject({status:'reversed',minor:0});
  expect(groupHistory(rows,{query:'',kind:'all',currency:'all',status:'all'})[0]!.totals).toEqual([{currency:'GBP',minor:0}]);
  expect(()=>reverseSaleCommit('owner','sale-one',records,later)).toThrow();
  expect(()=>draftFromSale(records,'sale-one')).toThrow();
});
it('rejects incomplete writes and corrections to another sale or copy',()=>{
  const command=saleCommit('owner',draft(),[copy],at);
  expect(()=>validateSaleCommit('owner',{...command,updates:[]})).toThrow();
  expect(()=>validateSaleCommit('owner',{...command,creates:command.creates.filter(e=>e.collection!=='lines')})).toThrow();
  const records=apply([],command);
  expect(()=>editSaleCommit('owner',{...draft(),cards:[{copyId:'different',amount:'1'}]},records,later)).toThrow();
  const wrong=records.map(e=>e.collection==='copies'?{...e,record:{...e.record,dispositionRecordId:'other'}}:e) as PortfolioRecord[];
  expect(()=>reverseSaleCommit('owner','sale-one',wrong,later)).toThrow();
});
it('retains sale-time acquisition costs even if the restored copy basis later changes',()=>{
  const records=apply([],saleCommit('owner',draft(),[copy],at));
  const changed=records.map(e=>e.collection==='copies'?{...e,record:{...e.record,cardCost:{status:'exact',value:gbp(99999),evidenceRef:'correction'}}}:e) as PortfolioRecord[];
  expect(selectSaleDetails(history(changed),'sale-one')!.basis).toEqual(selectSaleDetails(history(records),'sale-one')!.basis);
});
