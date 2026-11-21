export type CatalogSearchState = { grid: boolean; filters: boolean; sets: string[]; limit: number };
export const initialCatalogSearch: CatalogSearchState = { grid: false, filters: false, sets: [], limit: 60 };
