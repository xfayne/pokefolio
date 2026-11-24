import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useTranslation } from 'react-i18next';
import { LuChevronRight, LuGripVertical } from 'react-icons/lu';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { ListCard } from '@/components/ui/list-card';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { Button } from '@/components/ui/button';
import { CatalogDetails } from '@/features/catalog/catalog-details';
import { catalogCards, catalogMarketReference } from '@/features/catalog/catalog';
import { catalogIdentity } from '@/domain/inventory';
import { fetchMarketQuotes } from '@/features/catalog/market-prices';
import { publicPriceClient } from '@/services/public-price-client';
import { useDisplayMoney } from '@/services/display-currency';
import { positionWish, emptyWishlist } from './model';
import { sampleWishlistIds } from './sample';
import { useWishlist } from './use-wishlist';
import './wishlist.css';

const catalog = new Map(catalogCards.map(card => [card.id, card]));
type Sort = 'custom' | 'name' | 'priceAsc' | 'priceDesc';
type Grade = 'NM' | 'LP' | 'MP' | 'HP' | 'DAMAGED';
type Gesture = { pointerId: number; id: string; x: number; y: number; active: boolean; over: string | null };

export function WishlistPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const preview = params.get('wishlist') === 'sample';
  const account = useWishlist();
  const portfolio = usePortfolio();
  const navigate = useNavigate();
  const [sample, setSample] = useState(() => ({ ...emptyWishlist('sample-wishlist'), cardIds: [...sampleWishlistIds] }));
  const wishlist = preview ? sample : account.wishlist;
  const reorder = async (id: string, position: number) => {
    if (preview) setSample(current => ({ ...current, revision: current.revision + 1, cardIds: positionWish(current.cardIds, id, position) }));
    else await account.update(ids => positionWish(ids, id, position));
  };
  const demo = () => { const next = new URLSearchParams(params); next.set('wishlist', 'sample'); setParams(next); };
  if (!preview && (account.loading || account.error)) {
    return <section className="wishlist-feedback" role="status">{account.loading ? t('loading') : <><span role="alert">{t('wishlistUi.loadFailed')}</span> <Button variant="outline" onClick={account.retry}>{t('reload')}</Button></>}</section>;
  }
  return <section aria-label={t('wishlistUi.title')} className="wishlist-page">
    {preview && <p className="wishlist-preview-note">{t('wishlistUi.sample')}</p>}
    {!preview && !account.owner && <div className="wishlist-feedback"><p>{t('wishlistUi.signIn')}</p><Button variant="outline" onClick={demo}>{t('wishlistUi.tryDemo')}</Button></div>}
    {!preview && !!account.owner && !wishlist.cardIds.length && <p className="wishlist-preview-note">{t('wishlistUi.addHint')}</p>}
    <WishlistCardsView cardIds={wishlist.cardIds} busy={account.busy && !preview} onOrder={preview || !!account.owner ? reorder : undefined} priceEnabled={!!account.owner || preview} sample={preview} portfolio={preview ? undefined : portfolio} onViewPurchase={id => { void navigate(`/transactions/purchases/${id}`); }} />
  </section>;
}

