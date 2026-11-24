import { expect, it } from 'vitest';
import { purchaseCommit } from './purchase-commit';
import { createPurchaseDraft } from '@/features/transactions/purchase-draft-seed';
import { importedPurchaseFormSeed, importedPurchaseFormCommit } from './imported-purchase-form';
import { validateImportedPurchaseEdit } from './imported-purchase-edit';
import { portfolioRecordSchema, prepareCommit, type PortfolioRecord } from './persistence';
import { importedPurchaseSchema } from './schema';

export function twentyCardImportedFixture(): PortfolioRecord[] {
  const start = createPurchaseDraft(true);
  const draft = {
    ...start,id:'purchase-twenty',date:'2026-10-28',source:'other' as const,seller:'',
    currency:'EUR' as const,shipping:'0',carrier:'',trackingNumber:'TEST-TRACK-ONLY',
    cards:Array.from({length:20},(_,index)=>({
      ...start.cards[index%start.cards.length]!,
      id:'physical-copy-'+index,
      amount:index===19?'14.79':'1.80',
    })),
  };
  const original = purchaseCommit('owner',draft,'2026-11-23T08:00:00Z').creates;
  const tx = original.find(entry=>entry.collection==='transactions');
  if (!tx || tx.collection!=='transactions') throw Error('Transaction fixture missing');
  const imported = importedPurchaseSchema.parse({
    schemaVersion:1,kind:'purchase',id:tx.record.id,ownerUid:'owner',revision:1,
    createdAt:tx.record.createdAt,updatedAt:tx.record.updatedAt,
    origin:'legacy-import',sourceParcelId:'parcel-demo-20',
    transactionOn:{status:'known',value:'2026-10-28',source:'legacy'},
    currency:{status:'known',value:'EUR',source:'legacy'},
    subtotal:{status:'known',value:{currency:'EUR',minor:4899},source:'legacy'},
    payable:{status:'known',value:{currency:'EUR',minor:4899},source:'legacy'},
    nativeCardTotals:[{currency:'EUR',minor:4899}],unpricedCopyCount:0,
    shippingIncludedInCardPrices:true,
    totalBasis:'recorded-card-prices',settlement:'unknown',notes:'Imported source notes',
    shipping:{status:'unknown',reason:'No separately recorded shipping'},
    taxes:{status:'unknown',reason:'Not separately recorded'},
    fees:{status:'unknown',reason:'Not separately recorded'},
  });
  return [{collection:'transactions',record:imported},
    ...original.filter(entry=>entry.collection!=='transactions').map(entry=>{
      if(entry.collection==='lines') {
        const price = entry.record.pricing;
        if(price.mode!=='per-copy')throw Error('Invalid line');
        return portfolioRecordSchema.parse({collection:'lines',record:{
          ...entry.record,origin:'legacy-import',
          pricing:{mode:'per-copy',unitPrice:{status:'known',value:price.unitPrice,source:'legacy'}},
        }});
      }
      if(entry.collection==='copies') return portfolioRecordSchema.parse({collection:'copies',record:{
        ...entry.record,possession:'received',
        acquiredOn:{status:'known',value:'2026-10-20',source:'legacy'},
      }});
      return entry;
    }),
  ];
}

it('atomically audits a 20-copy €48.99 purchase with €12.40 equally allocated shipping',()=>{
  const before=twentyCardImportedFixture();
  const seed=importedPurchaseFormSeed(before,'purchase-twenty');
  expect(seed.currencyChosen).toBe(true);
  expect(seed.draft.cards).toHaveLength(20);
  const edited={...seed.draft,shipping:'12.40',date:'2026-10-29'};
  const command=importedPurchaseFormCommit('owner',edited,'2026-11-24T08:00:00Z',before)!;
  expect(command.updates).toHaveLength(21);
  expect(command.creates.filter(e=>e.collection==='revisions')).toHaveLength(1);
  const revision=command.creates.find(e=>e.collection==='revisions');
  if(revision?.collection!=='revisions')throw Error('Missing audit');
  expect(Object.keys(revision.record.additional??{})).toHaveLength(20);
  expect(prepareCommit('owner',command,450)).toEqual(command);
  expect(validateImportedPurchaseEdit(command)).toBe(true);
  const transaction=command.updates.find(e=>e.before.collection==='transactions')?.after;
  expect(transaction).toMatchObject({collection:'transactions',record:{
    totalBasis:'owner-confirmed-total',origin:'legacy-import',sourceParcelId:'parcel-demo-20',
    subtotal:{status:'known',value:{currency:'EUR',minor:4899}},
    shipping:{status:'known',value:{currency:'EUR',minor:1240}},
    payable:{status:'known',value:{currency:'EUR',minor:6139}},
    nativeCardTotals:[{currency:'EUR',minor:4899}],unpricedCopyCount:0,
    transactionOn:{status:'known',value:'2026-10-29'},
  }});
  if(transaction?.collection!=='transactions'||!('origin' in transaction.record))throw Error('No imported purchase');
  expect(transaction.record.shippingIncludedInCardPrices).toBeUndefined();
  const changes=command.updates.filter(e=>e.before.collection==='copies');
  expect(changes).toHaveLength(20);
  for(const update of changes) {
    if(update.before.collection!=='copies'||update.after.collection!=='copies')throw Error('Wrong copy');
    expect(update.after.record.shippingCost).toMatchObject({status:'exact',value:{currency:'EUR',minor:62}});
    expect(update.after.record.acquiredOn).toEqual(update.before.record.acquiredOn);
    expect(update.after.record.acquisition).toEqual(update.before.record.acquisition);
    expect(update.after.record.possession).toEqual(update.before.record.possession);
    expect(update.after.record.cardCost).toEqual(update.before.record.cardCost);
  }
  const after=before.map(entry=>command.updates.find(update=>
    update.before.collection===entry.collection && update.before.record.id===entry.record.id)?.after??entry);
  const restored=importedPurchaseFormSeed(after,'purchase-twenty');
  expect(restored.draft.shipping).toBe('12.40');
  expect(restored.draft.cards).toHaveLength(20);
  expect(importedPurchaseFormCommit('owner',restored.draft,'2026-11-24T08:01:00Z',after)).toBeNull();
});
