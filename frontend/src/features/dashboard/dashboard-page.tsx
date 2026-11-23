import {useId,useState} from 'react';
import {useNavigate} from 'react-router';
import {useTranslation} from 'react-i18next';
import {LuCalendarDays,LuChartNoAxesCombined,LuChevronDown,LuChevronRight,LuLayers,LuTag,LuTrendingUp,LuWallet} from 'react-icons/lu';
import {Card} from '@/components/ui/surfaces';
import {PokemonArt} from '@/components/ui/pokemon-art';
import {Button} from '@/components/ui/button';
import {catalogCards} from '@/features/catalog/catalog';
import type {CardCopy} from '@/domain/schema';
import type {Metric} from '@/domain/money';
import type {PerformancePoint,Total} from '@/domain/performance';
import reference from '@/assets/dashboard-reference.jpeg';
import {useDashboard} from './use-dashboard';
import {latestAvailableChange} from './latest-chart-change';

type Period='1M'|'3M'|'1Y'|'All';
type Mode='value'|'change'|'realized';
const text={en:{value:'Collection Value',priced:'Priced',knownCost:'Known Cost',heldCopies:'Held Copies',unrealizedRoi:'Unrealized ROI',netSaleProceeds:'Net Sale Proceeds',soldCostBasis:'Sold Cost Basis',unrealized:'Unrealized P/L',realized:'Realized P/L',change:'Market Change',priceHistory:'Price History',recent:'Recent Acquisitions',seeAll:'See All',paid:'Paid',month:'This Month',spend:'Purchase Spend',copies:'Copies Acquired',transactions:'View transactions',top:'Top Holdings',loading:'Loading portfolio…',signIn:'Sign in through Settings to view your portfolio.',emptyRecent:'No purchases yet.',emptyTop:'No priced, received holdings yet.',emptyChart:'At least two complete daily valuations are needed to draw the chart.',estimated:'Estimated market values',costCoverage:'Cost coverage',profitCoverage:'P/L coverage',observations:'Prices',recorded:'Recorded history',limit:'Up to one year of provider history',matched:'Matched-holdings estimate; additions and removals excluded',asOf:'As of',portfolioFailed:'Portfolio could not be loaded.',failed:'Some prices could not be loaded.',auditFailed:'Some ownership history is unavailable.',fxFailed:'Some historical exchange rates are unavailable.',retry:'Retry',saleSingular:'completed sale',sales:'completed sales',excludesReversed:'Reversed sales excluded',unknown:'Unknown',partial:'Partial',stale:'Last available prices',chart:'Chart metric',reportMonth:'Reporting month',explore:'Explore chart',emptySales:'No completed sales yet.',purchaseTotals:'Recorded purchase totals, including pending copies; not confirmed payment cash.'},
he:{value:'שווי האוסף',priced:'מתומחרים',knownCost:'עלות ידועה',heldCopies:'עותקים באוסף',unrealizedRoi:'תשואה לא ממומשת',netSaleProceeds:'תמורה נטו ממכירות',soldCostBasis:'עלות קלפים שנמכרו',unrealized:'רווח לא ממומש',realized:'רווח ממומש',change:'שינוי מחירי שוק',priceHistory:'היסטוריית מחירים',recent:'רכישות אחרונות',seeAll:'הכול',paid:'עלות',month:'החודש',spend:'סכום הרכישות',copies:'עותקים שנרכשו',transactions:'לעסקאות',top:'הקלפים היקרים באוסף',loading:'טוען את התיק…',signIn:'התחבר דרך ההגדרות כדי לראות את התיק שלך.',emptyRecent:'עדיין אין רכישות.',emptyTop:'עדיין אין עותקים שהתקבלו עם מחיר שוק.',emptyChart:'לציור הגרף נדרשות לפחות שתי הערכות שווי יומיות מלאות.',estimated:'שווי שוק משוער',costCoverage:'כיסוי עלויות',profitCoverage:'כיסוי רווח',observations:'מחירים',recorded:'היסטוריה מתועדת',limit:'עד שנת היסטוריה מהספק',matched:'אומדן לקלפים משותפים; ללא השפעת הוספות והסרות',asOf:'נכון ל־',portfolioFailed:'לא ניתן לטעון את התיק.',failed:'חלק מהמחירים לא נטענו.',auditFailed:'חלק מהיסטוריית הבעלות לא זמין.',fxFailed:'חלק משערי ההמרה ההיסטוריים לא זמין.',retry:'ניסיון נוסף',saleSingular:'מכירה שהושלמה',sales:'מכירות שהושלמו',excludesReversed:'ללא מכירות שבוטלו',unknown:'לא ידוע',partial:'חלקי',stale:'מחירים אחרונים זמינים',chart:'מדד הגרף',reportMonth:'חודש לתצוגה',explore:'בדיקת הגרף',emptySales:'עדיין אין מכירות שהושלמו.',purchaseTotals:'סכומי עסקאות רכישה, כולל עותקים בדרך; אין הנחה שהתשלום בוצע.'}};

