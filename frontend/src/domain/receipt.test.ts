import { expect, it } from 'vitest';
import { purchaseCommit } from './purchase-commit';
import { createPurchaseDraft } from '@/features/transactions/purchase-draft-seed';
import { receivePurchase, validateReceiptCommit } from './receipt';
import type { PortfolioRecord } from './persistence';
import { selectHistory } from './transaction-history';
const at = '2026-11-21T15:00:00Z';
it('receives the same exact copies with or without tracking, preserves costs, and cannot receive twice', () => {
  for (const trackingNumber of ['', 'TEST123456']) {
    const draft = {...createPurchaseDraft(true),trackingNumber};
    const records = purchaseCommit('owner',draft,at).creates;
    const commands = receivePurchase('owner',draft.id,records,at);
    expect(commands).toHaveLength(1);
    const command = commands[0]!;
    expect(validateReceiptCommit(command)).toBe(true);
    expect(command.updates).toHaveLength(3);
    for (const {before,after} of command.updates) {
      expect(after.record).toEqual({...before.record,possession:'received',revision:2});
    }
    expect(command.creates.every(e => e.collection === 'revisions')).toBe(true);
    const updated = records.map(e => command.updates.find(u=>u.before.record.id === e.record.id)?.after ?? e);
    expect(receivePurchase('owner',draft.id,updated,at)).toEqual([]);
    const rows = selectHistory({ownerUid:'owner',transactions:updated.flatMap(e=>e.collection==='transactions'?[e.record]:[]),copies:updated.flatMap(e=>e.collection==='copies'?[e.record]:[]),saleLines:[],catalog:[],inTransit:[]});
    expect(rows[0]?.status).toBe('received');
    const invalid = structuredClone(command);
    const update = invalid.updates[0]!;
    if (update.after.collection === 'copies') update.after.record.notes='unexpected';
    expect(()=>validateReceiptCommit(invalid)).toThrow();
    expect(()=>receivePurchase('foreign',draft.id,records,at)).toThrow();
  }
});
it('bounds large receipts to the existing audited commit capacity and resumes received copies', () => {
  const draft=createPurchaseDraft(true);
  const records=purchaseCommit('owner',draft,at).creates;
  const copy=records.find(e=>e.collection==='copies')!;
  const many: PortfolioRecord[]=records.filter(e=>e.collection!=='copies');
  for(let n=0;n<43;n++) if(copy.collection==='copies') many.push({collection:'copies',record:{...copy.record,id:`copy-${n}`}});
  const commands=receivePurchase('owner',draft.id,many,at);
  expect(commands.map(c=>c.updates.length)).toEqual([20,20,3]);
  const partial=many.map(e=>commands[0]!.updates.find(u=>u.before.record.id===e.record.id)?.after??e);
  expect(receivePurchase('owner',draft.id,partial,at).flatMap(c=>c.updates)).toHaveLength(23);
});
