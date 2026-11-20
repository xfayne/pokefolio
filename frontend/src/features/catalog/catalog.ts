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
export function searchCatalog(query: string, setName = '') {
  const terms = query.toLocaleLowerCase().normalize('NFKC').trim().split(/\s+/).filter(Boolean);
  return catalogCards.filter(card => (!setName || card.setName === setName) && terms.every(term => `${card.name} ${card.setName} ${card.number} ${card.id}`.toLocaleLowerCase().includes(term.replace(/^#/, ''))));
}
