import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronLeft, LuChevronRight, LuHeart, LuPackage, LuCircleHelp } from 'react-icons/lu';
import type { InventoryCatalogCard } from '@/domain/inventory';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { pageCount } from './model';
import { readerSpread } from './reader-spread';

export type VisualPocket = {key:string;card:InventoryCatalogCard|null;kind:'owned'|'pending'|'wish'|'empty'|'unavailable'|'unknown';wishUnavailable?:boolean};
type Gesture = {id:number;x:number;y:number;from:number|null;active:boolean;timer:ReturnType<typeof setTimeout>|null;over:number|null;turn:ReturnType<typeof setTimeout>|null;turnPage:number|null};
export function BinderBook({pockets,page,onPage,onMove,onRemove,includeWish=true,reader=false,busy=false,onEmpty,onOptions}: {
  pockets:readonly VisualPocket[];page:number;onPage:(page:number)=>void;onMove?:((from:number,to:number)=>void)|undefined;
  onRemove?: ((from:number)=>void)|undefined; onEmpty?: ((index:number)=>void)|undefined; onOptions?: (()=>void)|undefined;
  includeWish?:boolean;reader?:boolean;busy?:boolean;
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
    gesture.current=g; suppressClick.current=false;
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
    cancel();
  };
  const dragPocket=drag ? pockets[drag.from] : null;
  return <div ref={root} className="binder-book" data-reader={reader || undefined} onDragStart={e=>e.preventDefault()} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={e=>{if(e.key==='Escape')cancel();}}>
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
              return <div key={p?.key ?? `implicit-${index}`} data-pocket-index={number<total ? index : undefined} data-kind={kind} data-dragging={drag?.from===index || undefined} data-drop={drag?.over===index || undefined} className="binder-slot" onClick={event=>{if(kind==='empty'&&!busy&&!suppressClick.current){
                // Pointer-driven selection must not leave a persistent focus ring
                // when the sheet restores focus on close. Keyboard activation
                // continues to preserve its visible focus for accessibility.
                if(event.detail>0)event.currentTarget.blur();
                onEmpty?.(index);
              }}} role={kind==='empty' && onEmpty?'button':'group'} tabIndex={kind==='empty' && onEmpty?0:undefined} onKeyDown={e=>{if(onEmpty&&kind==='empty'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onEmpty(index);}}} aria-label={`${t('binderUi.selected',{slot:slot+1,page:number+1})}: ${p?.card?.name ?? (kind==='unavailable'?unavailableLabel:t('binderUi.empty'))}`}>
                {p?.card && <PokemonArt size="zoom" src={p.card.imageUrl} alt={p.card.name} className="binder-art" />}
                {(kind==='empty' || kind==='unavailable') && <span className="binder-pocket-label">{kind==='empty'?t('binderUi.empty'):unavailableLabel}</span>}
                {kind==='wish' && <span className="binder-wish" data-hidden={!includeWish || undefined}><LuHeart aria-hidden /><span>{t('binderUi.wish')}</span></span>}
                {(kind==='pending'||kind==='unknown') && <span className="binder-pending">{kind==='pending'?<LuPackage aria-hidden />:<LuCircleHelp aria-hidden />}<span>{t(kind==='pending'?'binderUi.pending':'inventory.unknown')}</span></span>}
              </div>;
            })}
          </div>;
        })}
      <div className="binder-pager">
      <button type="button" data-page-target={previous ?? undefined} disabled={previous===null || busy} aria-label={t('binderUi.previous')} onClick={()=>{if(previous!==null)onPage(previous);}}><LuChevronLeft className="rtl:rotate-180" aria-hidden /></button>

      <button type="button" data-page-target={next ?? undefined} disabled={next===null || busy} aria-label={t('binderUi.next')} onClick={()=>{if(next!==null)onPage(next);}}><LuChevronRight className="rtl:rotate-180" aria-hidden /></button>
      </div>
      {onOptions && <button type="button" className="binder-options-overlay" aria-label={t('binderUi.options')} disabled={busy} onClick={onOptions}>•••</button>}
      </div>
    </div>
    {drag && dragPocket && <div className="binder-drag-ghost" style={{left:drag.x,top:drag.y}}>{dragPocket.card?<img src={dragPocket.card.imageUrl} alt="" draggable={false} />:<span className="binder-pocket-label">{t(dragPocket.wishUnavailable?'binderUi.wishUnavailable':'binderUi.unavailable')}</span>}{drag.outside && onRemove && <span className="binder-drag-remove">{t('binderUi.releaseRemove')}</span>}</div>}
  </div>;
}
