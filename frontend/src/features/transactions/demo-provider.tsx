import { validateReceiptCommit } from '@/domain/receipt';
import { prepareCommit, recordKey, type PortfolioCommit, type PortfolioRecord } from '@/domain/persistence';
import { validateSaleCommit } from '@/domain/sale';
import { purchaseRecords } from '@/domain/purchase-commit';
import { sampleHistory } from './sample';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PreparedPurchaseDraft } from '@/domain/purchase-draft';
import { DemoPortfolioContext, demoTransactionOwner } from './demo-context';

// Explicitly synthetic and memory-only. Never used as an account persistence adapter.
export function DemoPortfolioProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<readonly PreparedPurchaseDraft[]>([]);
  const [saleCommands, setSaleCommands] = useState<readonly PortfolioCommit[]>([]);
  const latestSales = useRef<readonly PortfolioCommit[]>([]);
  const latestPurchases = useRef<readonly PreparedPurchaseDraft[]>([]);
  const receipts = useRef(new Map<string, string>());
  const save = useCallback(async (value: PreparedPurchaseDraft) => {
    const { purchase } = value.plan;
    if (purchase.ownerUid !== demoTransactionOwner || !purchase.id.startsWith('demo-purchase-') || value.plan.copies.some(c => c.ownerUid !== demoTransactionOwner || !c.id.startsWith('demo-copy-'))) throw Error('Only synthetic purchases are allowed');
    const fingerprint = JSON.stringify(value);
    const previous = receipts.current.get(purchase.id);
    if (previous) { if (previous !== fingerprint) throw Error('Conflicting demo purchase'); return; }
    receipts.current.set(purchase.id, fingerprint);
    latestPurchases.current = [...latestPurchases.current, value];
    setSaved(latestPurchases.current);
  }, []);
  const commitSale = useCallback(async (raw: PortfolioCommit) => {
    const command = prepareCommit(demoTransactionOwner, raw, 450);
    if (!validateReceiptCommit(command) && !validateSaleCommit(demoTransactionOwner, command)) throw Error('Only synthetic lifecycle commands allowed');
    const fingerprint = JSON.stringify(command);
    const receipt = receipts.current.get(command.idempotencyKey);
    if (receipt) { if (receipt !== fingerprint) throw Error('Conflicting save'); return; }
    const base: PortfolioRecord[] = [
      ...sampleHistory.transactions.map(record => ({ collection: 'transactions' as const, record })),
      ...sampleHistory.copies.map(record => ({ collection: 'copies' as const, record })),
      ...sampleHistory.saleLines.map(record => ({ collection: 'lines' as const, record })),
      ...latestPurchases.current.flatMap(purchaseRecords),
    ];
    const records = new Map(base.map(e => [recordKey(e), e]));
    for (const previous of latestSales.current) for (const entry of [...previous.creates, ...previous.updates.map(u => u.after)]) records.set(recordKey(entry),entry);
    for (const entry of command.creates) if (records.has(recordKey(entry))) throw Error('Record already exists');
    for (const u of command.updates) if (JSON.stringify(records.get(recordKey(u.before))) !== JSON.stringify(u.before)) throw Error('Record changed');
    receipts.current.set(command.idempotencyKey, fingerprint);
    latestSales.current = [...latestSales.current, command];
    setSaleCommands(latestSales.current);
  }, []);
  const value = useMemo(() => ({ saved, save, saleCommands, commitSale }), [saved, save, saleCommands, commitSale]);
  return <DemoPortfolioContext value={value}>{children}</DemoPortfolioContext>;
}
