import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import '@/lib/i18n';
import { CatalogSearch } from './catalog-search';
afterEach(cleanup);
it('shares selection, set filtering and list/grid modes', async () => {
 const select = vi.fn(); const user = userEvent.setup();
 render(<CatalogSearch query="gengar" onQuery={vi.fn()} onSelect={select} owned={{'base3-5':2}} />);
 await user.click(screen.getByRole('button', {name:'Grid'}));
 expect(screen.getByRole('button',{name:'Grid'})).toHaveAttribute('aria-pressed','true');
 await user.click(screen.getByRole('button',{name:'Filters'}));
 await user.click(screen.getByRole('checkbox', {name:'Fossil'}));
 expect(screen.getAllByRole('listitem')).toHaveLength(2);
 await user.click(screen.getAllByRole('listitem')[0]!.querySelector('button')!);
 expect(select.mock.calls[0]?.[0].id).toBe('base3-5');
});

it('shows evidenced ownership and wishlist badges and animates filter disclosure',async()=>{
 const user=userEvent.setup();render(<CatalogSearch query="gengar" onQuery={vi.fn()} onSelect={vi.fn()} owned={{'base3-5':2}} wishlist={['base3-20']} />);
 expect(screen.getByText('Owned · 2 copies')).toBeInTheDocument();expect(screen.getByText('Wishlist')).toBeInTheDocument();
 const button=screen.getByRole('button',{name:'Filters'});await user.click(button);expect(button).toHaveAttribute('aria-expanded','true');
 const target=document.getElementById(button.getAttribute('aria-controls')!)!;expect(target).toHaveAttribute('data-open','true');
 await user.click(button);expect(target).toHaveAttribute('data-open','false');expect(target).toHaveAttribute('inert');
});
