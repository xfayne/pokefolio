/** The chart can have leading or trailing gaps even when a usable return exists.
 * Show the last plotted cumulative change, never a synthetic value for a gap.
 * A baseline alone is not a measured return. */
export type ChangePoint = Readonly<{date:string;value:number|null}>;
export function latestAvailableChange(points:readonly ChangePoint[]):{date:string;value:number}|null {
 let last:{date:string;value:number}|null=null,observations=0;
 for(const point of points){
  if(point.value===null||!Number.isFinite(point.value))continue;
  observations++;
  last={date:point.date,value:point.value};
 }
 return observations>=2?last:null;
}
