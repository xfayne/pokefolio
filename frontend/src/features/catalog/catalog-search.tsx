import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronRight, LuGrid2X2, LuList, LuSlidersHorizontal } from 'react-icons/lu';
import { SearchInput } from '@/components/ui/search-input';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { searchCatalog, catalogCards } from './catalog';
import type { InventoryCatalogCard } from '@/domain/inventory';
export function CatalogSearch({ query, onQuery, onSelect, owned = {} }: { query: string; onQuery: (value: string) => void; onSelect: (card: InventoryCatalogCard) => void; owned?: Readonly<Record<string, number>> }) {
  const { t, i18n } = useTranslation();
  const he = i18n.language === 'he';
  const [grid, setGrid] = useState(false), [filters, setFilters] = useState(false), [setName, setSetName] = useState(''), [limit, setLimit] = useState(60);
  const results = searchCatalog(query, setName);
  return <div className="catalog-search space-y-4">
    <SearchInput autoFocus label={t('searchCards')} placeholder={t('searchPlaceholder')} value={query} onChange={e => { onQuery(e.target.value); setLimit(60); }} />
    <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-sm font-bold">{results.length} {he ? 'תוצאות' : 'results'}</p><Button variant="outline" aria-expanded={filters} onClick={() => setFilters(!filters)}><LuSlidersHorizontal aria-hidden />{he ? 'סינון' : 'Filters'}</Button><div className="catalog-view" role="group" aria-label={he ? 'תצוגה' : 'View'}><button type="button" aria-pressed={!grid} onClick={() => setGrid(false)}><LuList aria-hidden />{he ? 'רשימה' : 'List'}</button><button type="button" aria-pressed={grid} onClick={() => setGrid(true)}><LuGrid2X2 aria-hidden />{he ? 'רשת' : 'Grid'}</button></div></div>
    {filters && <label className="block text-sm font-bold">{he ? 'סדרה' : 'Set'}<Select value={setName} onChange={e => { setSetName(e.target.value); setLimit(60); }}><option value="">{he ? 'כל הסדרות' : 'All sets'}</option>{[...new Set(catalogCards.map(c => c.setName))].map(name => <option key={name}>{name}</option>)}</Select></label>}
    {!results.length && <p>{he ? 'לא נמצאו קלפים' : 'No cards found'}</p>}
    <ul className={grid ? 'catalog-results catalog-grid' : 'catalog-results'}>{results.slice(0, limit).map(card => <li key={card.id}><button type="button" className="catalog-result" onClick={() => onSelect(card)}><PokemonArt src={card.imageUrl} alt={card.name} /><span className="min-w-0 flex-1"><span className="block font-bold"><bdi>{card.name}</bdi></span><span className="block text-sm text-slate-600">{card.setName} · #{card.number}</span>{!!owned[card.id] && <span className="mt-2 inline-block rounded-full bg-blue-100 px-2 text-xs font-bold text-blue-800">{t('inventory.owned', { count: owned[card.id] })}</span>}</span><LuChevronRight aria-hidden className="size-5 shrink-0 rtl:rotate-180" /></button></li>)}</ul>
    {results.length > limit && <Button variant="outline" onClick={() => setLimit(limit + 60)}>{he ? 'הצגת עוד' : 'Show more'}</Button>}
  </div>;
}
