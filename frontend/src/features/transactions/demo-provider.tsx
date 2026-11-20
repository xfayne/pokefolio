import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PreparedPurchaseDraft } from '@/domain/purchase-draft';
import { DemoPortfolioContext, demoTransactionOwner } from './demo-context';

// Explicitly synthetic and memory-only. Never used as an account persistence adapter.
export function DemoPortfolioProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<readonly PreparedPurchaseDraft[]>([]);
  const receipts = useRef(new Map<string, string>());
  const save = useCallback(async (value: PreparedPurchaseDraft) => {
    const { purchase } = value.plan;
    if (purchase.ownerUid !== demoTransactionOwner || !purchase.id.startsWith('demo-purchase-') || value.plan.copies.some(c => c.ownerUid !== demoTransactionOwner || !c.id.startsWith('demo-copy-'))) throw Error('Only synthetic purchases are allowed');
    const fingerprint = JSON.stringify(value);
    const previous = receipts.current.get(purchase.id);
    if (previous) { if (previous !== fingerprint) throw Error('Conflicting demo purchase'); return; }
    receipts.current.set(purchase.id, fingerprint);
    setSaved(current => [...current, value]);
  }, []);
  const value = useMemo(() => ({ saved, save }), [saved, save]);
  return <DemoPortfolioContext value={value}>{children}</DemoPortfolioContext>;
}
