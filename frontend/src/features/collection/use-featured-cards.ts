import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDocFromServer, serverTimestamp, setDoc } from 'firebase/firestore';
import { z } from 'zod';
import { wishlistCardId } from '@/features/wishlist/model';
import { getFirebaseServices } from '@/services/firebase';

const featuredSchema = z.array(wishlistCardId).max(5).refine(ids => new Set(ids).size === ids.length);

export function useFeaturedCards(owner: string | undefined, preview: boolean) {
  const client = useQueryClient();
  const key = ['featured-collection', owner];
  const [demo, setDemo] = useState(['base1-4', 'base3-5', 'base2-11']);
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: key, enabled: !!owner && !preview, retry: 1,
    queryFn: async () => {
      const snapshot = await getDocFromServer(doc(getFirebaseServices()!.db, `users/${owner}/preferences/collection`));
      return snapshot.exists() ? featuredSchema.parse(snapshot.data().featuredCardIds) : [];
    },
  });
  return { ids: preview ? demo : query.data ?? [], busy,
    loading: !preview && !!owner && query.isPending, error: !preview && query.isError,
    retry: () => { void query.refetch(); },
    save: async (ids: string[]) => {
      featuredSchema.parse(ids);
      if (preview) { setDemo(ids); return; }
      const firebase = getFirebaseServices();
      if (!owner || firebase?.auth.currentUser?.uid !== owner || query.isPending || query.isError) throw Error('Collection preference unavailable');
      setBusy(true);
      try {
        await setDoc(doc(firebase.db, `users/${owner}/preferences/collection`), { featuredCardIds: ids, updatedAt: serverTimestamp() });
        client.setQueryData(key, ids);
      } finally { setBusy(false); }
    },
  };
}
