export type CatalogSearchState = { grid: boolean; filters: boolean; sets: string[]; limit: number; excludeEnergy: boolean; excludeTrainers: boolean; holoOnly: boolean };
export const initialCatalogSearch: CatalogSearchState = { grid: false, filters: false, sets: [], limit: 60, excludeEnergy: false, excludeTrainers: false, holoOnly: false };
