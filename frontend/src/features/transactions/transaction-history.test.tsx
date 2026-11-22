import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { TransactionHistory } from './transaction-history';
import { sampleHistory } from './sample';

afterEach(async () => { await i18n.changeLanguage('en'); });
it('shows the approved month summary, physical-copy counts and purchase/sale amounts', () => {
  render(<TransactionHistory data={sampleHistory} />);
  expect(screen.getByRole('heading', { name: 'November 2026' }).parentElement).toHaveTextContent('−$227.00');
  expect(screen.getByRole('list')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(4);
  expect(screen.getByText('4 copies')).toBeInTheDocument();
  expect(screen.getByText('$85.00')).toBeInTheDocument();
});
it('searches and filters together, retains collapsed filters and resets empty results', async () => {
  render(<TransactionHistory data={sampleHistory} />);
  const filters = screen.getByRole('button', { name: 'Filter transactions' });
  expect(filters).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(filters);
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'received');
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  await userEvent.click(filters);
  expect(screen.getByLabelText('Status').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'true');
  expect(filters).toHaveAttribute('aria-expanded', 'false');
  await userEvent.type(screen.getByRole('searchbox'), 'Gengar');
  expect(screen.getByText('No matching transactions')).toBeInTheDocument();
  await userEvent.click(within(screen.getByText('No matching transactions').closest('section')!).getByRole('button', { name: 'Reset filters' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(4);
  const kind = screen.getByRole('combobox', { name: 'Transaction type' });
  expect(kind).toHaveValue('all');
  expect(screen.getByRole('searchbox', { name: 'Search transactions' })).toHaveAttribute('placeholder', 'Search');
  await userEvent.selectOptions(kind, 'sale');
  expect(screen.getByText('+$85.00')).toBeInTheDocument();
});
it('exposes detail callbacks and keeps the compact type selector accessible in Hebrew', async () => {
  const open = vi.fn();
  render(<TransactionHistory data={sampleHistory} onOpen={open} />);
  await userEvent.click(screen.getByRole('button', { name: /View transaction: sample-nov-19/ }));
  expect(open).toHaveBeenCalledWith('sample-nov-19');
  await i18n.changeLanguage('he');
  expect(await screen.findByRole('combobox', { name: 'סוג עסקה' })).toHaveValue('all');
  expect(document.documentElement.dir).toBe('rtl');
});
