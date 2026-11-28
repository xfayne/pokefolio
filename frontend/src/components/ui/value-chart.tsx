import {useId,useState} from 'react';

export type ChartPoint={date:string;value:number|null};

export function ValueChart({points,label,format,empty,explore}:{points:readonly ChartPoint[];label:string;format:(v:number)=>string;empty:string;explore:string}){
 const id=useId().replace(/:/g,''),[active,setActive]=useState<number|null>(null);
 const valid=points.filter((p):p is ChartPoint&{value:number}=>p.value!==null);
 if(valid.length<2)return <div className="dashboard-chart-empty" role="status">{empty}</div>;
 const values=valid.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),span=Math.max(max-min,Math.abs(max)*0.01,1);
 const x=(i:number)=>6+(i/Math.max(1,points.length-1))*348,y=(v:number)=>88-(v-min+span*0.15)/(span*1.3)*76;
 const segments:string[]=[];let line='';
 for(const [i,p] of points.entries()){if(p.value===null){if(line)segments.push(line);line='';}else line+=`${line?' L':'M'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`;}if(line)segments.push(line);
 const selected=active===null?null:points[Math.min(active,points.length-1)];
 return <div className="dashboard-chart"><svg viewBox="0 0 360 100" preserveAspectRatio="none" role="img" aria-label={label}><defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--dashboard-mint)" stopOpacity="0.45"/><stop offset="100%" stopColor="var(--dashboard-mint)" stopOpacity="0.06"/></linearGradient></defs>{segments.map((d,i)=>{const matches=[...d.matchAll(/[ML]([\d.]+),([\d.]+)/g)];const start=matches[0]?.[1]??'6',end=matches.at(-1)?.[1]??'354';return <g key={i}><path className="dashboard-chart-fill" d={`${d} L${end},96 L${start},96 Z`} fill={`url(#${id}-fill)`}/><path className="dashboard-chart-line" pathLength={1} d={d} fill="none" stroke="var(--dashboard-mint)" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/></g>;})}</svg><input type="range" min="0" max={Math.max(0,points.length-1)} value={active??points.length-1} aria-label={explore} aria-valuetext={`${(selected??points.at(-1))!.date}: ${(selected??points.at(-1))!.value===null?'—':format((selected??points.at(-1))!.value!)}`} onChange={e=>setActive(Number(e.target.value))} onPointerMove={e=>{const rect=e.currentTarget.getBoundingClientRect();setActive(Math.max(0,Math.min(points.length-1,Math.round((e.clientX-rect.left)/rect.width*(points.length-1)))));}} onPointerLeave={()=>setActive(null)} />{selected&&<output className="dashboard-chart-tooltip">{selected.date} · <bdi>{selected.value===null?'—':format(selected.value)}</bdi></output>}</div>;
}
