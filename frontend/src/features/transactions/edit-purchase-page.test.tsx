import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { PortfolioRecord } from '@/domain/persistence';
import { createPurchaseDraft } from './purchase-draft-seed';
import { purchaseCommit } from '@/domain/purchase-commit';
import '@/lib/i18n';
const state = vi.hoisted(() => ({
  records: [] as PortfolioRecord[],
  id: '',
  save: vi.fn(),
}));
vi.mock('@/hooks/use-portfolio', () => ({
  usePortfolio: () => ({
    records: state.records,
    owner: 'owner',
    loading: false,
    save: state.save,
  }),
}));
vi.mock('react-router', () => ({
  useParams: () => ({ transactionId: state.id }),
  useNavigate: () => vi.fn(),
}));
import { EditPurchasePage } from './edit-purchase-page';
it('keeps the opening revision after a query refresh rather than overwriting newer records', async () => {
  const draft = createPurchaseDraft(true);
  state.id = draft.id;
  state.records = purchaseCommit(
    'owner',
    draft,
    '2026-11-21T00:00:00Z',
  ).creates;
  const opening = state.records;
  state.save.mockRejectedValue(Error('Stale revision'));
  const view = render(<EditPurchasePage />);
  await userEvent.clear(screen.getByRole('textbox', { name: 'Shipping cost' }));
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Shipping cost' }),
    '1.00',
  );
  state.records = opening.map((e) => ({
    ...e,
    record: { ...e.record, revision: 2, updatedAt: '2026-11-21T01:00:00Z' },
  })) as PortfolioRecord[];
  view.rerender(<EditPurchasePage />);
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  expect(state.save).toHaveBeenCalledTimes(1);
  expect(
    state.save.mock.calls[0]![0].updates.every(
      (u: { before: PortfolioRecord }) => u.before.record.revision === 1,
    ),
  ).toBe(true);
  expect(screen.getByRole('textbox', { name: 'Shipping cost' })).toHaveValue(
    '1.00',
  );
});
