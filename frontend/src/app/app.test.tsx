import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { App } from './app';
import i18n from '@/lib/i18n';
afterEach(async () => { window.location.hash = ''; window.localStorage.removeItem('pokefolio:section-tabs:v1'); await i18n.changeLanguage('en'); });
it('opens Dashboard by default and navigates without legacy controllers', async () => {
  window.location.hash = '';
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Pokefolio' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: 'Collection' }));
  expect(await screen.findByRole('heading', { name: 'Collection' })).toBeInTheDocument();
  expect(document.querySelector('script[src*="firebase-cloud"]')).toBeNull();
});
it('switches Hebrew labels and the document direction together', async () => {
  window.location.hash = '#/wishlist';
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
  await userEvent.click(screen.getByRole('button', { name: 'עברית' }));
  await userEvent.click(screen.getByRole('button', { name: 'סגירה' }));
  await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
  expect(screen.getByRole('heading', { name: 'רשימת משאלות' })).toBeInTheDocument();
});
it('places Deals inside Wishlist and exposes exactly five primary destinations', async () => {
  window.location.hash = '#/deals';
  render(<App />);
  const navigation = await screen.findByRole('navigation', { name: 'Main navigation' });
  expect(navigation.querySelectorAll('a')).toHaveLength(5);
  expect(await screen.findByRole('link', { name: 'Deals' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Analyze' })).toHaveAttribute('href', '#/analyze');
});
it('closes the catalog without losing the originating nested route or query', async () => {
  window.location.hash = '#/collection/binder';
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await userEvent.type(screen.getByRole('searchbox'), 'mew');
  expect(screen.getByRole('dialog', { name: 'Search cards' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(window.location.hash).toBe('#/collection/binder'));
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(screen.getByRole('searchbox')).toHaveValue('mew');
});
