import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronLeft, LuChevronRight, LuHeart, LuPackage, LuGrip, LuCircleHelp } from 'react-icons/lu';
import type { InventoryCatalogCard } from '@/domain/inventory';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { pageCount } from './model';

export type VisualPocket = {key:string;card:InventoryCatalogCard|null;kind:'owned'|'pending'|'wish'|'empty'|'unavailable'|'unknown'};
type Gesture = {id:number;x:number;y:number;from:number|null;active:boolean;timer:ReturnType<typeof setTimeout>|null;over:number|null;turn:ReturnType<typeof setTimeout>|null;turnPage:number|null};
export function BinderBook({pockets,page,onPage,onMove,includeWish=true,reader=false,busy=false}: {
  pockets:readonly VisualPocket[];page:number;onPage:(page:number)=>void;onMove?:((from:number,to:number)=>void)|undefined;
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
  const spread=landscape ? 2 : 1;
  const current=Math.min(Math.max(0,page),total-1);
  const first=spread===2 ? Math.floor(current/2)*2 : current;
  const gesture=useRef<Gesture|null>(null);
  const [drag,setDrag]=useState<{from:number;over:number|null;x:number;y:number}|null>(null);
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
    if(event.button!==0 || busy || (event.target as HTMLElement).closest('[data-page-target]')) return;
    const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-pocket-index]');
    const from=slot ? Number(slot.dataset.pocketIndex) : null;
    const g:Gesture={id:event.pointerId,x:event.clientX,y:event.clientY,from,active:false,timer:null,over:null,turn:null,turnPage:null};
    gesture.current=g;
    event.currentTarget.setPointerCapture(event.pointerId);
    if(onMove && from!==null && pockets[from] && !['empty','unavailable'].includes(pockets[from]!.kind)) {
      g.timer=setTimeout(()=>{
        if(gesture.current!==g) return;
        g.active=true;setDrag({from,over:null,x:g.x,y:g.y});
      },event.pointerType==='mouse'?100:300);
    }
  };
  const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const g=gesture.current;if(!g || g.id!==event.pointerId) return;
    const distance=Math.hypot(event.clientX-g.x,event.clientY-g.y);
    if(!g.active && distance>10 && g.timer) {
      clearTimeout(g.timer);g.timer=null;
      if(event.pointerType==='mouse' && onMove && g.from!==null && pockets[g.from] && !['empty','unavailable'].includes(pockets[g.from]!.kind)) g.active=true;
    }
    if(!g.active || g.from===null) return;
    const hit=document.elementFromPoint(event.clientX,event.clientY);
    const target=hit?.closest<HTMLElement>('[data-pocket-index]');
    g.over=target && root.current?.contains(target) ? Number(target.dataset.pocketIndex) : null;
    setDrag({from:g.from,over:g.over,x:event.clientX,y:event.clientY});
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
    if(g.active && g.from!==null && g.over!==null && g.from!==g.over) onMove?.(g.from,g.over);
    else if(!g.active) {
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.4) {
        const next=first+((dx<0)!==(i18n.dir()==='rtl')?spread:-spread);
        if(next>=0 && next<total) onPage(next);
      }
    }
    cancel();
  };
  const dragPocket=drag ? pockets[drag.from] : null;
  return <div ref={root} className="binder-book" data-reader={reader || undefined} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={e=>{if(e.key==='Escape')cancel();}}>
    <div className="binder-stage">
      <div className="binder-spread" data-double={spread===2 || undefined}>
        {Array.from({length:spread},(_,offset)=>{
          const number=first+offset;
          return <div key={number} className="binder-leaf" role="group" aria-label={number<total?t('binderUi.page',{page:number+1,count:total}):t('binderUi.empty')} data-binder-page={number}>
            {Array.from({length:9},(_,slot)=>{
              const index=number*9+slot,p=pockets[index];
              const kind=p?.kind ?? 'empty';
              return <div key={p?.key ?? `implicit-${index}`} data-pocket-index={number<total ? index : undefined} data-kind={kind} data-dragging={drag?.from===index || undefined} data-drop={drag?.over===index || undefined} className="binder-slot" role="group" aria-label={`${t('binderUi.selected',{slot:slot+1,page:number+1})}: ${p?.card?.name ?? t('binderUi.empty')}`}>
                {p?.card && <PokemonArt size="zoom" src={p.card.imageUrl} alt={p.card.name} className="binder-art" />}
                {(kind==='empty' || kind==='unavailable') && <span className="binder-pocket-label">{t(kind==='empty'?'binderUi.empty':'binderUi.unavailable')}</span>}
                {kind==='wish' && <span className="binder-wish" data-hidden={!includeWish || undefined}><LuHeart aria-hidden /><span>{t('binderUi.wish')}</span></span>}
                {(kind==='pending'||kind==='unknown') && <span className="binder-pending">{kind==='pending'?<LuPackage aria-hidden />:<LuCircleHelp aria-hidden />}<span>{t(kind==='pending'?'binderUi.pending':'inventory.unknown')}</span></span>}
              </div>;
            })}
          </div>;
        })}
      </div>
    </div>
    <div className="binder-pager">
      <button type="button" data-page-target={first-spread} disabled={first===0 || busy} aria-label={t('binderUi.previous')} onClick={()=>onPage(Math.max(0,first-spread))}><LuChevronLeft className="rtl:rotate-180" aria-hidden /></button>
      <p aria-live="polite">{spread===2 && first+1<total?t('binderUi.pages',{from:first+1,to:first+2,count:total}):t('binderUi.page',{page:first+1,count:total})}</p>
      <button type="button" data-page-target={first+spread} disabled={first+spread>=total || busy} aria-label={t('binderUi.next')} onClick={()=>onPage(first+spread)}><LuChevronRight className="rtl:rotate-180" aria-hidden /></button>
    </div>
    <p className="binder-hint">{onMove && <LuGrip aria-hidden />}{onMove ? t('binderUi.hint') : t('binderUi.swipe')}</p>
    {drag && dragPocket?.card && <div className="binder-drag-ghost" style={{left:drag.x,top:drag.y}}><img src={dragPocket.card.imageUrl} alt="" draggable={false} /></div>}
  </div>;
}
