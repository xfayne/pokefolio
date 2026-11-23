import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPackageCheck, LuLoaderCircle } from 'react-icons/lu';
import { createPortal } from 'react-dom';
import { usePortfolio } from '@/hooks/use-portfolio';
import { receivePurchase } from '@/domain/receipt';
import type { PortfolioCommit, PortfolioRecord } from '@/domain/persistence';
import { useDemoTransactionData } from './demo-data';
import { useDemoPortfolio } from './demo-context';

export function PurchaseReceiptAction({ id, preview, onBusy }: { id: string; preview: boolean; onBusy?: (busy:boolean) => void }) {
  const account = usePortfolio();
  const demo = useDemoTransactionData();
  const adapter = useDemoPortfolio();
  const { t } = useTranslation();
  const [busy,setBusy] = useState(false);
  const [failed,setFailed] = useState(false);
  const lock = useRef(false);
  const prepared = useRef<PortfolioCommit[] | null>(null);
  const records: readonly PortfolioRecord[] = preview ? [
    ...demo.history.transactions.map(record => ({collection:'transactions' as const,record})),
    ...demo.history.copies.map(record => ({collection:'copies' as const,record})),
  ] : account.records;
  const copies = records.flatMap(e => e.collection === 'copies' && !e.record.removedFromImport && e.record.acquisition.kind === 'purchase' && e.record.acquisition.transactionId === id ? [e.record] : []);
  if (!copies.length) return null;
  const received = copies.every(c => c.possession === 'received');
  const eligible = copies.some(c => c.possession === 'pending' && c.disposition === 'held') && copies.every(c => c.possession !== 'unknown');
  async function receive() {
    if (lock.current || received || !eligible) return;
    lock.current = true; setBusy(true); onBusy?.(true); setFailed(false);
    try {
      prepared.current ??= receivePurchase(preview ? demo.history.ownerUid : account.owner!,id,records,new Date().toISOString());
      for (const command of prepared.current) await (preview ? adapter.commitSale : account.save)(command);
      prepared.current = null;
    } catch { setFailed(true); prepared.current = null; }
    finally { lock.current = false; setBusy(false); onBusy?.(false); }
  }
  return <><button type="button" aria-label={t(received ? 'purchaseDetails.received' : 'purchaseDetails.receive')} title={t(received ? 'purchaseDetails.received' : 'purchaseDetails.receive')} disabled={received || busy || !eligible} onClick={() => void receive()} className="flex size-11 items-center justify-center rounded-xl text-white focus-visible:outline-white disabled:opacity-40">
    {busy ? <LuLoaderCircle aria-hidden className="size-6 animate-spin" /> : <LuPackageCheck aria-hidden className="size-6" />}
  </button>{failed && document.getElementById('main-content') && createPortal(<p role="alert" className="text-sm text-red-700">{t('purchaseDetails.receiveFailed')}</p>,document.getElementById('main-content')!)}</>;
}
