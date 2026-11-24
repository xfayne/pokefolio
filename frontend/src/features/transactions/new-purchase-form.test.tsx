import { TransactionFormTestFrame } from './transaction-header.test-support';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import '@/lib/i18n';
import { NewPurchaseForm } from './new-purchase-form';
import { createPurchaseDraft } from './purchase-draft-seed';
import { sampleHistory } from './sample';

function Harness({ save }: { save: () => Promise<void> }) {
  const [draft, setDraft] = useState(() => createPurchaseDraft(true));
  return <NewPurchaseForm draft={draft} catalog={sampleHistory.catalog} onChange={setDraft} onSave={save} />;
}
it('matches the example, recomputes after removal and keeps shipment fields collapsed initially', async () => {
  render(<Harness save={vi.fn()} />, {wrapper:TransactionFormTestFrame});
  expect(screen.getByText('$142.00', { exact: true })).toBeInTheDocument();
  expect(screen.getByText('Split equally: $4.00 per copy')).toBeInTheDocument();
  const shipment = screen.getByRole('button', { name: 'Shipment details (optional)' });
  expect(shipment).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(screen.getByRole('button', { name: /^Remove copy 3/ }));
  expect(screen.getByText('$110.00', { exact: true })).toBeInTheDocument();
  expect(screen.getByText('Split equally: $6.00 per copy')).toBeInTheDocument();
  await userEvent.click(shipment);
  expect(screen.getByLabelText('Tracking number')).toBeInTheDocument();
});
it('never silently relabels entered currency amounts and supports immediate undo', async () => {
  render(<Harness save={vi.fn()} />, {wrapper:TransactionFormTestFrame});
  await userEvent.selectOptions(screen.getByLabelText('Currency'), 'GBP');
  expect(screen.getByLabelText('Card cost 1')).toHaveValue('');
  expect(screen.getByRole('status')).toHaveTextContent('no conversion was applied');
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.getByLabelText('Currency')).toHaveValue('USD');
  expect(screen.getByText('$142.00', { exact: true })).toBeInTheDocument();
});
it('prevents invalid and concurrent submissions, and retains the draft on failure', async () => {
  let reject: (error: Error) => void = () => {};
  const save = vi.fn(() => new Promise<void>((_, no) => { reject = no; }));
  render(<Harness save={save} />, {wrapper:TransactionFormTestFrame});
  await userEvent.clear(screen.getByLabelText('Card cost 1'));
  await userEvent.click(screen.getByRole('button', { name: 'Save purchase' }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Card cost 1')).toHaveAttribute('aria-invalid', 'true');
  await userEvent.type(screen.getByLabelText('Card cost 1'), '52.00');
  const form = screen.getByRole('form', { name: 'New transaction' });
  fireEvent.submit(form); fireEvent.submit(form);
  expect(save).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  reject(new Error('Offline'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Your draft is still here'));
  expect(screen.getByLabelText('Card cost 1')).toHaveValue('52.00');
});

it('keeps the compact edition control editable beside the condition', async () => {
  render(<Harness save={vi.fn()} />, {wrapper:TransactionFormTestFrame});
  const edition = screen.getAllByRole('checkbox', {name:'First Edition'})[0]!;
  expect(edition).not.toBeChecked();
  await userEvent.click(edition);
  expect(edition).toBeChecked();
  expect(screen.getByLabelText('Condition 1')).toBeInTheDocument();
  expect(screen.getByLabelText('Card cost 1')).toHaveValue('52.00');
});
