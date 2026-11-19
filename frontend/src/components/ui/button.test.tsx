import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Button } from './button';

it('supports keyboard interaction and disabled actions', async () => {
  const onClick = vi.fn();
  render(<><Button onClick={onClick}>Continue</Button><Button disabled onClick={onClick}>Unavailable</Button></>);
  const user = userEvent.setup();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(onClick).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Unavailable' }));
  expect(onClick).toHaveBeenCalledTimes(1);
});
