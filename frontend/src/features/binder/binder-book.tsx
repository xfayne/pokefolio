import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronLeft, LuChevronRight, LuHeart, LuPackage, LuCircleHelp } from 'react-icons/lu';
import type { InventoryCatalogCard } from '@/domain/inventory';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { Button } from '@/components/ui/button';
import { pageCount } from './model';
import { readerSpread } from './reader-spread';

export type VisualPocket = {key:string;card:InventoryCatalogCard|null;kind:'owned'|'pending'|'wish'|'empty'|'unavailable'|'unknown';wishUnavailable?:boolean};
type Gesture = {id:number;x:number;y:number;from:number|null;active:boolean;timer:ReturnType<typeof setTimeout>|null;over:number|null;turn:ReturnType<typeof setTimeout>|null;turnPage:number|null};
export function BinderBook({pockets,page,onPage,onMove,onRemove,includeWish=true,reader=false,busy=false,onEmpty,onOptions,onSelect}: {
  pockets:readonly VisualPocket[];page:number;onPage:(page:number)=>void;onMove?:((from:number,to:number)=>void)|undefined;
  onRemove?: ((from:number)=>void)|undefined; onEmpty?: ((index:number)=>void)|undefined; onOptions?: (()=>void)|undefined;
  includeWish?:boolean;reader?:boolean;busy?:boolean;onSelect?: ((card:InventoryCatalogCard)=>void) | undefined;
}) {
  const {t,i18n}=useTranslation();
  const total=pageCount(pockets);
  const [landscape,setLandscape]=useState(() => reader && typeof matchMedia !== 'undefined' && matchMedia('(orientation: landscape) and (min-width: 600px)').matches);
  useEffect(() => {
    if(typeof matchMedia==='undefined') return;
    const media=matchMedia('(orientation: landscape) and (min-width: 600px)');
    const update=()=>setLandscape(reader && media.matches); update(); media.addEventListener('change',update);
    return ()=>media.removeEventListener('change',update);
  },[reader]);
  const {first,count:spread,previous,next}=readerSpread(page,total,landscape);
  const suppressClick=useRef(false);
  const tapIndex=useRef<number|null>(null);
  const [jump,setJump]=useState(false);
  const arrowPress=useRef<{id:number;x:number;y:number;at:number}|null>(null);
  const suppressArrowClick=useRef(false);
  const arrowDown=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    if(busy || total<2 || (event.pointerType==='mouse' && event.button!==0))return;
    suppressArrowClick.current=false;
    arrowPress.current={id:event.pointerId,x:event.clientX,y:event.clientY,at:Date.now()};
  };
  const arrowMove=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    const press=arrowPress.current;
    if(press && press.id===event.pointerId && Math.hypot(event.clientX-press.x,event.clientY-press.y)>8){arrowPress.current=null;suppressArrowClick.current=true;}
  };
  const arrowCancel=()=>{if(arrowPress.current)suppressArrowClick.current=true;arrowPress.current=null;};
  const arrowUp=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    const press=arrowPress.current;arrowPress.current=null;
    if(!busy && press && press.id===event.pointerId && Math.hypot(event.clientX-press.x,event.clientY-press.y)<=8 && Date.now()-press.at>=500){suppressArrowClick.current=true;setJump(true);}
  };
  const arrowClick=(target:number|null)=>{
    if(suppressArrowClick.current){suppressArrowClick.current=false;return;}
    if(!busy && target!==null)onPage(target);
  };
  const arrowHandlers={onPointerDown:arrowDown,onPointerMove:arrowMove,onPointerUp:arrowUp,onPointerCancel:arrowCancel,onPointerLeave:arrowCancel,onContextMenu:(e:React.MouseEvent<HTMLButtonElement>)=>e.preventDefault(),onKeyDown:(e:React.KeyboardEvent<HTMLButtonElement>)=>{if(e.key==='F2'&&!busy&&total>1){e.preventDefault();setJump(true);}}};
  const gesture=useRef<Gesture|null>(null);
  const [drag,setDrag]=useState<{from:number;over:number|null;x:number;y:number;outside:boolean}|null>(null);
  const root=useRef<HTMLDivElement>(null);
  const pageCallback=useRef(onPage);
  useEffect(()=>{pageCallback.current=onPage;},[onPage]);
  const cancel=()=>{
    const g=gesture.current;
    if(g?.timer) clearTimeout(g.timer);
    if(g?.turn) clearTimeout(g.turn);
    gesture.current=null;setDrag(null);
  };
  useEffect(()=>()=>{
    const g=gesture.current; if(g?.timer) clearTimeout(g.timer); if(g?.turn) clearTimeout(g.turn);
  },[]);
  const start=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if((event.pointerType==='mouse' && event.button!==0) || busy || (event.target as HTMLElement).closest('button')) return;
    const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-pocket-index]');
    const from=slot ? Number(slot.dataset.pocketIndex) : null;
    const g:Gesture={id:event.pointerId,x:event.clientX,y:event.clientY,from,active:false,timer:null,over:null,turn:null,turnPage:null};
    gesture.current=g; suppressClick.current=false; tapIndex.current=null;
    if(from!==null && pockets[from] && pockets[from]!.kind!=='empty')event.currentTarget.setPointerCapture(event.pointerId);

  };
  // Pointer capture keeps drag events flowing even after the finger leaves the page.
  // Only a deliberate release outside the physical book removes a placement.
  const outsideBook=(x:number,y:number)=>!Array.from(root.current?.querySelectorAll<HTMLElement>('.binder-leaf') ?? []).some(leaf=>{
    const rect=leaf.getBoundingClientRect();
    return x>=rect.left && x<=rect.right && y>=rect.top && y<=rect.bottom;
  });
  const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const g=gesture.current;if(!g || g.id!==event.pointerId) return;
    const distance=Math.hypot(event.clientX-g.x,event.clientY-g.y);
    if(!g.active && distance>6 && onMove && g.from!==null && pockets[g.from] && pockets[g.from]!.kind!=='empty') g.active=true;
    if(!g.active || g.from===null) return;
    const hit=document.elementFromPoint(event.clientX,event.clientY);
    const target=hit?.closest<HTMLElement>('[data-pocket-index]');
    g.over=target && root.current?.contains(target) ? Number(target.dataset.pocketIndex) : null;
    setDrag({from:g.from,over:g.over,x:event.clientX,y:event.clientY,outside:outsideBook(event.clientX,event.clientY) && !hit?.closest('button')});
    const turn=hit?.closest<HTMLElement>('[data-page-target]');
    const next=turn && !turn.hasAttribute('disabled') ? Number(turn.dataset.pageTarget) : null;
    if(next!==g.turnPage) {
      if(g.turn) clearTimeout(g.turn);
      g.turnPage=next;
      if(next!==null) g.turn=setTimeout(()=>{pageCallback.current(next);g.turnPage=null;g.turn=null;},550);
    }
  };
  const finish=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const g=gesture.current; if(!g || g.id!==event.pointerId) return;
    if(g.active && g.from!==null) {
      // Resolve the *release* coordinates rather than trusting a stale move target.
      const hit=document.elementFromPoint(event.clientX,event.clientY);
      const target=hit?.closest<HTMLElement>('[data-pocket-index]');
      const over=target && root.current?.contains(target) ? Number(target.dataset.pocketIndex) : null;
      if(over!==null && over!==g.from) onMove?.(g.from,over);
      else if(over===null && outsideBook(event.clientX,event.clientY) && !hit?.closest('button')) onRemove?.(g.from);
    } else if(!g.active) {
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.4) {
        const target=(dx<0)!==(i18n.dir()==='rtl') ? next : previous;
        if(target!==null) onPage(target);
      }
    }
    const traveled=Math.hypot(event.clientX-g.x,event.clientY-g.y);
    // Empty pockets are never pointer-captured. Let their native click open
    // the picker *after* the browser has completed the tap click sequence.
    // Opening on pointer-up can race the synthetic click, which can then hit
    // the new dialog backdrop and immediately dismiss it.
    suppressClick.current=g.active || traveled>8;
    tapIndex.current=!suppressClick.current ? g.from : null;
    cancel();
  };
  const dragPocket=drag ? pockets[drag.from] : null;
  return <><div ref={root} className="binder-book" data-reader={reader || undefined} onDragStart={e=>e.preventDefault()} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={event=>{
    // A captured tap can dispatch its native click on the book instead of the slot.
    // A completed drag or swipe must never open details.
    if((event.target as HTMLElement).closest('button'))return;
    const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-pocket-index]');
    const index=tapIndex.current ?? (slot ? Number(slot.dataset.pocketIndex) : null);
    tapIndex.current=null;
    if(busy || suppressClick.current || index===null)return;
    const pocket=pockets[index];
    if(pocket?.card && pocket.kind!=='unavailable' && onSelect){slot?.blur();onSelect(pocket.card);}
  }} onKeyDown={e=>{if(e.key==='Escape')cancel();}}>
    <div className="binder-stage">
      <div className="binder-spread" data-double={spread===2 || undefined}>
        {Array.from({length:spread},(_,offset)=>{
          const number=first+offset;
          return <div key={number} className="binder-leaf" role="group" aria-label={number<total?t('binderUi.page',{page:number+1,count:total}):t('binderUi.empty')} data-binder-page={number}>
            <span className="binder-page-stamp" aria-label={t('binderUi.page',{page:number+1,count:total})}>{number+1}/{total}</span>
            {Array.from({length:9},(_,slot)=>{
              const index=number*9+slot,p=pockets[index];
              const kind=p?.kind ?? 'empty';
              const unavailableLabel=t(p?.wishUnavailable?'binderUi.wishUnavailable':'binderUi.unavailable');
              const canSelect=!!onSelect && !!p?.card && kind!=='unavailable';
              const interactive=kind==='empty' ? !!onEmpty : canSelect;
              return <div key={p?.key ?? `implicit-${index}`} data-pocket-index={number<total ? index : undefined} data-kind={kind} data-dragging={drag?.from===index || undefined} data-drop={drag?.over===index || undefined} className="binder-slot" onClick={event=>{if(kind==='empty'&&!busy&&!suppressClick.current){
                // Pointer-driven selection must not leave a persistent focus ring
                // when the sheet restores focus on close. Keyboard activation
                // continues to preserve its visible focus for accessibility.
                if(event.detail>0)event.currentTarget.blur();
                onEmpty?.(index);
              }}} role={interactive?'button':'group'} tabIndex={interactive?0:undefined} onKeyDown={e=>{if(!busy&&interactive&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(kind==='empty')onEmpty?.(index);else if(p?.card&&canSelect)onSelect?.(p.card);}}} aria-label={`${t('binderUi.selected',{slot:slot+1,page:number+1})}: ${p?.card?.name ?? (kind==='unavailable'?unavailableLabel:t('binderUi.empty'))}${kind==='wish'&&includeWish?` · ${t('binderUi.wish')}`:kind==='pending'?` · ${t('binderUi.pending')}`:kind==='unknown'?` · ${t('inventory.unknown')}`:''}`}>
                {p?.card && <PokemonArt size="zoom" src={p.card.imageUrl} alt={p.card.name} className="binder-art" />}
                {(kind==='empty' || kind==='unavailable') && <span className="binder-pocket-label">{kind==='empty'?t('binderUi.empty'):unavailableLabel}</span>}
                {kind==='wish' && <span className="binder-wish" data-hidden={!includeWish || undefined}><LuHeart aria-hidden /><span>{t('binderUi.wish')}</span></span>}
                {(kind==='pending'||kind==='unknown') && <span className="binder-pending">{kind==='pending'?<LuPackage aria-hidden />:<LuCircleHelp aria-hidden />}<span>{t(kind==='pending'?'binderUi.pending':'inventory.unknown')}</span></span>}
                <PocketFilm />
              </div>;
            })}
          </div>;
        })}
      <div className="binder-pager">
      <button type="button" data-page-target={previous ?? undefined} disabled={busy || total<2} aria-disabled={previous===null || busy} aria-label={t('binderUi.previous')} {...arrowHandlers} onClick={()=>arrowClick(previous)}><LuChevronLeft className="rtl:rotate-180" aria-hidden /></button>

      <button type="button" data-page-target={next ?? undefined} disabled={busy || total<2} aria-disabled={next===null || busy} aria-label={t('binderUi.next')} {...arrowHandlers} onClick={()=>arrowClick(next)}><LuChevronRight className="rtl:rotate-180" aria-hidden /></button>
      </div>
      {onOptions && <button type="button" className="binder-options-overlay" aria-label={t('binderUi.options')} disabled={busy} onClick={onOptions}>•••</button>}
      </div>
    </div>
    {drag && dragPocket && <div className="binder-drag-ghost" style={{left:drag.x,top:drag.y}}>{dragPocket.card?<img src={dragPocket.card.imageUrl} alt="" draggable={false} />:<span className="binder-pocket-label">{t(dragPocket.wishUnavailable?'binderUi.wishUnavailable':'binderUi.unavailable')}</span>}{drag.outside && onRemove && <span className="binder-drag-remove">{t('binderUi.releaseRemove')}</span>}</div>}
  </div>{jump && <PageJump count={total} current={page} onClose={()=>setJump(false)} onApply={target=>{onPage(target);setJump(false);}} />}</>;
}

