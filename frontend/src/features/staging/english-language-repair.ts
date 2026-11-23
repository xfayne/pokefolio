import { cardCopySchema, type CardCopy } from '@/domain/schema';
import type { CopyChange } from '@/domain/lifecycle';

/** Owner-confirmed source correction. Never infer physical printing/grade or cost. */
export function planStagingEnglishCorrection(
  owner: string,
  rawCopies: readonly CardCopy[],
  at: string,
): CopyChange[] {
  const copies = rawCopies.map(copy => cardCopySchema.parse(copy));
  if (copies.some(copy => copy.ownerUid !== owner) ||
      new Set(copies.map(copy => copy.id)).size !== copies.length) {
    throw Error('Invalid staging copy ownership or duplicate identity');
  }
  return copies.flatMap(before => {
    if (before.catalog.kind !== 'identified') return [];
    const evidence = before.catalog.language;
    if (evidence.status === 'known' &&
        ['en', 'english'].includes(evidence.value.trim().toLowerCase())) return [];
    const after = cardCopySchema.parse({
      ...before,
      catalog: {
        ...before.catalog,
        language: { status: 'known', value: 'English', source: 'user' },
      },
      revision: before.revision + 1,
      updatedAt: at,
    });
    if (Date.parse(after.updatedAt) < Date.parse(before.updatedAt))
      throw Error('Staging repair cannot precede a recorded edit');
    return [{ before, after }];
  });
}
