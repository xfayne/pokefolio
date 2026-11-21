import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import '@/lib/i18n';
import { PurchaseActions } from './purchase-actions';
it('shows an edit icon only when editing is functional', async () => {
  const edit = vi.fn();
  const view = render(<PurchaseActions />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  view.rerender(<PurchaseActions onEdit={edit} />);
  await userEvent.click(screen.getByRole('button', { name: 'Edit purchase' }));
  expect(edit).toHaveBeenCalledOnce();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('retains the edit action visibly disabled when receipt locks the purchase', async()=>{
 const edit=vi.fn();
 render(<PurchaseActions onEdit={edit} disabled />);
 const button=screen.getByRole('button',{name:'Edit purchase'});
 expect(button).toBeDisabled();
 await userEvent.click(button);
 expect(edit).not.toHaveBeenCalled();
});
