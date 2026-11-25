import { describe,expect,it } from 'vitest';
import { readScanCache,scanCacheKey,writeScanCache,type ScanSnapshot } from './cache';
import { newScan,type DealCard } from './scan';
const card:DealCard={id:'base1-1',name:'Alakazam',setName:'Base Set',number:'1/102',firstEdition:false,finish:'holo'};
const now=100_000;
const snapshot:ScanSnapshot={scan:{...newScan([card]),searched:1},completedAt:now,details:{},overrides:{},aiGrades:{}};
describe('Deals session cache',()=>{
 it('reuses completed results for 30 minutes only in the exact owner, scope, printing and postal code',()=>{
  const key=scanCacheKey('cache-owner','wishlist',[card],'1234567');
  writeScanCache(key,snapshot);
  expect(readScanCache(key,now+29*60_000)).toEqual(snapshot);
  expect(readScanCache(key,now+30*60_000)).toBeNull();
  for(const other of [scanCacheKey('other','wishlist',[card],'1234567'),scanCacheKey('cache-owner','card',[card],'1234567'),scanCacheKey('cache-owner','wishlist',[{...card,firstEdition:true}],'1234567'),scanCacheKey('cache-owner','wishlist',[card],'7654321')])expect(readScanCache(other,now)).toBeNull();
 });
 it('does not cache incomplete or throttled scans',()=>{
  const key=scanCacheKey('incomplete','wishlist',[card],'');
  writeScanCache(key,{...snapshot,scan:newScan([card])});
  expect(readScanCache(key,now)).toBeNull();
  writeScanCache(key,{...snapshot,scan:{...snapshot.scan,throttled:true}});
  expect(readScanCache(key,now)).toBeNull();
 });
});
