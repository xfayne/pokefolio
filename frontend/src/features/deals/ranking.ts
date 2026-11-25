import type { DealItem, Grade } from './scan';
export type Evaluation = {grade:Grade; source:string; allIn:number|null; market:number|null; discount:number|null; hours:number|null; group:number; score:number};
/** Port of legacy evaluation, with shipping and market in the same currency. */
export function evaluate(item:DealItem,market:number|null,current:number|null,shipping:number|null,now:number,override?:Grade):Evaluation{
  const grade=override??item.conditionGrade??'MP';
  const source=override?'user':item.conditionSource;
  const allIn=current!==null&&shipping!==null?current+shipping:null;
  const discount=market!==null&&market>0&&allIn!==null&&item.verificationStatus==='strong'?(market-allIn)/market:null;
  const hours=item.format==='AUCTION'&&item.endTime&&Number.isFinite(Date.parse(item.endTime))?(Date.parse(item.endTime)-now)/3600000:null;
  const reliable=item.verificationStatus==='strong'&&discount!==null&&item.matchConfidence>=70&&source!=='unknown'&&!/\b(?:damaged|creased|folded|poor condition|lot|bundle)\b/i.test(item.title);
  let group=4;
  if(reliable&&discount>=.20&&(item.format==='FIXED_PRICE'||hours!==null&&hours>=0&&hours<=6))group=0;
  else if(reliable&&discount>=.15&&(item.format==='FIXED_PRICE'||hours!==null&&hours>=0&&hours<=24))group=1;
  else if(item.verificationStatus!=='strong')group=5;
  else if(discount!==null&&discount<=0)group=4;
  else if(discount!==null&&discount>0&&source!=='unknown')group=2;
  else if(allIn===null||source==='unknown'||discount===null)group=3;
  const score=(discount??-1)*100+(item.format==='FIXED_PRICE'?20:hours!==null&&hours<=6?18:hours!==null&&hours<=24?9:0)+item.matchConfidence/20;
  return {grade,source,allIn,market,discount,hours,group,score};
}
export const compareRecommended=(a:Evaluation,b:Evaluation)=>a.group-b.group||b.score-a.score;
