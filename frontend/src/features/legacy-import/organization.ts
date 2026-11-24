import { z } from 'zod';
import { binderSchema, capacity } from '@/features/binder/model';
import { wishlistCardId, wishlistSchema } from '@/features/wishlist/model';
import type { CardCopy } from '@/domain/schema';
import { normalizeImportedBinderOrder } from './binder-order';

const sourceSchema = z.object({
  mappingVersion: z.literal(3),
  status: z.literal('PASS'),
  source: z.object({ ownerUid: z.string().min(1) }),
  preservedProgress: z.object({
    wish: z.record(z.string(), z.boolean()),
    wishOrder: z.array(wishlistCardId).max(1000),
    binderOrder: z.array(z.string()).max(capacity),
    binderIncludeWish: z.boolean().optional(),
  }),
  binderReferences: z.array(z.object({
    index: z.number().int().nonnegative(),
    token: z.string(),
    kind: z.enum(['copy', 'wish', 'empty']),
    copyId: z.string().nullable(),
  })),
});

/** Pure materialization. Validate source indexes before normalizing physical left/right positions. */
export function materializeLegacyOrganization(rawReport: unknown, copies: readonly CardCopy[], ownerUid: string) {
  const report = sourceSchema.parse(rawReport);
  if (report.source.ownerUid !== ownerUid) throw Error('OWNER_MISMATCH');
  const source = report.preservedProgress;
  const wished = Object.keys(source.wish).filter(id => source.wish[id]);
  if (new Set(source.wishOrder).size !== source.wishOrder.length ||
      wished.length !== source.wishOrder.length ||
      source.wishOrder.some(id => source.wish[id] !== true)) throw Error('WISHLIST_ORDER_MISMATCH');
  const byCard = new Map<string, string>();
  for (const copy of copies) {
    if (copy.ownerUid !== ownerUid || copy.catalog.kind !== 'identified' || byCard.has(copy.catalog.cardId)) {
      throw Error('INVALID_LEGACY_COPY_MAPPING');
    }
    byCard.set(copy.catalog.cardId, copy.id);
  }
  if (report.binderReferences.length !== source.binderOrder.length) throw Error('BINDER_REFERENCE_MISMATCH');
  const wishSet = new Set(source.wishOrder);
  const pockets = source.binderOrder.map((token, index) => {
    const ref = report.binderReferences[index];
    if (!ref || ref.index !== index || ref.token !== token) throw Error('BINDER_REFERENCE_MISMATCH');
    if (token.startsWith('__binder_empty__:')) {
      if (ref.kind !== 'empty') throw Error('BINDER_REFERENCE_MISMATCH');
      return { kind: 'empty' as const, token };
    }
    const copyId = byCard.get(token);
    if (copyId) {
      if (ref.kind !== 'copy' || ref.copyId !== copyId) throw Error('BINDER_REFERENCE_MISMATCH');
      return { kind: 'copy' as const, copyId };
    }
    if (wishSet.has(token) && ref.kind === 'wish') return { kind: 'wish' as const, cardId: token };
    throw Error('UNRESOLVED_BINDER_REFERENCE');
  });
  const binder = binderSchema.parse({
    schemaVersion: 1, ownerUid, revision: 1, pockets: normalizeImportedBinderOrder(pockets),
    includeWish: source.binderIncludeWish ?? true,
  });
  const wishlist = wishlistSchema.parse({
    schemaVersion: 1, ownerUid, revision: 1, cardIds: [...source.wishOrder],
  });
  return { binder, wishlist };
}
