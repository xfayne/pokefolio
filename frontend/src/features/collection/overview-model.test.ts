import { describe, expect, it } from 'vitest';
import { createSampleCopies, sampleOwner, sampleQuotes } from '@/features/inventory/sample';
import { catalogCards, catalogMarketReference } from '@/features/catalog/catalog';
import type { CopyQuote } from '@/domain/inventory';
import type { Money } from '@/domain/schema';
import { remainingWishes, selectCollectionOverview, selectWishlistBudget, selectCollectionBreakdown } from './overview-model';

const convert = (money: Money) => money.currency === 'USD' ? money.minor : null;
const input = () => ({owner:sampleOwner,copies:createSampleCopies(),catalog:catalogCards,quotes:sampleQuotes,currency:'USD' as const,fx:[],convert});
const quote = (id: string, minor: number): CopyQuote => ({catalog:catalogMarketReference(id),condition:'LP',money:{currency:'USD',minor},observedAt:'2026-11-28T00:00:00Z',source:'Test'});

describe('Collection overview projections', () => {
  it('counts physical received and pending copies, without removed or disposed copies', () => {
    const data = input(), original = data.copies[0]!;
    data.copies.push({...original,id:'sold',disposition:'sold',dispositionRecordId:'sale'}, {...original,id:'removed',removedFromPurchase:true},
      {...original,id:'import-removed',removedFromImport:true}, {...original,id:'unknown',possession:'unknown'});
    const result = selectCollectionOverview(data);
    expect([result.received,result.pending,result.unknown]).toEqual([4,1,1]);
    expect(result.holdings.map(holding=>holding.copy.id)).not.toContain('gengar-pending');
  });
  it('excludes received/pending wishes, preserves priority, and never changes membership', () => {
    const wishes = ['neo2-13','base1-4','base3-5','base2-11','basep-9'];
    expect(remainingWishes(createSampleCopies(), wishes)).toEqual(['neo2-13','basep-9']);
    const copies = createSampleCopies().map(copy=>copy.catalog.kind==='identified'&&copy.catalog.cardId==='base2-11'
      ? {...copy,disposition:'sold' as const,dispositionRecordId:'sale'} : copy);
    expect(remainingWishes(copies,wishes)).toEqual(['neo2-13','base2-11','basep-9']);
    expect(wishes).toHaveLength(5);
    expect(remainingWishes([createSampleCopies()[3]!], ['base3-5'])).toEqual([]);
  });
  it('estimates one LP printing per wish and reports partial/zero/missing coverage separately', () => {
    const correct = quote('basep-9', 0);
    const wrongCondition = {...quote('neo2-13',99999),condition:'NM' as const};
    const wrongEdition: CopyQuote = {...quote('neo2-13',88888),catalog:{...catalogMarketReference('neo2-13'),edition:'first-edition'} as CopyQuote['catalog']};
    const quotes = [correct,quote('base3-5',4500),wrongCondition,wrongEdition];
    expect(selectWishlistBudget(['basep-9','base3-5','neo2-13','base3-5'],quotes,'LP',convert)).toEqual({minor:4500,covered:2,total:3});
    expect(selectWishlistBudget(['neo2-13'],quotes,'LP',convert)).toEqual({minor:null,covered:0,total:1});
    expect(selectWishlistBudget([],quotes,'LP',convert)).toEqual({minor:0,covered:0,total:0});
    expect(selectWishlistBudget(['basep-9'],quotes,'LP',convert)).toEqual({minor:0,covered:1,total:1});
  });
  it('rejects conflicting latest prices and unavailable FX rather than inventing a budget', () => {
    const quotes = [quote('neo2-13',100),quote('neo2-13',200)];
    expect(selectWishlistBudget(['neo2-13'],quotes,'LP',convert).minor).toBeNull();
    expect(selectWishlistBudget(['neo2-13'],[quote('neo2-13',100)],'LP',()=>null).covered).toBe(0);
  });
  it('aggregates concentration by catalog card and ranks gains only with complete costs', () => {
    const result = selectCollectionOverview(input());
    expect(result.total).toBe(54500);
    expect(result.top.map(group=>[group.card.id,group.minor])).toEqual([['base1-4',48000],['base3-5',6500]]);
    expect(result.priced).toBe(3);
    expect(result.above.map(holding=>[holding.copy.id,holding.gain])).toEqual([['charizard-a',8000],['charizard-b',7000],['gengar-a',2000]]);
    expect(result.compared).toBe(4);
    expect(result.comparableTotal).toBe(5);
    expect(result.changes.find(item=>item.card.id==='base3-5')?.change).toMatchObject({gain:3200,basis:7500,market:10700,covered:2,total:2});
    expect(result.holdings.find(holding=>holding.copy.id==='snorlax-a')!.basis).toBeNull();
  });
  it('uses dated FX for acquisition costs and excludes foreign-language market values', () => {
    const data = input(), copy = data.copies[0]!;
    data.copies = [{...copy,cardCost:{status:'exact',value:{currency:'GBP',minor:20000},evidenceRef:'test'},
      shippingCost:{status:'exact',value:{currency:'GBP',minor:0},evidenceRef:'test'},
      taxCost:{status:'exact',value:{currency:'GBP',minor:0},evidenceRef:'test'},
      feeCost:{status:'exact',value:{currency:'GBP',minor:0},evidenceRef:'test'}}];
    expect(selectCollectionOverview(data).compared).toBe(0);
    const withFx = selectCollectionOverview({...data,fx:[{date:'2026-11-12',quote:'GBP',rate:0.8}]});
    expect(withFx.holdings[0]!.gain).toBe(1000);
    const japanese = {...data.copies[0]!,catalog:{...copy.catalog,language:{status:'known',value:'ja',source:'user'}}} as typeof copy;
    const foreign = selectCollectionOverview({...data,copies:[japanese],quotes:[{...sampleQuotes[0]!,catalog:japanese.catalog}]});
    expect(foreign.priced).toBe(0);
  });
  it('keeps negative gains, zero-cost ROI and incomplete expenses distinct', () => {
    const data = input();
    data.quotes = [{...sampleQuotes[0]!,money:{currency:'USD',minor:10000}},...sampleQuotes.slice(1)];
    data.copies = data.copies.map(copy=>copy.id==='charizard-b' ? {...copy,cardCost:{status:'exact',value:{currency:'USD',minor:0},evidenceRef:'gift'}} : copy);
    const result = selectCollectionOverview(data);
    expect(result.below[0]!.gain).toBe(-8000);
    expect(result.above.find(holding=>holding.copy.id==='charizard-b')!.roi).toBeNull();
    data.copies = data.copies.map(copy=>copy.id==='charizard-a' ? {...copy,shippingCost:{status:'unknown',reason:'Not recorded'}} : copy);
    expect(selectCollectionOverview(data).holdings.find(holding=>holding.copy.id==='charizard-a')!.gain).toBeNull();
  });
});

