import type { Condition, Currency } from '../domain/schema';
export type { Condition, Currency } from '../domain/schema';
export type CatalogCard = Readonly<{ id: string; setId: string; name: string; number: string; imageUrl: string }>;
export type MarketQuote = Readonly<{ cardId: string; condition: Condition; currency: Currency; amount: number; observedAt: string; source: string }>;
export interface CatalogService { search(query: string, signal?: AbortSignal): Promise<readonly CatalogCard[]> }
export interface PriceService { quote(cardId: string, condition: Condition, signal?: AbortSignal): Promise<MarketQuote | null> }
// Private inventory/transaction DTOs are defined in the approved domain module.
// API quotes remain display amounts; no Firestore adapter is enabled here.
