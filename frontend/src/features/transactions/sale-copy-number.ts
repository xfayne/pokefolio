import type { CardCopy } from '@/domain/schema';
// Match the inventory's catalog grouping and stable creation order. Include sold
// history so a copy keeps its number when this sale is edited or reversed.
export function saleCopyNumber(copy: CardCopy, copies: readonly CardCopy[]): number {
  return copies.filter(c => copy.catalog.kind === 'identified' && c.catalog.kind === 'identified' ? copy.catalog.cardId === c.catalog.cardId : c.id === copy.id)
    .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).findIndex(c=>c.id===copy.id)+1;
}