export function DashboardPage(){
 const {i18n}=useTranslation(),he=i18n.language==='he',t=he?text.he:text.en;
 const now=new Date(),currentMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 const [month,setMonth]=useState(currentMonth),[period,setPeriod]=useState<Period>('3M'),[mode,setMode]=useState<Mode>('value');
 const data=useDashboard(month),navigate=useNavigate(),id=useId();
 const result=data.result,connected=data.preview||!!data.owner;
 const format=(minor:number|null|undefined,signed=false,cents=false)=>minor==null?'—':new Intl.NumberFormat(he?'he-IL':'en-US',{style:'currency',currency:data.currency,minimumFractionDigits:cents?2:0,maximumFractionDigits:2,...(signed?{signDisplay:'always' as const}:{})}).format(minor/100);
 const metric=(v:Metric|undefined,cents=false)=>v&&v.status!=='unavailable'?format(v.minor,false,cents):'—';
 const visible=(v:Total|undefined)=>connected&&!data.loading&&!data.error&&v?v.minor:null;
 const visibleComplete=(v:Total|undefined)=>v&&v.covered===v.total?visible(v):null;
 const allSearch=data.preview?'?transactions=sample':'';
 const openHistory=()=>{void navigate(`/transactions/history${allSearch}`);};
 const card=(copy:CardCopy)=>{const ref=copy.catalog;return ref.kind==='identified'?catalogCards.find(c=>c.id===ref.cardId):undefined;};
 const openPurchase=(copy:CardCopy)=>{if(copy.acquisition.kind==='purchase'){const params=new URLSearchParams(data.preview?{transactions:'sample'}:{});params.set('copy',copy.id);void navigate(`/transactions/purchases/${copy.acquisition.transactionId}?${params}`);}};
 const openHolding=(copy:CardCopy)=>{const params=new URLSearchParams(data.preview?{transactions:'sample'}:{});params.set('copy',copy.id);void navigate(`/collection/cards?${params}`);};
 const today=new Date().toISOString().slice(0,10),days=period==='1M'?30:period==='3M'?90:365;
 const from=new Date(Date.parse(`${today}T00:00:00Z`)-days*86400_000).toISOString().slice(0,10);
 const selected=(result?.points??[]).filter(p=>p.date>=from);
 const graph=chartPoints(selected,mode==='change');
 const changed=latestAvailableChange(graph);
 const big=mode==='change'?connected&&!data.loading&&changed?`${changed.value>=0?'+':''}${changed.value.toFixed(2)}%`:'—':format(visible(mode==='realized'?result?.realized:result?.value),mode==='realized');
 const coverage=mode==='realized'?result?.realized:result?.value;
 const isReady=connected&&!data.loading&&!data.error&&result!==null;
 const profit=result?.unrealized.minor;
 const profitTone=profit==null?'':profit<0?'dashboard-negative':'dashboard-positive';
 const roi=isReady&&result?result.roi:null;
 const roiText=roi===null?'—':`${roi>=0?'+':''}${roi.toFixed(1)}%`;
 const leftMetric=mode==='value'
  ?{label:t.knownCost,value:format(visible(result?.knownCost)),icon:LuWallet,tone:'dashboard-wallet'}
  :mode==='change'
   ?{label:t.unrealized,value:format(visible(result?.unrealized),true),icon:LuTrendingUp,tone:profitTone}
   :{label:t.netSaleProceeds,value:format(visibleComplete(result?.realizedProceeds)),icon:LuWallet,tone:'dashboard-wallet'};
 const rightMetric=mode==='value'
  ?{label:t.heldCopies,value:isReady&&result?String(result.holdings.length):'—',icon:LuLayers,tone:'dashboard-wallet'}
  :mode==='change'
   ?{label:t.unrealizedRoi,value:roiText,icon:LuChartNoAxesCombined,tone:roi===null?'':roi<0?'dashboard-negative':'dashboard-positive'}
   :{label:t.soldCostBasis,value:format(visibleComplete(result?.soldCostBasis)),icon:LuTag,tone:'dashboard-wallet'};
 const LeftIcon=leftMetric.icon,RightIcon=rightMetric.icon;
 return <article className="dashboard" aria-label={he?'דשבורד':'Dashboard'}>
  <div className="dashboard-banner" aria-hidden="true"><svg viewBox="226 160 486 92" preserveAspectRatio="xMidYMid slice"><image href={reference} width="1536" height="1024" /></svg></div>
  <Card className="dashboard-value" aria-labelledby={`${id}-value`}>
   <div className="dashboard-value-heading"><div><h2 id={`${id}-value`}>{mode==='realized'?t.realized:mode==='change'?t.change:t.value}</h2><span className="dashboard-coverage">{mode==='change'?t.priceHistory:mode==='realized'?`${coverage?.total??0} ${(coverage?.total??0)===1?t.saleSingular:t.sales}`:`${coverage?.total?Math.round(coverage.covered/coverage.total*100):0}% ${t.priced}`}</span></div>
    <label className="dashboard-icon-control"><LuChartNoAxesCombined aria-hidden /><LuChevronDown aria-hidden className="dashboard-chevron" /><select aria-label={t.chart} value={mode} onChange={e=>setMode(e.target.value as Mode)}><option value="value">{t.value}</option><option value="change">{t.change}</option><option value="realized">{t.realized}</option></select></label>
   </div>
   <bdi className={`dashboard-big ${mode==='realized'&&result?.realized.minor!=null?(result.realized.minor<0?'dashboard-negative':'dashboard-positive'):''}`}>{big}</bdi>
   {mode==='realized'?<div className="dashboard-chart-empty">{result?.realized.total?`${result.realized.covered}/${result.realized.total} ${t.sales} · ${t.excludesReversed}`:t.emptySales}</div>:<ValueChart key={`${mode}-${period}`} points={graph} label={mode==='change'?t.change:t.value} format={v=>mode==='change'?`${v>=0?'+':''}${v.toFixed(2)}%`:format(v)} empty={data.error?t.portfolioFailed:data.loading?t.loading:!connected?t.signIn:t.emptyChart} explore={t.explore} />}
   <div key={mode} className="dashboard-kpis dashboard-metric-kpis"><div><LeftIcon aria-hidden className={leftMetric.tone} /><span><span className="dashboard-stat-label">{leftMetric.label}</span><bdi className={mode==='change'?profitTone:''}>{leftMetric.value}</bdi></span></div><div><RightIcon aria-hidden className={rightMetric.tone} /><span><span className="dashboard-stat-label">{rightMetric.label}</span><bdi className={mode==='change'?rightMetric.tone:''}>{rightMetric.value}</bdi></span></div></div>
   <div className="dashboard-periods" role="group" aria-label={he?'תקופת הגרף':'Chart period'}>{(['1M','3M','1Y','All'] as const).map(p=><button key={p} type="button" aria-pressed={period===p} onClick={()=>setPeriod(p)}>{p==='All'&&he?'הכול':p}</button>)}</div>
  </Card>
  <section className="dashboard-recent" aria-labelledby={`${id}-recent`}><div className="dashboard-section-heading"><h2 id={`${id}-recent`}>{t.recent}</h2><button type="button" onClick={openHistory}>{t.seeAll}<LuChevronRight aria-hidden /></button></div>
   {result?.recent.length&&connected?<div className="dashboard-acquisitions">{result.recent.map(({copy,paid})=>{const c=card(copy);return <button type="button" key={copy.id} data-copy-id={copy.id} onClick={()=>openPurchase(copy)}><PokemonArt src={c?.imageUrl} alt={c?.name??t.unknown} size="zoom" className="dashboard-acquisition-art" /><span>{t.paid}: <bdi>{metric(paid,true)}</bdi></span><span className="sr-only">{copy.id}</span></button>;})}</div>:<p className="dashboard-empty">{data.error?t.portfolioFailed:data.loading?t.loading:t.emptyRecent}</p>}
  </section>
  <Card className="dashboard-month" aria-labelledby={`${id}-month`}><div className="dashboard-month-heading"><LuCalendarDays aria-hidden /><h2 id={`${id}-month`}>{month===currentMonth?t.month:new Intl.DateTimeFormat(he?'he-IL':'en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`))}</h2><label className="dashboard-icon-control"><LuCalendarDays aria-hidden /><LuChevronDown aria-hidden className="dashboard-chevron" /><input type="month" aria-label={t.reportMonth} value={month} max={currentMonth} onChange={e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))setMonth(e.target.value);}} /></label></div>
   <div className="dashboard-kpis"><div><LuTag aria-hidden className="text-amber-500" /><span><span className="dashboard-stat-label" title={t.purchaseTotals}>{t.spend}</span><bdi>{format(visible(result?.month.spend))}</bdi></span></div><div><LuLayers aria-hidden className="text-sky-500" /><span><span className="dashboard-stat-label">{t.copies}</span><bdi>{connected&&!data.loading?result?.month.copies??'—':'—'}</bdi></span></div></div>
   {result?.month.spend.covered!==result?.month.spend.total&&<p className="dashboard-note">{t.partial}: {result?.month.spend.covered}/{result?.month.spend.total}</p>}
   <button type="button" className="dashboard-month-link" onClick={openHistory}>{t.transactions}<LuChevronRight aria-hidden /></button>
  </Card>
  <section aria-labelledby={`${id}-top`}><div className="dashboard-section-heading"><h2 id={`${id}-top`}>{t.top}</h2><button type="button" onClick={()=>{void navigate(`/collection/cards${allSearch}`);}}>{t.seeAll}<LuChevronRight aria-hidden /></button></div>
   <Card className="dashboard-holdings">{result?.top.length&&connected?<ul>{result.top.map(({copy,market})=>{const c=card(copy);return <li key={copy.id}><button type="button" onClick={()=>openHolding(copy)} data-copy-id={copy.id}><PokemonArt src={c?.imageUrl} alt={c?.name??t.unknown} className="dashboard-holding-art" /><span className="dashboard-holding-name"><strong>{c?.name??t.unknown}</strong><span>{c?.setName} · #{c?.number}</span></span><bdi>{metric(market)}</bdi><LuChevronRight aria-hidden /><span className="sr-only">{copy.id}</span></button></li>;})}</ul>:<p className="dashboard-empty">{data.error?t.portfolioFailed:data.loading?t.loading:t.emptyTop}</p>}</Card>
  </section>
  {!connected&&<Button variant="outline" onClick={()=>{void navigate('/settings');}}>{he?'להתחברות':'Sign in'}</Button>}
 </article>;
}

type ChartPoint={date:string;value:number|null};
function chartPoints(points:readonly PerformancePoint[],change:boolean):ChartPoint[]{
 let index=100,broken=false,started=false;
 return points.map((p,i)=>{
  const complete=p.unknownHistory===0&&p.held>0&&p.value.covered===p.value.total&&p.value.minor!==null;
  if(!change)return {date:p.date,value:complete?p.value.minor:null};
  if(!started){if(!complete)return {date:p.date,value:null};started=true;return {date:p.date,value:0};}
  if(!complete || i>0&&p.matchedChange===null)broken=true;
  if(broken)return {date:p.date,value:null};
  if(i>0)index*=1+p.matchedChange!/100;
  return {date:p.date,value:index-100};
 });
}
function ValueChart({points,label,format,empty,explore}:{points:ChartPoint[];label:string;format:(v:number)=>string;empty:string;explore:string}){
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
