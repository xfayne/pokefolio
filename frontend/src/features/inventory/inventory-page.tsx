import { PortfolioStatus } from '@/features/portfolio-status';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useNavigate } from 'react-router';
import { catalogCards } from '@/features/catalog/catalog';
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
  const account = usePortfolio();
  const navigate = useNavigate();
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
  if (!preview && (account.loading || account.error)) return <PortfolioStatus loading={account.loading} error={account.error} />;
  if (!preview && account.owner) return <CollectionCards data={{ownerUid:account.owner,copies:account.history.copies,catalog:catalogCards,quotes:[],currency:'USD'}} onViewPurchase={id => { void navigate(`/transactions/purchases/${id}`); }} onSave={async (copy, patch) => {
    const plan = planCopyMetadataEdit(account.owner!, copy, patch, new Date().toISOString(), `audit-${crypto.randomUUID()}`, 'Copy metadata edited');
    if (plan) await account.save({ownerUid:account.owner!,idempotencyKey:plan.audit.id,creates:[{collection:'revisions',record:plan.audit}],updates:[{before:{collection:'copies',record:plan.change.before},after:{collection:'copies',record:plan.change.after}}]});
  }} />;
  if (!preview) return <EmptyState title={t('inventory.disconnected')} description={t('inventory.connectionDetail')} action={<Button onClick={() => { const next = new URLSearchParams(params); next.set('inventory', 'sample'); setParams(next); }}>{t('inventory.explore')}</Button>} />;
  return <CollectionCards data={{ ownerUid: sampleOwner, copies: state.copies, catalog: sampleCatalog, quotes: sampleQuotes, currency: 'USD' }} onSave={save} />;
}
