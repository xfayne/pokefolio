import { afterEach, expect, it } from 'vitest';
import { readSectionTabs, saveSectionTabs, sectionTabFromPath, sectionTabsKey } from './section-tabs';

afterEach(() => localStorage.removeItem(sectionTabsKey));

it('uses valid persisted section tabs and ignores stale or unknown routes', () => {
  saveSectionTabs({ collection: 'binder', wishlist: 'deals', transactions: 'history' });
  expect(readSectionTabs()).toEqual({ collection: 'binder', wishlist: 'deals', transactions: 'history' });
  expect(sectionTabFromPath('/transactions/history')).toEqual({ section: 'transactions', tab: 'history' });
  expect(sectionTabFromPath('/transactions/new')).toBeNull();
  expect(sectionTabFromPath('/collection/cards/details')).toBeNull();
});

it('falls back safely for malformed or invalid saved tabs', () => {
  localStorage.setItem(sectionTabsKey, '{no');
  expect(readSectionTabs()).toEqual({ collection: 'overview', wishlist: 'cards', transactions: 'overview' });
  localStorage.setItem(sectionTabsKey, JSON.stringify({ collection: 'invalid', wishlist: 'deals', transactions: null }));
  expect(readSectionTabs()).toEqual({ collection: 'overview', wishlist: 'deals', transactions: 'overview' });
});