function PageJump({count,current,onClose,onApply}:{count:number;current:number;onClose:()=>void;onApply:(target:number)=>void}){
  const {t}=useTranslation();
  const id=useId(),dialog=useRef<HTMLDialogElement>(null);
  const [value,setValue]=useState(String(Math.min(current+1,count)));
  const n=Number(value),valid=Number.isInteger(n)&&n>=1&&n<=count;
  useEffect(()=>{const node=dialog.current!;node.showModal();return ()=>{node.close();};},[]);
  return <dialog ref={dialog} className="binder-jump-dialog" aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose();}}><form className="space-y-3" onSubmit={e=>{e.preventDefault();if(valid)onApply(n-1);}}>
    <h2 id={id} className="text-lg font-bold">{t('binderUi.jumpPage')}</h2>
    <label className="flex flex-col gap-1 text-sm font-bold">{t('binderUi.targetPage')}<input type="number" inputMode="numeric" min={1} max={count} step={1} required value={value} onChange={e=>setValue(e.target.value)} className="min-h-11 w-full rounded-xl border border-blue-300 bg-white px-3 text-base" /></label>
    <p className="text-xs text-slate-600">{t('binderUi.pageRange',{count})}</p>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>{t('binderUi.cancel')}</Button><Button type="submit" disabled={!valid}>{t('binderUi.go')}</Button></div>
  </form></dialog>;
}

