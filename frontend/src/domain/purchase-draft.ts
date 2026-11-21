import { z } from 'zod';
import { catalogRefSchema, conditionSchema, currencySchema, dateSchema, idSchema, lotSchema, shipmentMembershipSchema, shipmentSchema, type Money } from './schema';
import { planPurchase } from './purchase';
import { parseMoney, splitMoney, sumMoney } from './money';
import { purchaseShipmentSchema } from './purchase-details';

export const purchaseDraftSchema = z.strictObject({
  id: idSchema, date: z.string(), source: z.enum(['manual', 'ebay', 'other']), seller: z.string().max(200), currency: currencySchema,
  pricingMode: z.enum(['per-copy', 'lot-total']), shipping: z.string(), lotTotal: z.string(),
  cards: z.array(z.strictObject({ id: idSchema, catalog: catalogRefSchema, condition: z.union([conditionSchema, z.literal('unknown')]), amount: z.string() })).max(1000),
  listingUrl: z.string().max(2000).optional(), itemReference: z.string().max(200).optional(),
  trackingNumber: z.string().max(100), carrier: z.string().max(200),
});
export type PurchaseDraft = z.infer<typeof purchaseDraftSchema>;
export type DraftIssue = Readonly<{ field: string; code: 'date' | 'seller' | 'cards' | 'amount' | 'duplicate' | 'url' }>;
export function previewPurchaseDraft(draft: PurchaseDraft) {
  const issues: DraftIssue[] = [];
  if (draft.listingUrl?.trim() && !z.url().refine(url => /^https?:\/\//.test(url)).safeParse(draft.listingUrl.trim()).success) issues.push({ field: 'listingUrl', code: 'url' });
  if (!dateSchema.safeParse(draft.date).success) issues.push({ field: 'date', code: 'date' });
  if (draft.source === 'manual' && !draft.seller.trim()) issues.push({ field: 'seller', code: 'seller' });
  if (!draft.cards.length) issues.push({ field: 'cards', code: 'cards' });
  if (new Set(draft.cards.map(c => c.id)).size !== draft.cards.length) issues.push({ field: 'cards', code: 'duplicate' });
  const amount = (raw: string, field: string, optional = false): Money | null => {
    try { return parseMoney(raw.trim() || (optional ? '0' : ''), draft.currency); }
    catch { issues.push({ field, code: 'amount' }); return null; }
  };
  const prices = draft.pricingMode === 'per-copy' ? draft.cards.map(c => amount(c.amount, `cost-${c.id}`)) : [];
  let subtotal: Money | null = null;
  try { subtotal = draft.pricingMode === 'lot-total' ? amount(draft.lotTotal, 'lotTotal') : prices.every((p): p is Money => p !== null) ? sumMoney(prices, draft.currency) : null; }
  catch { issues.push({ field: 'cards', code: 'amount' }); }
  const shipping = amount(draft.shipping, 'shipping', true);
  let total: Money | null = null;
  try { total = subtotal && shipping ? sumMoney([subtotal, shipping], draft.currency) : null; }
  catch { issues.push({ field: 'shipping', code: 'amount' }); }
  const allocation = shipping && draft.cards.length && new Set(draft.cards.map(c => c.id)).size === draft.cards.length ? [...splitMoney(shipping, draft.cards.map(c => c.id)).values()] : [];
  const range = allocation.length ? { min: Math.min(...allocation.map(a => a.minor)), max: Math.max(...allocation.map(a => a.minor)) } : null;
  return { issues, subtotal, shipping, total, range };
}

/** Pure write plan only. Price/date entry does not confirm a payment or its date. */
export function preparePurchaseDraft(ownerUid: string, input: PurchaseDraft, at: string) {
  idSchema.parse(ownerUid);
  const draft = purchaseDraftSchema.parse(input);
  const preview = previewPurchaseDraft(draft);
  if (preview.issues.length || !preview.subtotal || !preview.shipping || !preview.total) throw Error('Invalid purchase draft');
  const metadata = { schemaVersion: 1, ownerUid, revision: 1, createdAt: at, updatedAt: at };
  const known = (value: Money) => ({ status: 'known', value, source: 'user' });
  const lotId = draft.pricingMode === 'lot-total' ? `${draft.id}-lot` : null;
  const purchase = { ...metadata, id: draft.id, kind: 'purchase', transactionOn: draft.date, currency: draft.currency,
    source: { kind: draft.source, seller: draft.seller.trim() || null, listingUrl: draft.listingUrl?.trim() || null, itemReference: draft.itemReference?.trim() || null }, notes: '', pricingMode: draft.pricingMode, lotId,
    subtotal: known(preview.subtotal), shipping: known(preview.shipping), taxes: known({ currency: draft.currency, minor: 0 }), fees: known({ currency: draft.currency, minor: 0 }),
    payable: preview.total, settlement: 'unknown',
  };
  const lines = draft.cards.map((card, ordinal) => ({ ...metadata, id: `${card.id}-line`, transactionId: draft.id, ordinal, quantity: 1, catalog: card.catalog.kind === 'identified' ? { ...card.catalog, edition: card.catalog.edition === 'first-edition' ? 'first-edition' : 'unlimited' } : card.catalog,
    pricing: lotId ? { mode: 'lot-total', lotId } : { mode: 'per-copy', unitPrice: parseMoney(card.amount.trim(), draft.currency) },
  }));
  const seeds = draft.cards.map(card => ({ id: card.id, lineId: `${card.id}-line`, unitOrdinal: 0,
    condition: card.condition === 'unknown' ? { status: 'unknown', reason: 'Not recorded' } : { status: 'known', value: card.condition, source: 'user' }, possession: 'pending', notes: '',
  }));
  const plan = planPurchase(ownerUid, purchase, lines, seeds, null);
  const lot = lotId ? lotSchema.parse({ ...metadata, id: lotId, transactionId: draft.id, subtotal: known(preview.subtotal), totalCopyCount: { status: 'known', value: draft.cards.length, source: 'user' }, allocation: 'unallocated', description: '' }) : null;
  const trackingNumber = draft.trackingNumber.trim();
  const shipment = trackingNumber || draft.carrier.trim() ? shipmentSchema.parse({ ...metadata, id: `${draft.id}-shipment`, carrier: draft.carrier.trim() || null, trackingNumber: trackingNumber || null, deliveredOn: { status: 'unknown', reason: 'Not delivered' }, notes: '' }) : null;
  const memberships = shipment ? plan.copies.map((copy, ordinal) => shipmentMembershipSchema.parse({ ...metadata, id: `${copy.id}-membership`, shipmentId: shipment.id, transactionId: draft.id, copyId: copy.id, ordinal })) : [];
  const snapshot = shipment ? purchaseShipmentSchema.parse({ id: shipment.id, ownerUid, transactionId: draft.id, copyIds: plan.copies.map(c => c.id), carrier: draft.carrier.trim() || '—', trackingNumber: shipment.trackingNumber, status: 'pending', events: [] }) : null;
  return { plan, lot, shipment, memberships, snapshot };
}
export type PreparedPurchaseDraft = ReturnType<typeof preparePurchaseDraft>;
