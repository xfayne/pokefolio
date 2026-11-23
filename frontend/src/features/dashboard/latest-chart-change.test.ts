import {expect,it} from 'vitest';
import {latestAvailableChange} from './latest-chart-change';

it('displays the most recent measured market change with incomplete leading and trailing dates',()=>{
 expect(latestAvailableChange([
  {date:'2026-11-18',value:null},
  {date:'2026-11-19',value:0},
  {date:'2026-11-20',value:1.25},
  {date:'2026-11-21',value:3.5},
  {date:'2026-11-22',value:null},
  {date:'2026-11-23',value:null},
 ])).toEqual({date:'2026-11-21',value:3.5});
});

it('keeps a genuine zero-percent result instead of an unavailable placeholder',()=>{
 expect(latestAvailableChange([{date:'2026-11-20',value:0},{date:'2026-11-21',value:0}])).toEqual({date:'2026-11-21',value:0});
});

it('does not fabricate returns from no observations or only one baseline',()=>{
 expect(latestAvailableChange([])).toBeNull();
 expect(latestAvailableChange([{date:'2026-11-22',value:null},{date:'2026-11-23',value:0}])).toBeNull();
 expect(latestAvailableChange([{date:'2026-11-22',value:null},{date:'2026-11-23',value:null}])).toBeNull();
});
