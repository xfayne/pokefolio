import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronRight, LuGrid2X2, LuList, LuSlidersHorizontal } from 'react-icons/lu';
import { SearchInput } from '@/components/ui/search-input';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { initialCatalogSearch, type CatalogSearchState } from './search-state';
import { Button } from '@/components/ui/button';
import { searchCatalog, catalogCards } from './catalog';
import type { InventoryCatalogCard } from '@/domain/inventory';
export function CatalogSearch({ query, onQuery, onSelect, owned = {}, state, onState }: { query: string; onQuery: (value: string) => void; onSelect: (card: InventoryCatalogCard) => void; owned?: Readonly<Record<string, number>>; state?: CatalogSearchState; onState?: (state: CatalogSearchState) => void }) {
  const { t, i18n } = useTranslation();
  const he = i18n.language === 'he';
  const [local, setLocal] = useState(initialCatalogSearch);
  const current = state ?? local;
  const { grid, filters, sets, limit } = current;
  const update = (patch: Partial<CatalogSearchState>) => (onState ?? setLocal)({ ...current, ...patch });
  const results = searchCatalog(query, sets);
  return <div className="catalog-search space-y-4">
    <SearchInput label={t('searchCards')} placeholder={t('searchPlaceholder')} value={query} onChange={e => { onQuery(e.target.value); update({limit:60}); }} />
    <div className="catalog-toolbar flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-sm font-bold">{results.length} {he ? 'תוצאות' : 'results'}</p><Button variant="outline" aria-expanded={filters} onClick={() => update({filters:!filters})}><LuSlidersHorizontal aria-hidden />{he ? 'סינון' : 'Filters'}{sets.length ? ` (${sets.length})` : ''}</Button><div className="catalog-view" role="group" aria-label={he ? 'תצוגה' : 'View'}><button type="button" aria-pressed={!grid} onClick={() => update({grid:false})}><LuList aria-hidden />{he ? 'רשימה' : 'List'}</button><button type="button" aria-pressed={grid} onClick={() => update({grid:true})}><LuGrid2X2 aria-hidden />{he ? 'רשת' : 'Grid'}</button></div></div>
    {filters && <fieldset className="rounded-xl border border-blue-200 p-2"><legend className="px-1 text-sm font-bold">{he ? 'סדרות' : 'Sets'}</legend><button type="button" className="min-h-8 text-sm text-blue-700 underline" onClick={() => update({sets:[],limit:60})}>{he ? 'כל הסדרות' : 'All sets'}</button><div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">{[...new Set(catalogCards.map(c => c.setName))].map(name => <label key={name} className="flex min-h-8 items-center gap-2 text-sm"><input type="checkbox" checked={sets.includes(name)} onChange={e => update({sets:e.target.checked ? [...sets,name] : sets.filter(s => s !== name),limit:60})} />{name}</label>)}</div></fieldset>}

    {!results.length && <p>{he ? 'לא נמצאו קלפים' : 'No cards found'}</p>}
    <ul className={grid ? 'catalog-results catalog-grid' : 'catalog-results'}>{results.slice(0, limit).map(card => <li key={card.id}><button type="button" className="catalog-result" onClick={() => onSelect(card)}><PokemonArt src={card.imageUrl} alt={card.name} /><span className="min-w-0 flex-1"><span className="block font-bold"><bdi>{card.name}</bdi></span><span className="block text-sm text-slate-600">{card.setName} · #{card.number}</span>{!!owned[card.id] && <span className="mt-2 inline-block rounded-full bg-blue-100 px-2 text-xs font-bold text-blue-800">{t('inventory.owned', { count: owned[card.id] })}</span>}</span><LuChevronRight aria-hidden className="size-5 shrink-0 rtl:rotate-180" /></button></li>)}</ul>
    {results.length > limit && <Button variant="outline" onClick={() => update({limit:limit+60})}>{he ? 'הצגת עוד' : 'Show more'}</Button>}
  </div>;
}