export function WishlistCardsView({ cardIds, onOrder, busy = false, priceEnabled = true, sample = false, portfolio, onViewPurchase }: {
  cardIds: readonly string[]; onOrder?: ((cardId: string, position: number) => Promise<void>) | undefined;
  busy?: boolean; priceEnabled?: boolean; sample?: boolean;
  portfolio?: ReturnType<typeof usePortfolio> | undefined;
  onViewPurchase?: ((id: string) => void) | undefined;
}) {
  const { t, i18n } = useTranslation();
  const money = useDisplayMoney();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('custom');
  const [condition, setCondition] = useState<Grade>('LP');
  const [limit, setLimit] = useState(80);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [position, setPosition] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const positionRef = useRef<HTMLInputElement>(null);
  const press = useRef<{id:string;x:number;y:number;timer:ReturnType<typeof setTimeout>} | null>(null);
  const suppressTap = useRef<{id:string;expires:number}|null>(null);
  const gesture = useRef<Gesture | null>(null);
  const [drag, setDrag] = useState<{id:string;over:string|null;x:number;y:number}|null>(null);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    const dialog = dialogRef.current!;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    positionRef.current?.focus({preventScroll:true});
    return () => { dialog.close(); opener?.focus({preventScroll:true}); };
  }, [editing]);
  useEffect(() => () => {
    if (press.current) clearTimeout(press.current.timer);
  }, []);

  const prices = useQueries({
    queries: cardIds.map((id, i) => {
      const card = catalog.get(id);
      const reference = catalogMarketReference(id);
      return {
        queryKey: ['market', catalogIdentity(reference)],
        enabled: priceEnabled && !!card && (i < limit || sort === 'priceAsc' || sort === 'priceDesc'),
        queryFn: ({signal}: {signal: AbortSignal}) => fetchMarketQuotes(card!, reference, signal),
        staleTime: 900_000, retry: 1,
      };
    }),
  }, publicPriceClient);
  const priceMap = new Map(cardIds.map((id, i) => {
    const ref = catalogMarketReference(id);
    const matches = (prices[i]?.data ?? []).filter(quote =>
      quote.condition === condition && catalogIdentity(quote.catalog) === catalogIdentity(ref));
    const latest = Math.max(...matches.map(quote => Date.parse(quote.observedAt)));
    const rows = matches.filter(quote => Date.parse(quote.observedAt) === latest);
    const first = rows[0]?.money;
    return [id, first && rows.every(row => row.money.minor === first.minor) ? first : null] as const;
  }));
  const term = search.trim().toLocaleLowerCase();
  const ordered = [...cardIds].filter(id => {
    const card = catalog.get(id);
    return !!card && (!term || (card.name + ' ' + card.setName + ' ' + card.number).toLocaleLowerCase().includes(term));
  });
  if (sort === 'name') ordered.sort((a,b) => catalog.get(a)!.name.localeCompare(catalog.get(b)!.name, i18n.language));
  if (sort === 'priceAsc' || sort === 'priceDesc') ordered.sort((a,b) => {
    const x = priceMap.get(a), y = priceMap.get(b);
    if (!x) return y ? 1 : 0;
    if (!y) return -1;
    return sort === 'priceAsc' ? x.minor - y.minor : y.minor - x.minor;
  });
  const draggable = sort === 'custom' && !term && !busy && !modalBusy && !!onOrder;
  const shown = ordered.slice(0, limit);

  const openMove = (id: string) => {
    const index = cardIds.indexOf(id);
    if (!onOrder || index < 0 || busy || modalBusy) return;
    setEditing(id);
    setPosition(String(index + 1));
    setFailed(false);
  };
  const clearPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  const beginPress = (event: ReactPointerEvent<HTMLLIElement>, id: string) => {
    if ((event.pointerType === 'mouse' && event.button !== 0) ||
        (event.target as HTMLElement).closest('[data-drag-handle]') || busy) return;
    clearPress();
    const x = event.clientX, y = event.clientY;
    const timer = setTimeout(() => {
      suppressTap.current = {id, expires: Date.now() + 1000};
      openMove(id);
      press.current = null;
    }, 550);
    press.current = {id, x, y, timer};
  };
  const movePress = (event: ReactPointerEvent<HTMLLIElement>) => {
    const current = press.current;
    if (current && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) clearPress();
  };
  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (!draggable || (event.pointerType === 'mouse' && event.button !== 0)) return;
    clearPress();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {pointerId:event.pointerId,id,x:event.clientX,y:event.clientY,active:false,over:null};
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.active && Math.hypot(event.clientX-current.x,event.clientY-current.y) >= 6) current.active = true;
    if (!current.active) return;
    const hit = document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-wish-id]');
    // Touch pointer capture can retarget the event to the handle. Find the row
    // by its current Y-position if hit-testing returns no list item.
    const byY = Array.from(document.querySelectorAll<HTMLElement>('.wishlist-rows [data-wish-id]'))
      .find(row => { const rect = row.getBoundingClientRect(); return event.clientY >= rect.top && event.clientY <= rect.bottom; });
    current.over = hit?.dataset.wishId ?? byY?.dataset.wishId ?? null;
    setDraggedOver(current.over);
    setDrag({id:current.id,over:current.over,x:event.clientX,y:event.clientY});
    // Keep a dense list navigable during a touch drag without blocking document scroll elsewhere.
    if (event.clientY > window.innerHeight - 75) window.scrollBy(0,18);
    else if (event.clientY < 105) window.scrollBy(0,-18);
  };
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const hit = document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-wish-id]');
    // Prefer the last deliberate hover position. Touchend/pointercancel may
    // provide stale coordinates after moving out of the captured handle.
    const target = current.over ?? hit?.dataset.wishId;
    if (current.active && target && target !== current.id && cardIds.includes(target)) {
      setSaveFailed(false);
      void onOrder?.(current.id,cardIds.indexOf(target)+1).catch(() => setSaveFailed(true));
    }
    gesture.current = null;
    setDrag(null);
    setDraggedOver(null);
  };
  const keyboardMove = (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (!onOrder || busy || sort !== 'custom' || term) return;
    const current = cardIds.indexOf(id);
    const target = event.key === 'ArrowUp' ? Math.max(0,current-1)
      : event.key === 'ArrowDown' ? Math.min(cardIds.length-1,current+1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? cardIds.length-1 : -1;
    if (target >= 0) {
      event.preventDefault();
      if (current !== target) void onOrder(id,target+1).catch(() => setSaveFailed(true));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openMove(id);
    }
  };
  const applyPosition = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = Number(position);
    if (!editing || !onOrder || !Number.isSafeInteger(target) || target < 1 || target > cardIds.length) {
      setFailed(true); return;
    }
    setModalBusy(true); setFailed(false); setSaveFailed(false);
    try { await onOrder(editing,target); setEditing(null); }
    catch { setFailed(true); }
    finally { setModalBusy(false); }
  };
  return <div className="wishlist-cards">
    <div className="wishlist-toolbar">
      <SearchInput label={t('wishlistUi.search')} placeholder={t('wishlistUi.search')} value={search} onChange={event => {setSearch(event.target.value);setLimit(80);}} />
      <div className="wishlist-controls collection-list-controls">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t('wishlistUi.count',{count:ordered.length})}</p>
        </div>
        <label className="wishlist-grade-label"><span className="sr-only">{t('wishlistUi.grade')}</span><Select aria-label={t('wishlistUi.grade')} value={condition} onChange={event => setCondition(event.target.value as Grade)}>{(['NM','LP','MP','HP','DAMAGED'] as const).map(value => <option key={value} value={value}>{value === 'DAMAGED' ? 'DMG' : value}</option>)}</Select></label>
        <label className="wishlist-sort-label"><span className="sr-only">{t('wishlistUi.sort')}</span><Select aria-label={t('wishlistUi.sort')} value={sort} onChange={event => {setSort(event.target.value as Sort);setLimit(80);}}>
          <option value="custom">{t('wishlistUi.custom')}</option>
          <option value="priceAsc">{t('wishlistUi.priceAsc')}</option>
          <option value="priceDesc">{t('wishlistUi.priceDesc')}</option>
          <option value="name">{t('wishlistUi.name')}</option>
        </Select></label>
      </div>
    </div>
    {saveFailed && <p role="alert" className="wishlist-error">{t('wishlistUi.saveFailed')}</p>}
    {!ordered.length && <p className="wishlist-empty">{t(cardIds.length ? 'wishlistUi.noResults' : 'wishlistUi.empty')}</p>}
    <ul className="wishlist-rows">{shown.map(id => {
      const card = catalog.get(id)!;
      const quote = priceMap.get(id);
      const price = prices[cardIds.indexOf(id)];
      return <ListCard key={id} data-wish-id={id} data-drop={draggedOver === id || undefined} data-dragging={drag?.id === id || undefined}
        onPointerDown={event => beginPress(event,id)} onPointerMove={movePress}
        onPointerUp={clearPress} onPointerCancel={clearPress} onPointerLeave={clearPress}
        onContextMenu={event => {event.preventDefault();openMove(id);}}>
        <div className="wishlist-row">
          <button type="button" data-drag-handle className="wishlist-grip" disabled={!draggable} aria-label={t('wishlistUi.move',{name:card.name})}
            title={t('wishlistUi.move',{name:card.name})}
            onPointerDown={event => beginDrag(event,id)} onPointerMove={moveDrag}
            onPointerUp={endDrag} onPointerCancel={endDrag}
            onKeyDown={event => keyboardMove(event,id)}><LuGripVertical aria-hidden /></button>
          <button type="button" className="wishlist-card-link" onClick={() => {
            if (suppressTap.current?.id === id && suppressTap.current.expires > Date.now()) {
              suppressTap.current = null; return;
            }
            setSelected(id);
          }} onKeyDown={event => {if (event.key === 'F2') {event.preventDefault();openMove(id);}}}>
            <PokemonArt src={card.imageUrl} alt={card.name} />
            <span className="wishlist-identity"><span className="wishlist-card-name"><bdi>{card.name}</bdi></span><span className="wishlist-card-set">{card.setName} · #{card.number}</span></span>
            <span className="wishlist-market">
              <span className="wishlist-market-price">{quote ? money(quote) : price?.isPending && priceEnabled ? t('loading') : '—'}</span>
              <span className="wishlist-market-label">{t('wishlistUi.market')}</span>
            </span>
            <LuChevronRight aria-hidden className="wishlist-chevron rtl:rotate-180" />
          </button>
        </div>
      </ListCard>;
    })}</ul>
    {ordered.length > shown.length && <Button variant="outline" onClick={() => setLimit(count => count + 80)}>{t('wishlistUi.more')}</Button>}
    {drag && <div aria-hidden className="wishlist-drag-preview" style={{left:drag.x,top:drag.y}}><LuGripVertical />{catalog.get(drag.id)?.name}</div>}
    {editing && <dialog ref={dialogRef} aria-modal="true" aria-labelledby="wishlist-dialog-title" className="wishlist-position-dialog" onCancel={event => {event.preventDefault();if(!modalBusy)setEditing(null);}}>
      <form onSubmit={event => {void applyPosition(event);}} className="wishlist-dialog-content">
        <h2 id="wishlist-dialog-title" className="text-lg font-bold">{t('wishlistUi.changePosition')}</h2>
        <p className="text-sm text-slate-600"><bdi>{catalog.get(editing)?.name}</bdi></p>
        <label className="flex flex-col gap-1 text-sm font-bold" htmlFor="wishlist-new-position">{t('wishlistUi.position')}</label>
        <input ref={positionRef} id="wishlist-new-position" type="number" inputMode="numeric" min={1} max={cardIds.length} step={1}
          className="wishlist-position-input" value={position} onChange={event => {setPosition(event.target.value);setFailed(false);}} />
        <p className="text-xs text-slate-600">{t('wishlistUi.positionRange',{count:cardIds.length})}</p>
        {failed && <p role="alert" className="wishlist-error">{t('wishlistUi.invalidPosition')}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={modalBusy} onClick={() => setEditing(null)}>{t('wishlistUi.cancel')}</Button>
          <Button type="submit" disabled={modalBusy}>{t(modalBusy ? 'wishlistUi.saving' : 'wishlistUi.save')}</Button>
        </div>
      </form>
    </dialog>}
    {selected && catalog.has(selected) && <CatalogDetails card={catalog.get(selected)!} allowWishlist={!sample} portfolio={sample ? undefined : portfolio} onViewPurchase={onViewPurchase} onClose={() => setSelected(null)} />}
  </div>;
}
