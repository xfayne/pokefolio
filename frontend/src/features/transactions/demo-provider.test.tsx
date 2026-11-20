import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { preparePurchaseDraft } from '@/domain/purchase-draft';
import { DemoPortfolioProvider } from './demo-provider';
import { demoTransactionOwner, useDemoPortfolio } from './demo-context';
import { createPurchaseDraft } from './purchase-draft-seed';

it('commits a demo purchase once, replays the same receipt and rejects conflicting or foreign writes', async () => {
  const { result } = renderHook(() => useDemoPortfolio(), { wrapper: DemoPortfolioProvider });
  const prepared = preparePurchaseDraft(demoTransactionOwner, createPurchaseDraft(true), '2026-11-20T10:00:00Z');
  await act(async () => { await result.current.save(prepared); await result.current.save(prepared); });
  expect(result.current.saved).toHaveLength(1);
  await expect(result.current.save({ ...prepared, plan: { ...prepared.plan, purchase: { ...prepared.plan.purchase, notes: 'Changed' } } })).rejects.toThrow('Conflicting');
  await expect(result.current.save({ ...prepared, plan: { ...prepared.plan, purchase: { ...prepared.plan.purchase, ownerUid: 'account-user' } } })).rejects.toThrow();
  expect(result.current.saved).toHaveLength(1);
});
