import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import '@/lib/i18n';
import { PurchaseActions } from './purchase-actions';
it('opens Edit purchase only through the ellipsis menu, supports escape and activation', async () => {
  const edit = vi.fn();
  render(<PurchaseActions onEdit={edit} />);
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Transaction actions' });
  await userEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('menuitem', { name: 'Edit purchase' })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await userEvent.keyboard('{ArrowDown}');
  await userEvent.click(
    screen.getByRole('menuitem', { name: 'Edit purchase' }),
  );
  expect(edit).toHaveBeenCalledTimes(1);
});
