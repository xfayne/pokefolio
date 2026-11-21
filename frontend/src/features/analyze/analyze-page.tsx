import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { LuCamera, LuCheck, LuImagePlus, LuLoaderCircle, LuPlus, LuScanLine, LuX, LuZoomIn } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { DisclosureButton, DisclosureContent } from '@/components/ui/disclosure';
import { useAuth } from '@/hooks/use-auth';
import { PokedexFrame } from './pokedex-frame';
import { grades, readAnalysis, resolveListing, runAnalysis, saveAnalysis, type AnalysisResult, type Listing } from './analysis-service';
import { preparePhoto } from './prepare-photo';
import './analyze.css';

type Photo={url:string;blob?:Blob;slot:'front'|'back'|'closeup'|'listing'};
type Task='idle'|'preparing'|'loading'|'busy'|'saving';
export function AnalyzePage() {
  const auth=useAuth();
  // Changing accounts discards private in-memory photos/results immediately.
  return <Analyzer key={auth.user?.uid ?? 'signed-out'} owner={auth.user?.uid ?? null} />;
}
function Analyzer({owner}:{owner:string|null}) {
  const {t}=useTranslation(); const a=(key:string,options:Record<string,unknown>={})=>t(`analyzer.${key}`,options);
  const [mode,setMode]=useState<'photos'|'ebay'>('photos');
  const [photos,setPhotos]=useState<Photo[]>([]);const photosRef=useRef<Photo[]>([]);
  const [listing,setListing]=useState<Listing|null>(null);const [url,setUrl]=useState('');
  const [result,setResult]=useState<AnalysisResult|null>(null);const [cached,setCached]=useState(false);
  const [task,setTask]=useState<Task>('idle');const [error,setError]=useState('');const [saveFailed,setSaveFailed]=useState(false);
  const [expanded,setExpanded]=useState(false);const [zoom,setZoom]=useState<number|null>(null);const [highlight,setHighlight]=useState<number|null>(null);
  const controller=useRef<AbortController|null>(null);const serial=useRef(0);
  const files=useRef<HTMLInputElement>(null);const camera=useRef<HTMLInputElement>(null);const slot=useRef<Photo['slot']>('closeup');
  const busy=task!=='idle';
  useEffect(()=>()=>{serial.current++;controller.current?.abort();photosRef.current.forEach(p=>{if(p.blob)URL.revokeObjectURL(p.url);});},[]);
  function replacePhotos(next:Photo[]) {
    photosRef.current.forEach(p=>{if(p.blob && !next.includes(p))URL.revokeObjectURL(p.url);});photosRef.current=next;setPhotos(next);
  }
  function clearResult(){setResult(null);setCached(false);setSaveFailed(false);setError('');setExpanded(false);setZoom(null);setHighlight(null);}
  function reset(){serial.current++;controller.current?.abort();replacePhotos([]);setListing(null);clearResult();setTask('idle');}
  function start(next:Task){controller.current?.abort();const c=new AbortController();controller.current=c;const id=++serial.current;setTask(next);setError('');return {id,signal:c.signal};}
  function fail(e:unknown) {
    const code=isAxiosError(e)?String(e.response?.data?.error ?? e.code):e instanceof Error?e.message:'';
    setError(code==='AI_AUTH_REQUIRED'?a('authError'):code==='CACHE_UNAVAILABLE'?a('cacheError'):code.startsWith('EBAY_')?a('linkError'):/IMAGE|PHOTO|UPLOAD/.test(code)?a('imageError'):/PROVIDER|RATE_LIMIT|WAIT_BEFORE|CONFIGURED/.test(code)?a('providerError'):a('error'));
  }
  function pick(target:Photo['slot'],capture=false){slot.current=target;(capture?camera:files).current?.click();}
  async function addPhotos(event:ChangeEvent<HTMLInputElement>) {
    const incoming=Array.from(event.target.files??[]);event.target.value='';if(!incoming.length||busy)return;
    const target=slot.current;
    const retained=target==='closeup'?photos:photos.filter(p=>p.slot!==target);
    if(retained.length+incoming.length>8){setError(a('countError'));return;}
    const {id}=start('preparing');
    try {
      const blobs:Blob[]=[];for(const file of incoming)blobs.push(await preparePhoto(file));
      if(id!==serial.current)return;
      clearResult();replacePhotos([...retained,...blobs.map((blob,i)=>({blob,url:URL.createObjectURL(blob),slot:i===0?target:'closeup' as const}))]);
    }catch(e){if(id===serial.current)fail(e);}finally{if(id===serial.current)setTask('idle');}
  }
  async function loadListing() {
    if(!owner||busy)return; const {id,signal}=start('loading');replacePhotos([]);setListing(null);setResult(null);setSaveFailed(false);setCached(false);setExpanded(false);
    try {const data=await resolveListing(owner,url.trim(),signal);if(id!==serial.current)return;setListing(data);replacePhotos(data.images.map(url=>({url,slot:'listing'})));}
    catch(e){if(id===serial.current)fail(e);}finally{if(id===serial.current)setTask('idle');}
  }
  async function analyze(force=false) {
    if(!owner || !photos.length || busy)return;const {id,signal}=start('busy');setSaveFailed(false);
    try {
      if(result&&!force){setCached(true);return;}
      if(listing&&!force){
        let saved:AnalysisResult|null;
        try{saved=await readAnalysis(owner,listing.source);}catch{throw Error('CACHE_UNAVAILABLE');}
        if(id!==serial.current)return;
        if(saved){setResult(saved);setCached(true);return;}
      }
      const data=await runAnalysis(owner,listing?listing.source:photos.map(p=>p.blob!),signal);
      if(id!==serial.current)return;setResult(data);setCached(false);
      if(listing){try{await saveAnalysis(owner,listing.source,data);}catch{if(id===serial.current)setSaveFailed(true);}}
    }catch(e){if(id===serial.current)fail(e);}finally{if(id===serial.current)setTask('idle');}
  }
  async function retrySave() {
    if(!owner||!listing||!result||busy)return;const {id}=start('saving');
    try{await saveAnalysis(owner,listing.source,result);if(id===serial.current)setSaveFailed(false);}
    catch(e){if(id===serial.current)fail(e);}finally{if(id===serial.current)setTask('idle');}
  }
  function photoView(photo:Photo,i:number,large=false) {
    const markers=result?.analysis.observations.flatMap((finding,n)=>finding.locations.filter(loc=>loc.photoIndex===i+1).map((loc,j)=>({loc,n,j})))??[];
    return <div className={`analysis-photo ${large?'analysis-photo-large':''}`}>
      <img src={photo.url} alt={a('photo',{number:i+1})} />
      <svg className="analysis-markers" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden>
        {markers.map(({loc,n,j})=>{const [y,x,y2,x2]=loc.box2d;return <g key={`${n}-${j}`} className={highlight===n?'is-highlighted':''}><rect x={x} y={y} width={x2-x} height={y2-y} /><svg x={Math.max(0,Math.min(910,x))} y={Math.max(0,Math.min(910,y))} width="90" height="90" viewBox="0 0 40 40" preserveAspectRatio="xMidYMid meet"><circle cx="20" cy="20" r="17"/><text x="20" y="26" textAnchor="middle">{n+1}</text></svg></g>;})}
      </svg>
    </div>;
  }
  return <PokedexFrame status={task==='busy'?'busy':error?'error':result?'complete':'idle'}>
    <input ref={files} type="file" accept="image/*" multiple hidden onChange={e=>void addPhotos(e)} />
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e=>void addPhotos(e)} />
    {!result?<>
      <h1 className="analyzer-pixel analyzer-title">{a('title')}</h1><p className="analyzer-intro">{a('intro')}</p>
      <div className="analyzer-modes" role="group" aria-label={a('title')}>{(['photos','ebay'] as const).map(m=><button key={m} type="button" aria-pressed={mode===m} disabled={busy} onClick={()=>{reset();setMode(m);}}>{a(m)}</button>)}</div>
      {mode==='photos'?<>
        <div className="analyzer-upload-grid">{(['front','back'] as const).map(side=>{
          const photo=photos.find(p=>p.slot===side);
          return <div className="analyzer-upload" key={side}><strong>{a(side)}</strong>{photo?<button type="button" disabled={busy} className="analyzer-slot-preview" onClick={()=>pick(side)} aria-label={`${a(side)} · ${a('add')}`}><img src={photo.url} alt={a(side)} /></button>:<LuCamera aria-hidden className="analyzer-camera" />}<div className="analyzer-pick"><button type="button" disabled={busy} onClick={()=>pick(side,true)} aria-label={`${a(side)} · ${a('camera')}`}><LuCamera aria-hidden />{a('camera')}</button><button type="button" disabled={busy} onClick={()=>pick(side)} aria-label={`${a(side)} · ${a('files')}`}><LuImagePlus aria-hidden />{a('files')}</button></div></div>;
        })}</div>
        <Button variant="outline" className="analyzer-closeup" disabled={busy||photos.length>=8} onClick={()=>pick('closeup')}><LuPlus aria-hidden />{a('closeup')}</Button>
        <p className="analyzer-hint">{a('hint')}</p>
      </>:<form className="analyzer-ebay" onSubmit={e=>{e.preventDefault();void loadListing();}}><label htmlFor="analysis-ebay-url">{a('url')}</label><input id="analysis-ebay-url" type="url" dir="ltr" maxLength={750} required value={url} disabled={busy} onChange={e=>setUrl(e.target.value)} placeholder="https://www.ebay.com/itm/…"/><Button disabled={!owner||busy||!url.trim()}>{a('load')}</Button>{listing&&<a href={listing.url} target="_blank" rel="noopener noreferrer">{listing.title} ↗</a>}</form>}
      {!!photos.length&&<div className="analyzer-thumbs">{photos.map((photo,i)=><div key={photo.url}><button type="button" onClick={()=>setZoom(i)} aria-label={a('zoom',{number:i+1})}><img src={photo.url} alt={a('photo',{number:i+1})}/></button>{mode==='photos'&&<button className="analyzer-remove" type="button" disabled={busy} onClick={()=>{replacePhotos(photos.filter((_,n)=>n!==i));clearResult();}} aria-label={a('remove',{number:i+1})}><LuX aria-hidden /></button>}</div>)}</div>}
      <Button className="analyzer-run analyzer-pixel" disabled={!owner||!photos.length||busy} onClick={()=>void analyze(error===a('cacheError'))}>{busy?<LuLoaderCircle className="analyzer-spin" aria-hidden/>:<LuScanLine aria-hidden/>}{a(task==='busy'?'busy':'run')}</Button>
      {!photos.length&&!busy&&<p className="analyzer-hint">{a('empty')}</p>}
    </>:<>
      <h1 className="analyzer-pixel analyzer-title analyzer-complete"><LuCheck aria-hidden/>{a('complete')}</h1>
      <div className="analyzer-grade analyzer-pixel" dir="auto">{result.analysis.grade} — {a(result.analysis.grade)}</div>
      <div className="analyzer-confidence"><span>{a('confidence',{value:result.analysis.confidencePercent})}</span><span>{a('estimate')}</span></div>
      {cached&&<p className="analyzer-hint">{a('saved')}</p>}
      {result.analyzedPhotoIndices.length<photos.length&&<p className="analyzer-hint">{a('coverage',{count:result.analyzedPhotoIndices.length,total:photos.length})}</p>}
      <div className="analyzer-gallery">{photos.map((photo,i)=><button type="button" key={photo.url} onClick={()=>setZoom(i)} aria-label={a('zoom',{number:i+1})}>{photoView(photo,i)}<span className="analyzer-photo-number">{i+1}</span><LuZoomIn aria-hidden className="analyzer-zoom"/></button>)}</div>
      <h2 className="analyzer-pixel analyzer-subtitle">{a('wear')}</h2>
      <div className="analyzer-findings">{result.analysis.observations.length?result.analysis.observations.map((finding,i)=>{
        const loc=finding.locations.find(l=>l.photoIndex<=photos.length);
        return <button key={i} type="button" disabled={!loc} onClick={()=>{if(loc){setHighlight(i);setZoom(loc.photoIndex-1);}}}><span>{i+1}</span><div>{finding.finding}{!loc&&<small>{a('unlocated')}</small>}</div></button>;
      }):<p>{a('none')}</p>}</div>
      <DisclosureButton open={expanded} contentId="analysis-details" onClick={()=>setExpanded(v=>!v)}>{a('limits')}</DisclosureButton>
      <DisclosureContent id="analysis-details" open={expanded}><div className="analyzer-breakdown">{grades.map(g=><div key={g}><span>{g}</span><meter min="0" max="100" value={result.analysis.gradePercentages[g]} aria-label={a(g)}/><span>{result.analysis.gradePercentages[g]}%</span></div>)}{result.analysis.limitations.map((limit,i)=><p key={i}>{limit}</p>)}</div></DisclosureContent>
      <p className="analyzer-hint">{a('disclaimer')}</p>
      {saveFailed&&<div className="analyzer-error" role="status"><p>{a('saveFailed')}</p><Button variant="outline" disabled={busy} onClick={()=>void retrySave()}>{a('retrySave')}</Button></div>}
      <Button className="analyzer-run analyzer-pixel" disabled={busy} onClick={reset}>{a('new')}</Button>
      <button type="button" className="analyzer-again" disabled={busy} onClick={()=>void analyze(true)}>{a('again')}</button>
    </>}
    {!owner&&<p className="analyzer-hint">{a('signIn')}</p>}
    <div role="status" aria-live="polite" className="analyzer-status">{busy&&<><LuLoaderCircle aria-hidden className="analyzer-spin"/>{a(task==='saving'?'retrySave':task)}</>}</div>
    {error&&<p role="alert" className="analyzer-error">{error}</p>}
    {zoom!==null&&photos[zoom]&&<UtilitySheet title={a('photo',{number:zoom+1})} onClose={()=>{setZoom(null);setHighlight(null);}}>{photoView(photos[zoom],zoom,true)}<div className="analyzer-findings">{result?.analysis.observations.map((f,i)=>f.locations.some(l=>l.photoIndex===zoom+1)?<button key={i} type="button" onClick={()=>setHighlight(i)} aria-pressed={highlight===i}><span>{i+1}</span>{f.finding}</button>:null)}</div></UtilitySheet>}
  </PokedexFrame>;
}
