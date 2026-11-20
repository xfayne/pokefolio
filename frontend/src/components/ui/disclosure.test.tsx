import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { DisclosureButton, DisclosureContent } from './disclosure';

it('uses caller-controlled state and keeps collapsed controls inert', async () => {
  const toggle = vi.fn();
  const view = (open: boolean) => <><DisclosureButton open={open} contentId="panel" onClick={toggle}>Toggle</DisclosureButton><DisclosureContent id="panel" open={open}><button>Inner action</button></DisclosureContent></>;
  const { rerender } = render(view(false));
  const trigger = screen.getByRole('button', { name: 'Toggle' });
  expect(trigger).toHaveAttribute('aria-controls', 'panel');
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById('panel')).toHaveAttribute('inert');
  await userEvent.click(trigger);
  expect(toggle).toHaveBeenCalledOnce();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  rerender(view(true));
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById('panel')).not.toHaveAttribute('inert');
  expect(screen.getByRole('button', { name: 'Inner action' })).toBeVisible();
});
