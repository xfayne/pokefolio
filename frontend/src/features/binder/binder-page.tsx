import { CatalogSearch } from '@/features/catalog/catalog-search';
import { BinderPicker, eligibleBinderCopies } from './binder-picker';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LuShare2, LuArrowUpDown, LuBookOpen, LuPlus, LuCopy, LuLink2Off } from 'react-icons/lu';
import { usePortfolio } from '@/hooks/use-portfolio';
import { getFirebaseServices } from '@/services/firebase';
import { catalogCards } from '@/features/catalog/catalog';
import { createSampleCopies, sampleOwner } from '@/features/inventory/sample';
import { PortfolioStatus } from '@/features/portfolio-status';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { BinderPocket } from '@/domain/inventory';
import type { CardCopy } from '@/domain/schema';
import { BinderBook, type VisualPocket } from './binder-book';
import { emptyBinder, pageCount, placePocket, pocketKey, reservePocket, removePocket, unplacePocket, movePage, insertEmptyPage, capacity, type Binder } from './model';
import { readBinder, saveBinder, readSharing, publishBinder, disableSharing } from './storage';
import './binder.css';

const cards=new Map(catalogCards.map(c=>[c.id,c]));
function visualPockets(binder:Binder,copies:readonly CardCopy[]): VisualPocket[] {
  const byId=new Map(copies.filter(c=>c.ownerUid===binder.ownerUid).map(c=>[c.id,c]));
  return binder.pockets.map(p=>{
    if(p.kind==='empty') return {key:pocketKey(p),kind:'empty',card:null};
    if(p.kind==='wish') return {key:pocketKey(p),kind:'wish',card:cards.get(p.cardId) ?? null};
    const copy=byId.get(p.copyId);
    return {key:pocketKey(p),card:copy?.catalog.kind==='identified'?cards.get(copy.catalog.cardId) ?? null:null,
      kind:!copy || copy.disposition!=='held'?'unavailable':copy.possession==='received'?'owned':copy.possession==='pending'?'pending':'unknown'};
  });
}
const sampleCopies=(): CardCopy[]=>{
  const original=createSampleCopies();
  const reference=original[0]!.catalog; if(reference.kind!=='identified') throw Error('Invalid sample reference');
  const ids=['base5-4','base3-2','base3-4','base3-3','base2-1','base1-2','base1-15','neo1-9','neo1-18','gym2-12','basep-9'];
  return [...original,{...original[0]!,id:'picker-sample',catalog:{...reference,cardId:'base1-58'}},...ids.map((cardId,i)=>({...original[0]!,id:`binder-sample-${i}`,catalog:{...reference,kind:'identified' as const,cardId,edition:'unlimited' as const}}))];
};
function sampleBinder(): Binder {
  const pockets:BinderPocket[]=sampleCopies().filter(c=>c.id!=='picker-sample').map(c=>({kind:'copy',copyId:c.id}));
  pockets.splice(7,0,{kind:'wish',cardId:'neo2-13'},{kind:'empty',token:'sample-gap'});
  pockets.push({kind:'wish',cardId:'neo2-1'});
  return {...emptyBinder(sampleOwner),pockets};
}
function savedPage(key:string) {try { const n=Number(sessionStorage.getItem(key));return Number.isSafeInteger(n)&&n>=0?n:0; }catch{return 0;} }
export function BinderPage() {
  const account=usePortfolio(),client=useQueryClient();
  const [params,setParams]=useSearchParams();
  const preview=params.get('inventory')==='sample';
  const owner=preview?sampleOwner:account.owner;
  const copies=preview?sampleCopies():account.history.copies;
  const key=['binder',preview?'sample':'account',owner];
  const query=useQuery({queryKey:key,enabled:!!owner,queryFn:()=>preview?Promise.resolve(sampleBinder()):readBinder(getFirebaseServices()!.db,owner!),retry:1,staleTime:60_000});
  const binder=query.data ?? emptyBinder(owner ?? 'disconnected');
  // Keying the view by owner prevents drafts or navigation leaking across accounts.
  return <BinderView key={`${preview?'sample':'account'}:${owner ?? ''}`} binder={binder} copies={copies} preview={preview} disconnected={!owner}
    loading={!preview && account.loading || !!owner && query.isPending} error={!preview && account.error || query.error}
    reload={()=>{void query.refetch();}} onDemo={()=>{const next=new URLSearchParams(params);next.set('inventory','sample');setParams(next);}}
    onSave={async next=>{
      if(!owner) throw Error('Sign in before saving');
      if(!preview && getFirebaseServices()?.auth.currentUser?.uid!==owner) throw Error('Account changed');
      const saved=preview?{...next,revision:binder.revision+1}:await saveBinder(getFirebaseServices()!.db,owner,binder,next);
      client.setQueryData(key,saved);
    }} />;
}
function BinderView({binder,copies,preview,disconnected,loading,error,reload,onDemo,onSave}: {
  binder:Binder;copies:readonly CardCopy[];preview:boolean;disconnected:boolean;loading:boolean;error:unknown;
  reload:()=>void;onDemo:()=>void;onSave:(next:Binder)=>Promise<void>;
}) {
  const {t}=useTranslation();
  const pageKey=`pokefolio:binder-page:${preview?'sample':binder.ownerUid}`;
  const [page,setPage]=useState(()=>savedPage(pageKey));
  const [panel,setPanel]=useState<'options'|'arrange'|'page'|'share'|'reader'|null>(null);
  const [emptyTarget,setEmptyTarget]=useState<number|null>(null);
  const [wishDraft,setWishDraft]=useState<{revision:number;value:boolean}|null>(null);
  const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[notice,setNotice]=useState('');
  // Show the attempted arrangement immediately; keep it until the confirmed
  // revision reaches this component. Failed writes roll back to saved pockets.
  const [pendingLayout,setPendingLayout]=useState<{fromRevision:number;next:Binder}|null>(null);
  const visibleBinder=pendingLayout && pendingLayout.fromRevision===binder.revision ? pendingLayout.next : binder;
  const current=Math.min(page,pageCount(visibleBinder.pockets)-1);
  const changePage=(next:number)=>{setPage(next);try{sessionStorage.setItem(pageKey,String(next));}catch{/* navigation remains usable */}};
  const save=async(next:Binder)=>{
    if(busy) return false;
    setPendingLayout({fromRevision:binder.revision,next});
    setBusy(true);setFailed(false);
    try {await onSave(next);setNotice(t('binderUi.saved'));return true;}
    catch {setPendingLayout(null);setFailed(true);return false;}
    finally {setBusy(false);}
  };
  const visuals=visualPockets(visibleBinder,copies);
  if(loading || error) return <PortfolioStatus loading={loading} error={error} />;
  return <section className="binder-page" aria-label={t('binderUi.label')} aria-busy={busy}>
    {disconnected && <p className="binder-message">{t('binderUi.disconnected')} <button className="underline" onClick={onDemo}>{t('binderUi.demo')}</button></p>}
    {failed && <p className="binder-error" role="alert">{t('binderUi.failed')} <button onClick={reload} className="underline">{t('binderUi.reload')}</button></p>}
    <p className="sr-only" role="status">{busy?t('binderUi.saving'):notice}</p>
    <BinderBook pockets={visuals} page={current} onPage={changePage} onOptions={!disconnected?()=>setPanel('options'):undefined} onEmpty={!disconnected?(index=>{setFailed(false);setEmptyTarget(index);}):undefined} includeWish={binder.includeWish} busy={busy} onMove={!disconnected?((from,to)=>{try{void save({...binder,pockets:placePocket(binder.pockets,binder.pockets[from]!,to)});}catch{setFailed(true);}}):undefined} onRemove={!disconnected?((from)=>{try{void save({...binder,pockets:unplacePocket(binder.pockets,from)});}catch{setFailed(true);}}):undefined} />
    {emptyTarget!==null && <BinderPicker binder={binder} copies={copies} busy={busy} failed={failed} onClose={()=>setEmptyTarget(null)} onPick={async copy=>{
      if(!eligibleBinderCopies(binder,copies).some(c=>c.id===copy.id) || (binder.pockets[emptyTarget] && binder.pockets[emptyTarget]!.kind!=='empty')){setFailed(true);return;}
      try {if(await save({...binder,pockets:placePocket(binder.pockets,{kind:'copy',copyId:copy.id},emptyTarget)}))setEmptyTarget(null);}catch{setFailed(true);}
    }} />}
    {panel==='options' && <UtilitySheet title={t('binderUi.options')} onClose={()=>setPanel(null)}><div className="binder-arrange">
      <Button variant="outline" onClick={()=>setPanel('share')}><LuShare2 aria-hidden />{t('binderUi.share')}</Button>
      <Button variant="outline" onClick={()=>setPanel('arrange')}><LuPlus aria-hidden />{t('binderUi.add')}</Button>
      <Button variant="outline" disabled={pageCount(binder.pockets)<2} onClick={()=>setPanel('page')}><LuArrowUpDown aria-hidden />{t('binderUi.movePage')}</Button>
      <Button variant="outline" disabled={busy || Math.max(binder.pockets.length,(current+1)*9)+9>capacity} onClick={()=>{
        try {
          const pockets=insertEmptyPage(binder.pockets,current);
          void save({...binder,pockets}).then(ok=>{if(ok){changePage(current+1);setPanel(null);}});
        } catch {setFailed(true);}
      }}><LuPlus aria-hidden />{t('binderUi.addPage')}</Button>
      {failed && <p role="alert" className="binder-error">{t('binderUi.failed')}</p>}
      <Button variant="outline" onClick={()=>setPanel('reader')}><LuBookOpen aria-hidden />{t('binderUi.reader')}</Button>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wishDraft?.revision===binder.revision ? wishDraft.value : binder.includeWish} disabled={busy} onChange={e=>{const value=e.target.checked;setWishDraft({revision:binder.revision,value});void save({...binder,includeWish:value}).then(ok=>{if(!ok)setWishDraft(null);});}} />{t('binderUi.includeWish')}</label>
    </div></UtilitySheet>}
    {panel==='arrange' && <ArrangeSheet binder={binder} copies={copies} current={current} busy={busy} failed={failed} onClose={()=>setPanel(null)} onSave={async(pockets,index)=>{if(await save({...binder,pockets})){changePage(Math.floor(index/9));setPanel(null);}}} />}
    {panel==='page' && <MovePageSheet count={pageCount(binder.pockets)} current={current} busy={busy} failed={failed} onClose={()=>setPanel(null)} onApply={async(from,to)=>{try{if(await save({...binder,pockets:movePage(binder.pockets,from,to)})){changePage(to);setPanel(null);}}catch{setFailed(true);}}} />}
    {panel==='reader' && <UtilitySheet title={t('binderUi.reader')} contentMode="contained" onClose={()=>setPanel(null)}><div className="binder-reader"><BinderBook pockets={visuals} page={current} onPage={changePage} reader includeWish={binder.includeWish} /></div></UtilitySheet>}
    {panel==='share' && <ShareSheet binder={binder} copies={copies} preview={preview} onClose={()=>setPanel(null)} />}
  </section>;
}
function PageSelect({label,count,value,onChange}: {label:string;count:number;value:number;onChange:(n:number)=>void}) {
  return <label className="flex flex-1 flex-col gap-1 text-sm font-bold">{label}<Select aria-label={label} value={value+1} onChange={e=>onChange(Number(e.target.value)-1)}>{Array.from({length:count},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</Select></label>;
}
function ArrangeSheet({binder,copies,current,busy,failed,onClose,onSave}: {binder:Binder;copies:readonly CardCopy[];current:number;busy:boolean;failed:boolean;onClose:()=>void;onSave:(p:BinderPocket[],index:number)=>Promise<void>}) {
  const {t}=useTranslation();
  const [mode,setMode]=useState('copy'),[query,setQuery]=useState(''),[selected,setSelected]=useState<BinderPocket|null>(null);
  const [page,setPage]=useState(current),[slot,setSlot]=useState(0),[localError,setLocalError]=useState(false);
  const source=selected?binder.pockets.findIndex(p=>pocketKey(p)===pocketKey(selected)):-1;
  const apply=()=>{try {setLocalError(false);const index=page*9+slot;void onSave(mode==='empty'?reservePocket(binder.pockets,index):placePocket(binder.pockets,selected!,index),index);}catch{setLocalError(true);}};
  if(mode==='pick-copy') return <BinderPicker moving binder={binder} copies={copies} busy={busy} failed={failed} onClose={()=>setMode('copy')} onPick={async copy=>{setSelected({kind:'copy',copyId:copy.id});setMode('copy');}} />;
  return <UtilitySheet title={t('binderUi.arrange')} onClose={busy?()=>{}:onClose}><div className="binder-arrange">
    <Select aria-label={t('binderUi.arrange')} value={mode} disabled={busy} onChange={e=>{setMode(e.target.value);setSelected(null);setQuery('');}}>
      <option value="copy">{t('binderUi.copies')}</option><option value="wish">{t('binderUi.wishes')}</option><option value="empty">{t('binderUi.reserve')}</option>
    </Select>
    {mode==='copy' && !selected && <Button variant="outline" onClick={()=>setMode('pick-copy')}>{t('binderUi.chooseCopy')}</Button>}
    
    {mode==='wish' && !selected && <div className="h-96 min-h-0"><CatalogSearch query={query} onQuery={setQuery} onSelect={card=>setSelected({kind:'wish',cardId:card.id})} /></div>}
    {selected && <p className="text-sm font-bold">{selected.kind==='copy'?copies.find(c=>c.id===selected.copyId)?.catalog.kind==='identified' ? cards.get((copies.find(c=>c.id===selected.copyId)!.catalog as {cardId:string}).cardId)?.name : selected.copyId:selected.kind==='wish'?cards.get(selected.cardId)?.name:''}</p>}
    <div className="flex gap-3"><PageSelect label={t('binderUi.targetPage')} count={pageCount(binder.pockets)} value={page} onChange={setPage} /><PageSelect label={t('binderUi.targetSlot')} count={9} value={slot} onChange={setSlot} /></div>
    {(failed||localError) && <p role="alert" className="binder-error">{t('binderUi.failed')}</p>}
    <Button disabled={busy || mode!=='empty'&&!selected} onClick={apply}>{t(busy?'binderUi.saving':'binderUi.apply')}</Button>
    {source>=0 && <Button variant="outline" disabled={busy} onClick={()=>{void onSave(removePocket(binder.pockets,source),Math.min(source,Math.max(0,binder.pockets.length-2)));}}>{t('binderUi.remove')}</Button>}
    {mode==='empty'&&binder.pockets[page*9+slot]?.kind==='empty'&&<Button variant="outline" disabled={busy} onClick={()=>{void onSave(removePocket(binder.pockets,page*9+slot),page*9+slot);}}>{t('binderUi.clear')}</Button>}
  </div></UtilitySheet>;
}
function MovePageSheet({count,current,busy,failed,onClose,onApply}: {count:number;current:number;busy:boolean;failed:boolean;onClose:()=>void;onApply:(from:number,to:number)=>Promise<void>}) {
  const {t}=useTranslation();const [from,setFrom]=useState(current),[to,setTo]=useState(current);
  return <UtilitySheet title={t('binderUi.movePage')} onClose={busy?()=>{}:onClose}><div className="binder-arrange"><div className="flex gap-3"><PageSelect label={t('binderUi.sourcePage')} count={count} value={from} onChange={setFrom} /><PageSelect label={t('binderUi.targetPage')} count={count} value={to} onChange={setTo} /></div>{failed&&<p role="alert" className="binder-error">{t('binderUi.failed')}</p>}<Button disabled={busy||from===to} onClick={()=>{void onApply(from,to);}}>{t(busy?'binderUi.saving':'binderUi.apply')}</Button></div></UtilitySheet>;
}
function ShareSheet({binder,copies,preview,onClose}: {binder:Binder;copies:readonly CardCopy[];preview:boolean;onClose:()=>void}) {
  const {t}=useTranslation();const [busy,setBusy]=useState(false),[error,setError]=useState(false),[copied,setCopied]=useState(false);
  const client=useQueryClient();const key=['binder-sharing',binder.ownerUid];
  const query=useQuery({queryKey:key,enabled:!preview,queryFn:()=>readSharing(getFirebaseServices()!.db,binder.ownerUid),retry:1});
  const shareId=query.data;
  const link=shareId?`${location.origin}${location.pathname}#/binder/share/${shareId}`:'';
  const action=async(disable=false)=>{
    if(getFirebaseServices()?.auth.currentUser?.uid!==binder.ownerUid)return;
    setBusy(true);setError(false);
    try {const id=shareId ?? crypto.randomUUID();if(disable)await disableSharing(getFirebaseServices()!.db,binder.ownerUid,id,binder.includeWish);else await publishBinder(getFirebaseServices()!.db,binder,copies,id);client.setQueryData(key,disable?null:id);}
    catch{setError(true);}finally{setBusy(false);}
  };
  return <UtilitySheet title={t('binderUi.share')} onClose={busy?()=>{}:onClose}><div className="binder-arrange"><p className="binder-message">{t('binderUi.shareHint')}</p>
    <Button disabled={preview||busy||query.isPending||!!query.error} onClick={()=>{void action();}}>{t(busy?'binderUi.saving':'binderUi.publish')}</Button>
    {preview&&<p className="binder-message">{t('inventory.sampleNotice')}</p>}
    {!!shareId&&<><a className="break-all text-sm text-blue-700 underline" href={link} target="_blank" rel="noreferrer">{link}</a><Button variant="outline" onClick={()=>{void navigator.clipboard.writeText(link).then(()=>setCopied(true)).catch(()=>setError(true));}}><LuCopy aria-hidden />{t(copied?'binderUi.copied':'binderUi.copyLink')}</Button><Button variant="outline" disabled={busy} onClick={()=>{void action(true);}}><LuLink2Off aria-hidden />{t('binderUi.stopShare')}</Button></>}
    {(error||query.error)&&<p className="binder-error" role="alert">{t('binderUi.shareFailed')} <button className="underline" onClick={()=>{void query.refetch();}}>{t('reload')}</button></p>}
  </div></UtilitySheet>;
}
