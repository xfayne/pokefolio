import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import '@/lib/i18n';
import { CollectionCards, type InventoryData } from './collection-cards';
import { createSampleCopies, sampleCatalog, sampleOwner, sampleQuotes } from './sample';

async function openCopies(dialog: HTMLElement) {
  const button = within(dialog).queryByRole('button', { name: /Your copies/ });
  if (button?.getAttribute('aria-expanded') === 'false') await userEvent.click(button);
}

const data = (): InventoryData => ({ ownerUid: sampleOwner, copies: createSampleCopies(), catalog: sampleCatalog, quotes: sampleQuotes, currency: 'USD' });
it('expands duplicates with separate grades/prices and edits the exact chosen copy', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const original = data();
  render(<CollectionCards data={original} onSave={onSave} />);
  expect(screen.queryByText('Priced holdings')).not.toBeInTheDocument();
  expect(screen.getByText('3 cards · 5 copies')).toBeInTheDocument();
  expect(screen.getByLabelText('Sort cards')).toHaveValue('value');
  await userEvent.click(screen.getByRole('button', { name: '2 copies: Charizard' }));
  expect(screen.getByText('Cost: $180.00')).toBeInTheDocument();
  expect(screen.getByText('Cost: $150.00')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Edit copy charizard-b' }));
  const dialog = screen.getByRole('dialog');
  await openCopies(dialog);
  expect(within(dialog).getByText('charizard-b')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Condition')).toHaveValue('LP');
  await userEvent.selectOptions(within(dialog).getByLabelText('Condition'), 'MP');
  await userEvent.type(within(dialog).getByLabelText('Notes'), 'Small corner mark');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save copy' }));
  await openCopies(dialog);
  expect(onSave).toHaveBeenCalledWith(original.copies[1], expect.objectContaining({ condition: { status: 'known', value: 'MP', source: 'user' }, notes: 'Small corner mark' }));
  expect(original.copies[0]!.condition).toMatchObject({ value: 'NM' });
});
it('keeps failed edits available for retry and cancellation never saves', async () => {
  const onSave = vi.fn().mockRejectedValue(Error('Conflict'));
  render(<CollectionCards data={data()} onSave={onSave} />);
  await userEvent.click(screen.getByRole('button', { name: /^Card details: Gengar/ }));
  const dialog = screen.getByRole('dialog');
  await openCopies(dialog);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Details 2' }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Edit copy' }));
  await userEvent.type(within(dialog).getByLabelText('Notes'), 'Keep me');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save copy' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not save');
  expect(within(dialog).getByLabelText('Notes')).toHaveValue('Keep me');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(onSave).toHaveBeenCalledTimes(1);
  await userEvent.click(within(dialog).getByRole('button', { name: 'View purchase' }));
  expect(within(dialog).getByText('purchase-gengar-pending')).toBeInTheDocument();
  expect(within(dialog).getByText('line-gengar-pending')).toBeInTheDocument();
});
it('filters pending catalog rows, searches and shows unpriced coverage without zero substitution', async () => {
  render(<CollectionCards data={data()} onSave={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Sort and filter' }));
  await userEvent.selectOptions(screen.getByLabelText('Delivery status'), 'pending');
  expect(screen.getByRole('button', { name: /^Card details: Gengar/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Card details: Charizard/ })).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('searchbox'), 'Missing');
  expect(screen.getByText('No matching cards')).toBeInTheDocument();
});

it('opens explicit copy details and enlarges artwork without losing the card', async () => {
  render(<CollectionCards data={data()} onSave={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: /^Card details: Charizard/ }));
  const dialog = screen.getByRole('dialog');
  await openCopies(dialog);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Details 2' }));
  expect(within(dialog).getAllByText('$150.00')).toHaveLength(2);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Back to card' }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Enlarge card image' }));
  expect(screen.getByRole('dialog', { name: 'Card image' })).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Back to card' }));
  expect(within(dialog).getByRole('button', { name: 'Details 2' })).toBeInTheDocument();
});

it('opens per-copy Details directly from the compact expanded Cards row', async () => {
  render(<CollectionCards data={data()} onSave={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '2 copies: Charizard' }));
  expect(screen.getByRole('button', { name: '2 copies: Charizard' })).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(screen.getByRole('button', { name: /^Details charizard-b/ }));
  const dialog = screen.getByRole('dialog', { name: 'Details' });
  expect(within(dialog).getAllByText('$150.00')).toHaveLength(2);
});


it('keeps every Cards accordion closed by default and remembers toggles', async () => {
  render(<CollectionCards data={data()} onSave={vi.fn()} />);
  const singleton = screen.getByRole('button', { name: '1 copy: Snorlax' });
  const duplicate = screen.getByRole('button', { name: '2 copies: Charizard' });
  expect(singleton).toHaveAttribute('aria-expanded', 'false');
  expect(duplicate).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(singleton);
  expect(singleton).toHaveAttribute('aria-expanded', 'true');
  await userEvent.type(screen.getByRole('searchbox'), 'Snorlax');
  expect(singleton).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(singleton);
  expect(singleton).toHaveAttribute('aria-expanded', 'false');
});


it('defaults Your copies open for one copy and closed for multiple copies in Card Details', async () => {
  render(<CollectionCards data={data()} onSave={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: /^Card details: Charizard/ }));
  let dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('button', { name: /Your copies/ })).toHaveAttribute('aria-expanded', 'false');
  expect(within(dialog).queryByRole('button', { name: 'Details 1' })).not.toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: /Your copies/ }));
  expect(within(dialog).getByRole('button', { name: 'Details 1' })).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  await userEvent.click(screen.getByRole('button', { name: /^Card details: Snorlax/ }));
  dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('button', { name: /Your copies/ })).toHaveAttribute('aria-expanded', 'true');
  expect(within(dialog).getByRole('button', { name: 'Details 1' })).toBeInTheDocument();
});

it('keeps a copy editor based on its opening snapshot when query data refreshes',async()=>{
 const original=data();const onSave=vi.fn().mockRejectedValue(Error('Stale revision'));
 const view=render(<CollectionCards data={original} onSave={onSave} />);
 await userEvent.click(screen.getByRole('button',{name:'2 copies: Charizard'}));
 await userEvent.click(screen.getByRole('button',{name:'Edit copy charizard-b'}));
 await userEvent.type(screen.getByLabelText('Notes'),'My draft');
 const refreshed={...original,copies:original.copies.map(c=>c.id==='charizard-b'?{...c,revision:2,notes:'Changed elsewhere'}:c)};
 view.rerender(<CollectionCards data={refreshed} onSave={onSave} />);
 await userEvent.click(screen.getByRole('button',{name:'Save copy'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
 expect(onSave).toHaveBeenCalledWith(original.copies[1],expect.objectContaining({notes:'My draft'}));
});
