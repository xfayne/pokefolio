import { z } from 'zod';
import { idSchema } from '@/domain/schema';

export const wishlistCardId = z.string().regex(/^(?:(?:base[1-6]|basep|gym[12]|neo[1-4]|si1)-[1-9][0-9]{0,2}|movie2000-ancient-mew)$/);
export const wishlistSchema = z.strictObject({
  schemaVersion: z.literal(1),
  ownerUid: idSchema,
  revision: z.number().int().nonnegative().safe(),
  cardIds: z.array(wishlistCardId).max(1000),
}).superRefine((wishlist, ctx) => {
  if (new Set(wishlist.cardIds).size !== wishlist.cardIds.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate Wishlist card' });
});
export type Wishlist = z.infer<typeof wishlistSchema>;
export function emptyWishlist(ownerUid: string): Wishlist {
  return { schemaVersion: 1, ownerUid, revision: 0, cardIds: [] };
}
export function addWish(ids: readonly string[], id: string): string[] {
  wishlistCardId.parse(id);
  return ids.includes(id) ? [...ids] : [...ids, id];
}
export function removeWish(ids: readonly string[], id: string): string[] {
  return ids.filter(value => value !== id);
}
export function reorderWish(ids: readonly string[], from: number, to: number): string[] {
  if (![from, to].every(n => Number.isSafeInteger(n) && n >= 0 && n < ids.length))
    throw Error('Invalid Wishlist position');
  const result = [...ids];
  const [card] = result.splice(from, 1);
  result.splice(to, 0, card!);
  return result;
}
export function positionWish(ids: readonly string[], id: string, position: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) throw Error('Wishlist card is missing');
  return reorderWish(ids, from, position - 1);
}
