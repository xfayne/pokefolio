import { doc, getDocFromServer, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import { idSchema } from '@/domain/schema';
import { emptyWishlist, wishlistSchema, type Wishlist } from './model';

const reference = (db: Firestore, owner: string) => {
  idSchema.parse(owner);
  return doc(db, 'users/' + owner + '/wishlists/main');
};

export function decodeWishlist(data: Record<string, unknown>, owner: string): Wishlist {
  if (typeof data.ids !== 'string') throw Error('Invalid Wishlist format');
  const wishlist = wishlistSchema.parse({
    schemaVersion: data.schemaVersion, ownerUid: data.ownerUid, revision: data.revision,
    cardIds: data.ids ? data.ids.split(';') : [],
  });
  if (wishlist.ownerUid !== owner || wishlist.revision < 1) throw Error('Invalid Wishlist owner or revision');
  return wishlist;
}
export async function readWishlist(db: Firestore, owner: string): Promise<Wishlist> {
  const snapshot = await getDocFromServer(reference(db, owner));
  return snapshot.exists() ? decodeWishlist(snapshot.data(), owner) : emptyWishlist(owner);
}
export async function saveWishlist(db: Firestore, owner: string, before: Wishlist, next: Wishlist): Promise<Wishlist> {
  wishlistSchema.parse(next);
  if (before.ownerUid !== owner || next.ownerUid !== owner ||
      before.schemaVersion !== next.schemaVersion || next.revision !== before.revision)
    throw Error('Invalid Wishlist edit');
  return runTransaction(db, async tx => {
    const target = reference(db, owner), snapshot = await tx.get(target);
    const current = snapshot.exists() ? decodeWishlist(snapshot.data(), owner) : emptyWishlist(owner);
    if (JSON.stringify(current) !== JSON.stringify(before)) throw Error('Wishlist changed. Reload before saving.');
    const saved = { ...next, revision: current.revision + 1 };
    tx.set(target, {
      schemaVersion: 1, ownerUid: owner, revision: saved.revision,
      ids: saved.cardIds.join(';'), updatedAt: serverTimestamp(),
    });
    return saved;
  });
}
