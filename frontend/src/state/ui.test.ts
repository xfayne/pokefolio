import { expect, it } from 'vitest';
import { useUIStore } from './ui';
it('resets transient search state without storing collection data', () => {
  useUIStore.getState().setSearchQuery('Lugia');
  expect(useUIStore.getState().searchQuery).toBe('Lugia');
  useUIStore.getState().reset();
  expect(useUIStore.getState().searchQuery).toBe('');
  expect(Object.keys(useUIStore.getState()).sort()).toEqual(['reset', 'searchQuery', 'setSearchQuery']);
});
