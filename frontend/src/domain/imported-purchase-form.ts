import { importedPurchaseEditDraft, importedPurchaseEditCommit, type ImportedPurchaseEditDraft } from './imported-purchase-edit';
import { previewPurchaseDraft, type PurchaseDraft } from './purchase-draft';
import type { PortfolioRecord, PortfolioCommit } from './persistence';

export type ImportedFormSeed = Readonly<{
  draft: PurchaseDraft;
  currencyChosen: boolean;
  original: ImportedPurchaseEditDraft;
}>;

/** An imported record retains historical evidence in storage. Its editor is the ordinary purchase form. */
export function importedPurchaseFormSeed(records: readonly PortfolioRecord[], id: string): ImportedFormSeed {
  const transaction = records.find(e=>e.collection==='transactions' && e.record.id===id);
  if (!transaction || transaction.collection!=='transactions' || transaction.record.kind!=='purchase' ||
      !('origin' in transaction.record)) throw Error('Imported purchase unavailable');
  const original = importedPurchaseEditDraft(records,id);
  const p = transaction.record;
  const recorded = [...new Set(original.cards.filter(c=>c.amount.trim()).map(c=>c.currency))];
  const singleCurrency = p.currency.status==='known' ? p.currency.value :
    recorded.length === 1 ? recorded[0] : p.nativeCardTotals?.length === 1 ? p.nativeCardTotals[0]!.currency : null;
  // An unknown or mixed original transaction must not acquire an invented currency.
  // USD here is only the internal controlled-input fallback; the select stays empty.
  const currency = singleCurrency ?? 'USD';
  const currencyChosen = singleCurrency!==null;
  const source = p.source ?? {kind:'other' as const,seller:null,listingUrl:null,itemReference:null};
  const membership = records.filter(e=>e.collection==='memberships' && e.record.transactionId===id);
  const shipmentIds = [...new Set(membership.map(m=>m.record.shipmentId))];
  const shipment = shipmentIds.length===1 ? records.find(e=>e.collection==='shipments' && e.record.id===shipmentIds[0]) : undefined;
  return {
    original, currencyChosen,
    draft: {
      id,date:original.date,currency,
      source:source.kind,seller:source.seller??'',listingUrl:source.listingUrl??'',
      itemReference:source.itemReference??'',pricingMode:'per-copy',
      shipping:currencyChosen && p.shipping.status==='known' && p.shipping.value.currency===currency
        ? (p.shipping.value.minor/100).toFixed(2) : '',
      lotTotal:'',
      carrier:shipment?.collection==='shipments' ? shipment.record.carrier??'' : '',
      trackingNumber:shipment?.collection==='shipments' ? shipment.record.trackingNumber??'' : '',
      cards:original.cards.map(c=>({id:c.id,catalog:c.catalog,condition:c.condition,
        amount:currencyChosen && c.currency===currency ? c.amount : '',
      })),
    },
  };
}

/** The same strict price/date validation as a normal purchase applies to imported edits. */
export function requireCompleteImportedDraft(draft: PurchaseDraft, currencyChosen=true) {
  if (!currencyChosen) throw Error('Choose the purchase currency');
  const preview = previewPurchaseDraft(draft);
  if (preview.issues.length || !preview.total || !preview.subtotal)
    throw Error('All cards need prices and a valid purchase date before saving');
  return preview;
}

export function sourceEvidence(draft: PurchaseDraft) {
  return {
    kind: draft.source,
    seller: draft.seller.trim() || null,
    listingUrl: draft.listingUrl?.trim() || null,
    itemReference: draft.itemReference?.trim() || null,
  };
}

/** Shared form -> historical evidence-aware commit; missing prices never become zero. */
export function importedPurchaseFormCommit(
  owner: string, draft: PurchaseDraft, at: string, records: readonly PortfolioRecord[],
  currencyChosen=true,
): PortfolioCommit | null {
  requireCompleteImportedDraft(draft,currencyChosen);
  const seed = importedPurchaseFormSeed(records,draft.id);
  const source = sourceEvidence(draft);
  return importedPurchaseEditCommit(owner,{
    id:draft.id,date:draft.date,notes:seed.original.notes,
    transactionCurrency:draft.currency,source,shipping:draft.shipping,
    cards:draft.cards.map(card=>({...card,currency:draft.currency})),
  },at,records);
}
