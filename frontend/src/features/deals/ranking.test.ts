import { describe,expect,it } from 'vitest';
import { compareRecommended,evaluate } from './ranking';
import type { DealItem } from './scan';
const item:DealItem={cardId:'base3-5',itemId:'v1|123456789|0',title:'Gengar Fossil 5/62',url:'https://www.ebay.com/itm/123456789',image:null,currentBid:{value:20,currency:'USD'},shipping:{value:5,currency:'USD'},bidCount:0,endTime:null,sellerFeedback:100,sellerName:'seller',condition:'LP',conditionGrade:'LP',conditionSource:'seller',conditionLabel:'LP',format:'FIXED_PRICE',bestOffer:false,marketplace:'EBAY_US',matchConfidence:95,warnings:[],verificationStatus:'strong',verificationReasons:[]};
describe('legacy Deals evaluation',()=>{
 it('includes shipping and never recommends unknown shipping or review listings',()=>{
  const strong=evaluate(item,5000,2000,500,0);
  expect(strong.discount).toBe(.5);expect(strong.group).toBe(0);
  expect(evaluate(item,5000,2000,null,0).discount).toBeNull();
  const review=evaluate({...item,verificationStatus:'review'},5000,2000,500,0);
  expect(review.discount).toBeNull();expect(compareRecommended(strong,review)).toBeLessThan(0);
 });
 it('ranks overpriced results by the actual overpayment, not auction bonus',()=>{
  const auction={...item,format:'AUCTION' as const,endTime:new Date(30*3600000).toISOString()};
  const better=evaluate(auction,5000,5500,0,0),worse=evaluate(item,5000,6000,0,0);
  expect(compareRecommended(better,worse)).toBeLessThan(0);
 });
 it('does not promote low-confidence AI grades to recommended group',()=>{
  expect(evaluate(item,5000,2000,500,0,undefined,{grade:'NM',confidence:50}).group).not.toBe(0);
  expect(evaluate(item,5000,2000,500,0,'HP',{grade:'NM',confidence:99}).grade).toBe('HP');
 });
});
