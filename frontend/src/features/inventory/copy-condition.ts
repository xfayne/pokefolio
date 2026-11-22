import { conditionSchema } from '@/domain/schema';
import type { CopyView } from '@/domain/inventory';

// Rank metadata only; never change ownership or a copy's recorded condition.
export function bestCopy(copies: readonly CopyView[]) {
  return copies.filter(v => v.copy.disposition === 'held' && v.copy.condition.status === 'known').toSorted((a, b) =>
    conditionSchema.options.indexOf(a.copy.condition.status === 'known' ? a.copy.condition.value : 'DAMAGED') -
    conditionSchema.options.indexOf(b.copy.condition.status === 'known' ? b.copy.condition.value : 'DAMAGED'))[0];
}

