import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/surfaces';
import { planCopyMetadataEdit } from '@/domain/inventory';
import type { Revision } from '@/domain/schema';
import { CollectionCards, type SaveCopy } from './collection-cards';
import { createSampleCopies, sampleCatalog, sampleOwner, sampleQuotes } from './sample';

export function InventoryPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const preview = params.get('inventory') === 'sample';
  const [state, setState] = useState(() => ({ copies: createSampleCopies(), audits: [] as Revision[] }));
  const save: SaveCopy = async (before, patch) => {
    const current = state.copies.find(c => c.id === before.id);
    if (!preview || current?.revision !== before.revision) throw Error('Stale or unavailable inventory');
    const plan = planCopyMetadataEdit(sampleOwner, current, patch, new Date().toISOString(), `sample-${crypto.randomUUID()}`, 'Sample copy metadata edit');
    if (plan) setState(previous => ({ copies: previous.copies.map(c => c.id === before.id ? plan.change.after : c), audits: [...previous.audits, plan.audit] }));
  };
  if (!preview) return <EmptyState title={t('inventory.disconnected')} description={t('inventory.connectionDetail')} action={<Button onClick={() => { const next = new URLSearchParams(params); next.set('inventory', 'sample'); setParams(next); }}>{t('inventory.explore')}</Button>} />;
  return <div className="space-y-4"><aside className="rounded-xl border border-blue-200 bg-blue-100/60 px-3 py-2 text-sm"><p className="font-semibold text-blue-900">{t('inventory.sample')}</p><p className="mt-1 text-xs text-slate-700">{t('inventory.sampleNotice')} {t('inventory.samplePrices')}</p></aside><CollectionCards data={{ ownerUid: sampleOwner, copies: state.copies, catalog: sampleCatalog, quotes: sampleQuotes, currency: 'USD' }} onSave={save} /></div>;
}
