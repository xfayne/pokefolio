import { createContext, useContext } from 'react';
import type { PortfolioCommit } from '@/domain/persistence';
import type { PreparedPurchaseDraft } from '@/domain/purchase-draft';

export const demoTransactionOwner = 'sample-transactions';
export type DemoPortfolio = { saved: readonly PreparedPurchaseDraft[]; saleCommands: readonly PortfolioCommit[]; commitSale: (command: PortfolioCommit) => Promise<void>; save: (value: PreparedPurchaseDraft) => Promise<void> };
export const DemoPortfolioContext = createContext<DemoPortfolio | null>(null);
export function useDemoPortfolio() {
  const value = useContext(DemoPortfolioContext);
  if (!value) throw Error('Demo portfolio provider missing');
  return value;
}
