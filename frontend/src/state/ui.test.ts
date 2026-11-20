import { expect, it } from 'vitest';
import { useUIStore } from './ui';
import { createPurchaseDraft } from '@/features/transactions/purchase-draft-seed';
it('resets transient search state without storing collection data', () => {
  useUIStore.getState().setSearchQuery('Lugia');
  useUIStore.getState().setPurchaseDraft('sample', createPurchaseDraft(true));
  expect(useUIStore.getState().purchaseDrafts.account).toBeUndefined();
  expect(useUIStore.getState().searchQuery).toBe('Lugia');
  useUIStore.getState().reset();
  expect(useUIStore.getState().searchQuery).toBe('');
  expect(useUIStore.getState().purchaseDrafts).toEqual({});
  expect(Object.keys(useUIStore.getState()).sort()).toEqual(['purchaseDrafts', 'reset', 'searchQuery', 'setPurchaseDraft', 'setSearchQuery']);
});
