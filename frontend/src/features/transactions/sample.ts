import { cardCopySchema, purchaseSchema, saleLineSchema, saleSchema, type Money } from '@/domain/schema';
import { purchaseShipmentSchema } from '@/domain/purchase-details';
import { demoTransactionOwner } from './demo-context';
import type { HistoryData } from '@/domain/transaction-history';

// Synthetic records only. Opt-in URL preview, never stored or mixed with an account.
const ownerUid = demoTransactionOwner;
const at = '2026-11-20T10:00:00Z';
const metadata = { schemaVersion: 1, ownerUid, revision: 1, createdAt: at, updatedAt: at };
const known = <T,>(value: T) => ({ status: 'known' as const, value, source: 'user' as const });
const usd = (minor: number): Money => ({ currency: 'USD', minor });
const source = (seller: string, kind = 'manual') => ({ kind, seller, listingUrl: null, itemReference: null });
const catalog = [
  ['base3-42', 'Seadra', 'Fossil', '42/62'], ['base3-5', 'Gengar', 'Fossil', '5/62'], ['base2-57', 'Nidoran ♀', 'Jungle', '57/64'],
  ['base2-4', 'Jolteon', 'Jungle', '4/64'], ['base1-37', 'Nidorino', 'Base Set', '37/102'], ['base1-22', 'Pidgeotto', 'Base Set', '22/102'],
  ['base1-46', 'Charmander', 'Base Set', '46/102'], ['base1-18', 'Dragonair', 'Base Set', '18/102'], ['base1-55', 'Nidoran ♂', 'Base Set', '55/102'],
].map(([id = '', name = '', setName = '', number = '']) => ({ id, name, setName, number, imageUrl: `https://images.pokemontcg.io/${id.replace('-', '/')}.png` }));
const purchase = (id: string, date: string, seller: string, minor: number, shipping: number, kind = 'manual') => purchaseSchema.parse({
  ...metadata, id, kind: 'purchase', transactionOn: date, currency: 'USD', source: source(seller, kind), notes: '',
  pricingMode: 'per-copy', lotId: null, subtotal: known(usd(minor - shipping)), shipping: known(usd(shipping)), taxes: known(usd(0)), fees: known(usd(0)), payable: usd(minor), settlement: 'paid',
});
const specifications = [
  { id: 'sample-nov-19', date: '2026-11-19', seller: 'cardcorner', minor: 14200, shipping: 1200, prices: [5200, 4600, 3200], kind: 'ebay', cards: ['base3-42', 'base3-5', 'base2-57'], pending: true },
  { id: 'sample-nov-16', date: '2026-11-16', seller: 'Card shop', minor: 4200, shipping: 0, prices: [4200], kind: 'manual', cards: ['base2-4'], pending: false },
  { id: 'sample-nov-10', date: '2026-11-10', seller: 'eBay', minor: 12800, shipping: 0, prices: [3200, 3200, 3200, 3200], kind: 'ebay', cards: ['base1-46', 'base1-18', 'base1-55', 'base1-46'], pending: false },
];
const copies = specifications.flatMap(p => p.cards.map((cardId, index) => {
  const unit = p.prices[index]!;
  const cost = (minor: number) => ({ status: 'exact', value: usd(minor), evidenceRef: p.id });
  return cardCopySchema.parse({ ...metadata, id: `${p.id}-copy-${index}`, catalog: { kind: 'identified', cardId, edition: 'unlimited', language: known('en'), finish: known('standard') },
    condition: known(index === 1 ? 'NM' : 'LP'), acquisition: { kind: 'purchase', transactionId: p.id, lineId: `${p.id}-line-${index}`, unitOrdinal: 0 }, acquiredOn: known(p.date),
    possession: p.pending ? 'pending' : 'received', disposition: 'held', dispositionRecordId: null, cardCost: cost(unit), shippingCost: cost(p.shipping / p.cards.length), taxCost: cost(0), feeCost: cost(0), notes: '',
  });
}));
const saleId = 'sample-nov-14';
const soldCopies = ['base1-37', 'base1-22'].map((cardId, index) => cardCopySchema.parse({
  ...metadata, id: `sample-sold-${index}`, catalog: { kind: 'identified', cardId, edition: 'unlimited', language: known('en'), finish: known('standard') },
  condition: known('LP'), acquisition: { kind: 'opening-inventory', recordId: 'sample-opening' }, acquiredOn: { status: 'unknown', reason: 'No historical date' },
  possession: 'received', disposition: 'sold', dispositionRecordId: saleId,
  ...Object.fromEntries(['cardCost', 'shippingCost', 'taxCost', 'feeCost'].map(k => [k, { status: 'unknown', reason: 'No historical cost' }])), notes: '',
}));
export const sampleHistory: HistoryData = {
  ownerUid, catalog, copies: [...copies, ...soldCopies],
  transactions: [...specifications.map(p => purchase(p.id, p.date, p.seller, p.minor, p.shipping, p.kind)), saleSchema.parse({ ...metadata, id: saleId,
    kind: 'sale', transactionOn: '2026-11-14', currency: 'USD', source: source('Local buyer'), notes: '',
    cardProceeds: known(usd(8500)), buyerShipping: known(usd(0)), sellingFees: known(usd(0)), sellerShipping: known(usd(0)), sellingTaxes: known(usd(0)),
  })],
  saleLines: soldCopies.map((copy, index) => saleLineSchema.parse({ ...metadata, id: `sample-sale-line-${index}`, transactionId: saleId, copyId: copy.id,
    proceeds: { status: 'exact', value: usd(4250), evidenceRef: saleId }, expenses: { status: 'exact', value: usd(0), evidenceRef: saleId },
  })),
  inTransit: [{ ownerUid, transactionId: 'sample-nov-19' }],
};

export const samplePurchaseShipments = [purchaseShipmentSchema.parse({
  id: 'sample-royal-mail', ownerUid, transactionId: 'sample-nov-19',
  copyIds: ['sample-nov-19-copy-0', 'sample-nov-19-copy-1', 'sample-nov-19-copy-2'],
  carrier: 'Royal Mail', trackingNumber: 'DEMO-RM00004821GB', status: 'inTransit',
  events: [
    { id: 'departed', code: 'departed', description: 'Departed origin country', occurredAt: '2026-11-19T14:30:00Z' },
    { id: 'accepted', code: 'accepted', description: 'Accepted by carrier', occurredAt: '2026-11-18T11:20:00Z' },
    { id: 'registered', code: 'registered', description: 'Tracking number received', occurredAt: '2026-11-17T09:00:00Z' },
  ],
})];