// The film belongs to the physical pocket, never to the draggable card.
function PocketFilm() {
  const id = useId();
  return <svg className="binder-pocket-film" viewBox="0 0 110 150" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={id+'plastic'} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="white" stopOpacity=".32"/><stop offset=".18" stopColor="white" stopOpacity=".04"/><stop offset=".48" stopColor="white" stopOpacity="0"/><stop offset=".82" stopColor="#c6def2" stopOpacity=".04"/><stop offset="1" stopColor="white" stopOpacity=".22"/></linearGradient>
      <linearGradient id={id+'lip'}><stop stopColor="#344f68" stopOpacity="0"/><stop offset=".5" stopColor="#344f68" stopOpacity=".23"/><stop offset=".72" stopColor="white" stopOpacity=".95"/><stop offset="1" stopColor="white" stopOpacity=".1"/></linearGradient>
      <linearGradient id={id+'shine'} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="white" stopOpacity=".9"/><stop offset=".65" stopColor="white" stopOpacity=".08"/><stop offset="1" stopColor="white" stopOpacity="0"/></linearGradient>
    </defs>
    <path d="M106 2H7Q2 2 2 7V143Q2 148 7 148H106Q101 111 103 75Q101 39 106 2Z" fill={`url(#${id}plastic)`}/>
    <path d="M106 2H7Q2 2 2 7V143Q2 148 7 148H106" fill="none" stroke="#718ca4" strokeOpacity=".42" strokeWidth=".9"/>
    <path d="M105 3.5H7Q3.5 3.5 3.5 7V143Q3.5 146.5 7 146.5H105" fill="none" stroke="white" strokeOpacity=".95"/>
    <path d="M106 2Q101 39 103 75Q101 111 106 148L108 148Q104 111 106 75Q104 39 108 2Z" fill={`url(#${id}lip)`}/>
    <path d="M106 3Q101 39 103 75Q101 111 106 147" stroke="white" strokeOpacity=".85" fill="none"/>
    <g opacity=".9"><path d="M5 6H36L5 43Z" fill={`url(#${id}shine)`} opacity=".42"/><path d="M5 52L47 5H52L5 59Z" fill="white" opacity=".13"/><path d="M79 146L102 117V131L90 146Z" fill="white" opacity=".18"/></g>
  </svg>;
}
