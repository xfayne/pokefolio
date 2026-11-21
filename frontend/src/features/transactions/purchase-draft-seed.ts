import type { PurchaseDraft } from '@/domain/purchase-draft';
import { sampleHistory } from './sample';

export function createPurchaseDraft(preview: boolean): PurchaseDraft {
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return {
    id: `${preview ? 'demo-purchase' : 'purchase'}-${crypto.randomUUID()}`, date: preview ? '2026-11-19' : today, source: preview ? 'ebay' : 'manual', seller: preview ? 'cardcorner' : '', currency: 'USD', pricingMode: 'per-copy',
    cards: preview ? sampleHistory.copies.slice(0, 3).map(copy => ({ id: `demo-copy-${crypto.randomUUID()}`, catalog: copy.catalog, condition: copy.condition.status === 'known' ? copy.condition.value : 'unknown', amount: copy.cardCost.status === 'exact' ? (copy.cardCost.value.minor / 100).toFixed(2) : '' })) : [],
    shipping: preview ? '12.00' : '', lotTotal: '', trackingNumber: '', carrier: '',
  };
}

