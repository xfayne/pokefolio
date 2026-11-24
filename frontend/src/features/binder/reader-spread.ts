/** Zero-based real pages only. Both covers are separate, even for odd totals.
 * The final interior leaf may be unpaired; never create a phantom page.
 * Keep the selected page when orientation changes.
 */
export function readerSpread(page:number,total:number,landscape:boolean) {
  const current=Math.min(Math.max(0,page),total-1);
  const start=(index:number)=>!landscape || index===0 || index===total-1
    ? index : 1+2*Math.floor((index-1)/2);
  const first=start(current);
  const count=landscape && first>0 && first<total-1 ? Math.min(2,total-1-first) : 1;
  return {first,count,previous:first>0?start(first-1):null,next:first+count<total?first+count:null};
}
