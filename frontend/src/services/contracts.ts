export type CatalogCard = Readonly<{ id: string; setId: string; name: string; number: string; imageUrl: string }>;
export type Condition = 'NM' | 'LP' | 'MP' | 'HP' | 'DAMAGED';
export type Currency = 'ILS' | 'USD' | 'EUR' | 'GBP';
export type MarketQuote = Readonly<{ cardId: string; condition: Condition; currency: Currency; amount: number; observedAt: string; source: string }>;
export interface CatalogService { search(query: string, signal?: AbortSignal): Promise<readonly CatalogCard[]> }
export interface PriceService { quote(cardId: string, condition: Condition, signal?: AbortSignal): Promise<MarketQuote | null> }
// Inventory and transaction persistence models require their own approved roadmap design.
// These contracts do not define a new Firestore schema or invent historical costs.
