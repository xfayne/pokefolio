import { catalogCards } from '@/features/catalog/catalog';
import { useMemo } from 'react';
import { useDemoPortfolio } from './demo-context';
import { sampleHistory, samplePurchaseShipments } from './sample';

export function useDemoTransactionData() {
  const { saved } = useDemoPortfolio();
  return useMemo(() => ({
    history: { ...sampleHistory, catalog: catalogCards, transactions: [...sampleHistory.transactions, ...saved.map(s => s.plan.purchase)], copies: [...sampleHistory.copies, ...saved.flatMap(s => s.plan.copies)] },
    shipments: [...samplePurchaseShipments, ...saved.flatMap(s => s.snapshot ? [s.snapshot] : [])],
  }), [saved]);
}
