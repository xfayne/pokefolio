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
