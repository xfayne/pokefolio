import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getFirebaseServices } from '@/services/firebase';
import { emptyWishlist, wishlistSchema, type Wishlist } from './model';
import { readWishlist, saveWishlist } from './storage';

export function useWishlist() {
  const auth = useAuth();
  const owner = auth.user?.uid;
  const client = useQueryClient();
  const key = ['wishlist', owner];
  const query = useQuery({
    queryKey: key, enabled: !!owner,
    queryFn: () => readWishlist(getFirebaseServices()!.db, owner!),
    staleTime: 30_000, retry: 1,
  });
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const wishlist = owner && query.data ? query.data : emptyWishlist(owner ?? 'disconnected');
  async function update(change: (ids: readonly string[]) => string[]) {
    if (!owner || !query.data || query.isError || writing.current ||
        getFirebaseServices()?.auth.currentUser?.uid !== owner)
      throw Error('Wishlist unavailable');
    const before = query.data;
    const ids = change(before.cardIds);
    if (ids.every((id, i) => id === before.cardIds[i]) && ids.length === before.cardIds.length) return;
    const next: Wishlist = wishlistSchema.parse({ ...before, cardIds: ids });
    writing.current = true;
    setBusy(true);
    client.setQueryData(key, next);
    try {
      const saved = await saveWishlist(getFirebaseServices()!.db, owner, before, next);
      client.setQueryData(key, saved);
    } catch (error) {
      // Never leave an optimistic order or membership on a rejected transaction.
      client.setQueryData(key, before);
      throw error;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  return {
    owner, wishlist, busy, update,
    loading: auth.status === 'loading' || (!!owner && query.isPending),
    error: auth.error ?? query.error,
    retry: () => { void query.refetch(); },
  };
}
