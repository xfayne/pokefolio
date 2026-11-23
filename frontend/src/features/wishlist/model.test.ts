import { expect, it } from 'vitest';
import { wishlistSchema, addWish, removeWish, reorderWish, positionWish, emptyWishlist } from './model';

const a = 'base3-5', b = 'neo2-13', c = 'basep-9';
it('preserves custom priority with stable reorder and numeric 1-based move', () => {
  const ids = [a,b,c];
  expect(reorderWish(ids, 2, 0)).toEqual([c,a,b]);
  expect(positionWish(ids, b, 3)).toEqual([a,c,b]);
  expect(ids).toEqual([a,b,c]);
  expect(() => positionWish(ids,b,0)).toThrow();
  expect(() => reorderWish(ids, 0, -1)).toThrow();
  expect(() => reorderWish(ids, 0, 3)).toThrow();
});
it('adds uniquely, removes only the requested wish, and never mutates input', () => {
  const ids = [a,b];
  expect(addWish(ids,a)).toEqual(ids);
  expect(addWish(ids,c)).toEqual([a,b,c]);
  expect(removeWish(ids,b)).toEqual([a]);
  expect(ids).toEqual([a,b]);
});
it('rejects malformed, foreign, duplicate and oversized Wishlist data', () => {
  const baseline = emptyWishlist('synthetic-owner');
  expect(wishlistSchema.parse(baseline)).toEqual(baseline);
  expect(() => wishlistSchema.parse({ ...baseline, cardIds: [a,a] })).toThrow();
  expect(() => wishlistSchema.parse({ ...baseline, cardIds: ['not-catalog'] })).toThrow();
  expect(() => wishlistSchema.parse({ ...baseline, cardIds: Array(1001).fill(a) })).toThrow();
});
