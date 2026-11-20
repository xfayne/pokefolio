import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { preparePurchaseDraft, type PreparedPurchaseDraft } from '@/domain/purchase-draft';
import { useUIStore } from '@/state/ui';
import { demoTransactionOwner, useDemoPortfolio } from './demo-context';
import { useDemoTransactionData } from './demo-data';
import { NewPurchaseForm } from './new-purchase-form';
import { createPurchaseDraft } from './purchase-draft-seed';


export function NewPurchasePage() {
  const [params] = useSearchParams();
  const preview = params.get('transactions') === 'sample';
  const mode = preview ? 'sample' : 'account';
  const stored = useUIStore(s => s.purchaseDrafts[mode]);
  const setDraft = useUIStore(s => s.setPurchaseDraft);
  const [initial] = useState(() => createPurchaseDraft(preview));
  const draft = stored ?? initial;
  const demo = useDemoPortfolio();
  const data = useDemoTransactionData();
  const navigate = useNavigate();
  const prepared = useRef<{ key: string; value: PreparedPurchaseDraft } | null>(null);
  useEffect(() => { document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, []);
  useEffect(() => { if (!stored) setDraft(mode, initial); }, [stored, setDraft, mode, initial]);
  async function save() {
    if (!preview) throw Error('Account adapter unavailable');
    const key = JSON.stringify(draft);
    if (prepared.current?.key !== key) prepared.current = { key, value: preparePurchaseDraft(demoTransactionOwner, draft, new Date().toISOString()) };
    await demo.save(prepared.current.value);
    setDraft(mode, createPurchaseDraft(preview));
    await navigate({ pathname: `/transactions/purchases/${draft.id}`, search: params.toString() }, { replace: true, state: { demoSaved: true } });
  }
  return <NewPurchaseForm key={mode} draft={draft} catalog={preview ? data.history.catalog : []} onChange={next => setDraft(mode, next)} {...(preview ? { onSave: save } : {})} />;
}
