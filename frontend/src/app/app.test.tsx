import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { App } from './app';
import i18n from '@/lib/i18n';
afterEach(async () => { window.location.hash = ''; await i18n.changeLanguage('en'); });
it('opens Dashboard by default and navigates without legacy controllers', async () => {
  window.location.hash = '';
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: 'Collection' }));
  expect(await screen.findByRole('heading', { name: 'Collection' })).toBeInTheDocument();
  expect(document.querySelector('script[src*="firebase-cloud"]')).toBeNull();
});
it('switches Hebrew labels and the document direction together', async () => {
  window.location.hash = '#/wishlist';
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'עברית' }));
  await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
  expect(screen.getByRole('heading', { name: 'רשימת משאלות' })).toBeInTheDocument();
});
