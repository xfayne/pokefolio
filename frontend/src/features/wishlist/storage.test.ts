import { expect, it } from 'vitest';
import { decodeWishlist } from './storage';

it('decodes only owner-scoped, versioned and unique catalog IDs', () => {
  expect(decodeWishlist({schemaVersion:1,ownerUid:'alice',revision:2,ids:'base3-5;neo2-13'},'alice').cardIds).toEqual(['base3-5','neo2-13']);
  expect(() => decodeWishlist({schemaVersion:1,ownerUid:'bob',revision:2,ids:'base3-5'},'alice')).toThrow();
  expect(() => decodeWishlist({schemaVersion:1,ownerUid:'alice',revision:1,ids:'base3-5;base3-5'},'alice')).toThrow();
  expect(() => decodeWishlist({schemaVersion:1,ownerUid:'alice',revision:1,ids:'base3-5;arbitrary'},'alice')).toThrow();
  expect(() => decodeWishlist({schemaVersion:1,ownerUid:'alice',revision:0,ids:''},'alice')).toThrow();
});
