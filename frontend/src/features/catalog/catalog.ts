import { promoProducts } from './promo-products';
import source from './catalog-data.json';
import type { InventoryCatalogCard } from '@/domain/inventory';
import type { CatalogRef } from '@/domain/schema';
const packs = source.OFFLINE_PACKS as Record<string, (string | number | null)[]>;
export const catalogCards: readonly InventoryCatalogCard[] = source.SETS.flatMap(set => {
  const names = String(packs[set.id]?.[0] ?? '').split('|').filter(Boolean);
  const total = set.id === 'basep' ? null : ({base5:82, neo3:64, neo4:105} as Record<string, number>)[set.id] ?? set.count;
  return names.filter(Boolean).map((name, index) => ({ id: `${set.id}-${index + 1}`, name, setName: set.name, number: total ? `${index + 1}/${total}` : String(index + 1), imageUrl: `https://images.pokemontcg.io/${set.id}/${index + 1}.png` }));
}).concat([{ id: 'movie2000-ancient-mew', name: 'Ancient Mew', setName: 'Movie Promo 2000', number: '—', imageUrl: `${import.meta.env.BASE_URL}assets/ancient-mew.jpg` }]);
export const catalogReference = (cardId: string): CatalogRef => ({ kind: 'identified', cardId, edition: 'unknown', language: { status: 'known', value: 'en', source: 'provider' }, finish: { status: 'unknown', reason: 'Not selected' } });
export function searchCatalog(query: string, selectedSets: string | readonly string[] = [], filters: {excludeEnergy?: boolean; excludeTrainers?: boolean; holoOnly?: boolean} = {}) {
  const sets = typeof selectedSets === 'string' ? selectedSets ? [selectedSets] : [] : selectedSets;
  const terms = query.toLocaleLowerCase().normalize('NFKC').trim().split(/\s+/).filter(Boolean);
  return catalogCards.filter(card => { const traits = catalogTraits(card.id); return (!filters.excludeEnergy || traits.kind !== 'Energy') && (!filters.excludeTrainers || traits.kind !== 'Trainer') && (!filters.holoOnly || traits.holo) && (!sets.length || sets.includes(card.setName)) && terms.every(term => `${card.name} ${card.setName} ${card.number} ${card.id}`.toLocaleLowerCase().includes(term.replace(/^#/, ''))); });
}

/** Catalog display defaults, never used as evidence for a purchased copy. */
export function catalogMarketReference(cardId: string): CatalogRef {
 const ref = catalogReference(cardId); if (ref.kind !== 'identified') return ref;
 const [setId, rawNumber] = cardId.split('-');
 const specs = String(packs[setId ?? '']?.[1] ?? '').split(';');
 const type = specs.find(spec => Number(rawNumber) <= Number(spec.split(':')[0]))?.split(':')[1];
 const holo = cardId === 'movie2000-ancient-mew' || type === 'H' || type === 'S' || (setId === 'si1' && [1,4,7,11,14,17].includes(Number(rawNumber)));
 return {...ref,edition:cardId === 'base1-8' ? 'first-edition' : 'unlimited',finish:{status:'known',value:setId === 'basep' ? promoProducts[Number(rawNumber)]?.finish ?? 'normal' : holo ? 'holo' : 'normal',source:'provider'}};
}

export function catalogTraits(cardId: string): {kind:'Pokemon'|'Trainer'|'Energy';holo:boolean} {
 if (cardId === 'movie2000-ancient-mew') return {kind:'Pokemon',holo:true};
 const [set = '', raw] = cardId.split('-'); const number=Number(raw); const pack=packs[set];
 let kind: 'Pokemon'|'Trainer'|'Energy' = number <= Number(pack?.[2]) ? 'Pokemon' : pack?.[3] != null && number >= Number(pack[3]) ? 'Energy' : 'Trainer';
 if ((set==='base5' && [17,80,81,82].includes(number)) || (set==='base1' && number===96) || (set==='neo1' && [19,104,105].includes(number)) || (set==='neo4' && number===16) || (set==='base6' && [100,101].includes(number))) kind='Energy';
 if ((set==='neo3' && [65,66].includes(number)) || (set==='neo4' && number>=106 && number<=113)) kind='Pokemon';
 if (set==='basep' && [16,40,41,42].includes(number)) kind='Trainer';
 const reference=catalogMarketReference(cardId);
 const holo=reference.kind==='identified' && reference.finish.status==='known' && ['holo','shining','reverse'].includes(reference.finish.value);
 return {kind,holo};
}
