// Store only exclusions so new Wishlist entries are selected by default.
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
const key = (owner: string) => 'pokefolio-deals-excluded-v1:' + owner;
export function readExclusions(storage: Storage, owner: string): string[] {
  try {
    const raw: unknown = JSON.parse(storage.getItem(key(owner)) ?? '[]');
    return Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === 'string' && /^[a-z0-9-]{2,40}$/i.test(id)))] : [];
  } catch { return []; }
}
export function saveExclusions(storage: Storage, owner: string, ids: readonly string[]): boolean {
  try { storage.setItem(key(owner), JSON.stringify([...new Set(ids)])); return true; }
  catch { return false; }
}
export function selectedIds(wishlist: readonly string[], excluded: readonly string[]): string[] {
  const skip = new Set(excluded);
  return wishlist.filter(id => !skip.has(id));
}
