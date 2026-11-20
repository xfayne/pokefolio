import { cardCopySchema, type CardCopy, type Condition } from '@/domain/schema';
import type { CopyQuote, InventoryCatalogCard } from '@/domain/inventory';

// Explicitly synthetic, opt-in preview. Never merged with authenticated holdings.
export const sampleOwner = 'sample-owner';
export const sampleCatalog: InventoryCatalogCard[] = [
  { id: 'base1-4', name: 'Charizard', setName: 'Base Set', number: '4/102', imageUrl: 'https://images.pokemontcg.io/base1/4.png' },
  { id: 'base3-5', name: 'Gengar', setName: 'Fossil', number: '5/62', imageUrl: 'https://images.pokemontcg.io/base3/5.png' },
  { id: 'base2-11', name: 'Snorlax', setName: 'Jungle', number: '11/64', imageUrl: 'https://images.pokemontcg.io/base2/11.png' },
];
const at = '2026-11-20T10:00:00Z';
function make(id: string, cardId: string, condition: Condition, minor: number | null, possession: CardCopy['possession'] = 'received'): CardCopy {
  const cost = minor === null ? { status: 'unknown', reason: 'No historical price' } : { status: 'exact', value: { currency: 'USD', minor }, evidenceRef: `purchase-${id}` };
  const zero = { status: 'exact', value: { currency: 'USD', minor: 0 }, evidenceRef: `purchase-${id}` };
  return cardCopySchema.parse({ schemaVersion: 1, id, ownerUid: sampleOwner, revision: 1, createdAt: at, updatedAt: at,
    catalog: { kind: 'identified', cardId, edition: 'unlimited', language: { status: 'known', value: 'en', source: 'user' }, finish: { status: 'known', value: 'holo', source: 'user' } },
    condition: { status: 'known', value: condition, source: 'user' },
    acquisition: { kind: 'purchase', transactionId: `purchase-${id}`, lineId: `line-${id}`, unitOrdinal: 0 },
    acquiredOn: { status: 'known', value: '2026-11-12', source: 'user' }, possession, disposition: 'held',
    cardCost: cost, shippingCost: zero, taxCost: zero, feeCost: zero, dispositionRecordId: null, notes: '',
  });
}
export function createSampleCopies(): CardCopy[] {
  return [make('charizard-a', 'base1-4', 'NM', 18000), make('charizard-b', 'base1-4', 'LP', 15000),
    make('gengar-a', 'base3-5', 'LP', 4500), make('gengar-pending', 'base3-5', 'MP', 3000, 'pending'), make('snorlax-a', 'base2-11', 'LP', null)];
}
export const sampleQuotes: CopyQuote[] = createSampleCopies().filter(c => c.id !== 'snorlax-a').map(c => ({
  catalog: c.catalog, condition: c.condition.status === 'known' ? c.condition.value : 'LP',
  money: { currency: 'USD', minor: c.id === 'charizard-a' ? 26000 : c.id === 'charizard-b' ? 22000 : c.id === 'gengar-a' ? 6500 : 4200 },
  observedAt: at, source: 'Synthetic preview price',
}));
