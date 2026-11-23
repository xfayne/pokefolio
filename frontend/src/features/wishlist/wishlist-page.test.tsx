import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { WishlistCardsView } from './wishlist-page';
import '@/lib/i18n';

const ids = ['neo2-13', 'base3-5', 'basep-9'];
function mount(onOrder = vi.fn().mockResolvedValue(undefined)) {
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><WishlistCardsView cardIds={ids} onOrder={onOrder} priceEnabled={false}/></QueryClientProvider>);
  return onOrder;
}
it('shows compact list, searches, and disables dragging while a different sort is selected', async () => {
  mount();
  expect(screen.getByRole('searchbox', { name: 'Search your wishlist' })).toBeInTheDocument();
  expect(screen.getByText('3 cards')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  expect(screen.getAllByRole('button',{name:/^Move /})[0]).toBeEnabled();
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'Sort Wishlist'}),'name');
  expect(screen.getAllByRole('button',{name:/^Move /})[0]).toBeDisabled();
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'Sort Wishlist'}),'custom');
  await userEvent.type(screen.getByRole('searchbox',{name:'Search your wishlist'}),'Gengar');
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getAllByRole('button',{name:/^Move /})[0]).toBeDisabled();
});
it('keyboard reorder is based on the complete priority list, not a sorted view', () => {
  const onOrder = mount();
  fireEvent.keyDown(screen.getByRole('button',{name:'Move Umbreon'}),{key:'End'});
  expect(onOrder).toHaveBeenCalledWith('neo2-13',3);
  fireEvent.keyDown(screen.getByRole('button',{name:'Move Gengar'}),{key:'ArrowUp'});
  expect(onOrder).toHaveBeenCalledWith('base3-5',1);
});
it('opens an inline numeric-position dialog from the drag handle and validates the requested index', async () => {
  const onOrder = mount();
  fireEvent.keyDown(screen.getByRole('button',{name:'Move Umbreon'}),{key:'Enter'});
  const dialog = screen.getByRole('dialog',{name:'Change card position'});
  expect(dialog).toBeInTheDocument();
  const position = within(dialog).getByRole('spinbutton',{name:'New position'});
  expect(position).toHaveValue(1);
  fireEvent.change(position,{target:{value:'4'}});
  fireEvent.submit(within(dialog).getByRole('button',{name:'Save'}).closest('form')!);
  expect(within(dialog).getByRole('alert')).toBeInTheDocument();
  fireEvent.change(position,{target:{value:'3'}});
  await act(async()=>{fireEvent.submit(within(dialog).getByRole('button',{name:'Save'}).closest('form')!);await Promise.resolve();});
  expect(onOrder).toHaveBeenCalledWith('neo2-13',3);
  expect(screen.queryByRole('dialog',{name:'Change card position'})).not.toBeInTheDocument();
});
it('long press opens the same dialog without navigating to card details', async () => {
  vi.useFakeTimers();
  try {
    mount();
    const row=screen.getAllByRole('listitem')[0]!;
    fireEvent.pointerDown(row,{pointerId:1,pointerType:'touch',clientX:40,clientY:70});
    act(()=>vi.advanceTimersByTime(551));
    expect(screen.getByRole('dialog',{name:'Change card position'})).toBeInTheDocument();
    expect(screen.queryByRole('dialog',{name:'Card details'})).not.toBeInTheDocument();
    fireEvent.pointerUp(row,{pointerId:1,pointerType:'touch'});
  } finally {vi.useRealTimers();}
});
