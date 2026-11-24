import { useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronRight, LuGrid2X2, LuList, LuFilter, LuLayers, LuHeart } from 'react-icons/lu';
import { SearchInput } from '@/components/ui/search-input';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { initialCatalogSearch, type CatalogSearchState } from './search-state';
import { DisclosureButton, DisclosureContent } from '@/components/ui/disclosure';
import { Button } from '@/components/ui/button';
import { searchCatalog, catalogCards } from './catalog';
import type { InventoryCatalogCard } from '@/domain/inventory';
export function CatalogSearch({ query, onQuery, onSelect, owned = {}, state, onState, wishlist = [], scrollPositionRef, allowedCardIds }: { query: string; onQuery: (value: string) => void; onSelect: (card: InventoryCatalogCard) => void; owned?: Readonly<Record<string, number>>; wishlist?: readonly string[]; state?: CatalogSearchState; onState?: (state: CatalogSearchState) => void; scrollPositionRef?: RefObject<number>; allowedCardIds?: ReadonlySet<string> }) {
  const { t, i18n } = useTranslation();
  const filtersId = useId();
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const restoringScroll = useRef(true);
  useLayoutEffect(() => {
    if (!scrollPositionRef) return;
    // showModal may run after the first animation frame. Wait for its open
    // attribute as well; a closed dialog has no scrollable layout to restore.
    const offset = scrollPositionRef.current;
    restoringScroll.current = true;
    const region = scrollRegionRef.current!;
    const dialog = region.closest('dialog');
    const restore = () => {
      if (dialog && !dialog.open) return;
      region.scrollTop = offset;
      restoringScroll.current = false;
    };
    const observer = new MutationObserver(restore);
    if (dialog) observer.observe(dialog, {attributes:true,attributeFilter:['open']});
    const frame = requestAnimationFrame(restore);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [scrollPositionRef]);
  const he = i18n.language === 'he';
  const [local, setLocal] = useState(initialCatalogSearch);
  const current = state ?? local;
  const { grid, filters, sets, limit } = current;
  const update = (patch: Partial<CatalogSearchState>) => (onState ?? setLocal)({ ...current, ...patch });
  const results = searchCatalog(query, sets, current).filter(card => !allowedCardIds || allowedCardIds.has(card.id));
  return <div className="catalog-search">
    <div className="catalog-pinned-tools space-y-2">
      <SearchInput label={t('searchCards')} placeholder={t('searchPlaceholder')} value={query} onChange={e => { onQuery(e.target.value); update({limit:60}); }} />
      <div className="catalog-toolbar flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-sm font-bold">{results.length} {he ? 'תוצאות' : 'results'}</p><DisclosureButton className="catalog-filter-button" open={filters} contentId={filtersId} onClick={() => update({filters:!filters})}><LuFilter aria-hidden />{he ? 'סינון' : 'Filters'}{sets.length ? ` (${sets.length})` : ''}</DisclosureButton><div className="catalog-view" role="group" aria-label={he ? 'תצוגה' : 'View'}><button type="button" aria-pressed={!grid} onClick={() => update({grid:false})}><LuList aria-hidden />{he ? 'רשימה' : 'List'}</button><button type="button" aria-pressed={grid} onClick={() => update({grid:true})}><LuGrid2X2 aria-hidden />{he ? 'רשת' : 'Grid'}</button></div></div>
    </div>
    <div ref={scrollRegionRef} onScroll={event => { if (scrollPositionRef && !restoringScroll.current && event.currentTarget.isConnected && event.currentTarget.closest('dialog')?.open !== false) scrollPositionRef.current = event.currentTarget.scrollTop; }} className="catalog-scroll-region space-y-4">
    <DisclosureContent className="!mt-0" id={filtersId} open={filters}><fieldset className="mt-4 rounded-xl border border-blue-200 p-2"><legend className="px-1 text-sm font-bold">{he ? 'סדרות' : 'Sets'}</legend><div className="catalog-type-filters">{([['excludeEnergy',he ? 'ללא אנרגיה' : 'Exclude Energy'],['excludeTrainers',he ? 'ללא טריינרים' : 'Exclude Trainers'],['holoOnly',he ? 'הולו בלבד' : 'Holo only']] as const).map(([field,label]) => <label key={field}><input type="checkbox" checked={current[field]} onChange={e => update({[field]:e.target.checked,limit:60})} />{label}</label>)}</div><button type="button" className="min-h-8 text-sm text-blue-700 underline" onClick={() => update({sets:[],limit:60})}>{he ? 'כל הסדרות' : 'All sets'}</button><div className="catalog-set-grid">{[...new Set(catalogCards.map(c => c.setName))].map(name => <label key={name} className="flex min-h-8 items-center gap-2 text-sm"><input type="checkbox" checked={sets.includes(name)} onChange={e => update({sets:e.target.checked ? [...sets,name] : sets.filter(s => s !== name),limit:60})} />{name}</label>)}</div></fieldset></DisclosureContent>

    {!results.length && <p>{he ? 'לא נמצאו קלפים' : 'No cards found'}</p>}
    <ul className={grid ? 'catalog-results catalog-grid' : 'catalog-results'}>{results.slice(0, limit).map(card => <li key={card.id}><button type="button" className="catalog-result" onClick={() => onSelect(card)}><PokemonArt src={card.imageUrl} alt={card.name} /><span className="min-w-0 flex-1"><span className="block font-bold"><bdi>{card.name}</bdi></span><span className="block text-sm text-slate-600">{card.setName} · #{card.number}</span>{!!owned[card.id] && <span className="catalog-ownership"><LuLayers aria-hidden />{he ? 'באוסף' : 'Owned'}</span>}{!owned[card.id] && wishlist.includes(card.id) && <span className="catalog-wishlist"><LuHeart aria-hidden />{he ? 'רשימת משאלות' : 'Wishlist'}</span>}</span><LuChevronRight aria-hidden className="size-5 shrink-0 rtl:rotate-180" /></button></li>)}</ul>
    {results.length > limit && <Button variant="outline" onClick={() => update({limit:limit+60})}>{he ? 'הצגת עוד' : 'Show more'}</Button>}
    </div>
  </div>;
}
