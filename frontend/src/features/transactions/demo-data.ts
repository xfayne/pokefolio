import { catalogCards } from '@/features/catalog/catalog';
import { useMemo } from 'react';
import { useDemoPortfolio } from './demo-context';
import { sampleHistory, samplePurchaseShipments } from './sample';

export function useDemoTransactionData() {
  const { saved, saleCommands } = useDemoPortfolio();
  return useMemo(() => {
    const changed = saleCommands.flatMap(c => [...c.creates,...c.updates.map(u=>u.after)]);
    const merge = <T extends {id: string},>(original: readonly T[], extra: readonly T[]): T[] => [...new Map([...original,...extra].map(r=>[r.id,r])).values()];
    return ({
    history: { ...sampleHistory, catalog: catalogCards, transactions: merge([...sampleHistory.transactions, ...saved.map(s => s.plan.purchase)], changed.flatMap(e => e.collection === 'transactions' ? [e.record] : [])), copies: merge([...sampleHistory.copies, ...saved.flatMap(s => s.plan.copies)], changed.flatMap(e => e.collection === 'copies' ? [e.record] : [])), saleLines: merge(sampleHistory.saleLines, changed.flatMap(e => e.collection === 'lines' && 'copyId' in e.record ? [e.record] : [])) },
    shipments: [...samplePurchaseShipments, ...saved.flatMap(s => s.snapshot ? [s.snapshot] : [])].map(s => ({...s, status: s.copyIds.every(id => (changed.flatMap(e => e.collection === 'copies' ? [e.record] : []).findLast(c => c.id === id) ?? sampleHistory.copies.find(c => c.id === id) ?? saved.flatMap(p => p.plan.copies).find(c => c.id === id))?.possession === 'received') ? 'received' as const : s.status })),
  }); }, [saved, saleCommands]);
}