describe('Collection breakdown', () => {
  it('uses the same metric for total, shares and segment amounts, including pending market quotes', () => {
    const figures = selectCollectionOverview(input());
    const budget = {minor:90000, covered:9, total:9};
    expect(figures.pendingValue).toBe(4200);
    expect(figures.pendingPriced).toBe(1);
    const value = selectCollectionBreakdown(figures,budget,'value');
    expect(value.total).toBe(148700);
    expect(value.categories.map(item=>item.amount)).toEqual([54500,4200,90000]);
    expect(value.categories[2]!.share).toBeCloseTo(90000/148700);
    expect(value.covered).toBe(13);
    expect(value.count).toBe(14);
    const quantity = selectCollectionBreakdown(figures,budget,'quantity');
    expect(quantity.total).toBe(14);
    expect(quantity.categories.map(item=>item.amount)).toEqual([4,1,9]);
    expect(quantity.categories[0]!.share).toBeCloseTo(4/14);
  });
  it('does not invent prices or percentages for unpriced, zero or empty groups', () => {
    const figures = selectCollectionOverview({...input(),quotes:[]});
    const unknown = selectCollectionBreakdown(figures,{minor:null,covered:0,total:2},'value');
    expect(unknown.total).toBeNull();
    expect(unknown.categories.map(item=>item.share)).toEqual([null,null,null]);
    const empty = selectCollectionBreakdown(selectCollectionOverview({...input(),copies:[]}),{minor:0,covered:0,total:0},'value');
    expect(empty.total).toBe(0);
    expect(empty.categories.map(item=>item.share)).toEqual([null,null,null]);
    const partial = selectCollectionBreakdown(figures,{minor:100,covered:1,total:2},'value');
    expect(partial.categories.map(item=>item.share)).toEqual([null,null,1]);
    expect(partial.covered).toBe(1);
  });
});
