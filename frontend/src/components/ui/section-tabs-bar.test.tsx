import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it } from 'vitest';
import { SectionTabsBar } from './section-tabs-bar';
import '@/lib/i18n';

it('shares sticky navigation and preserves transaction query for all section tabs', () => {
  render(<MemoryRouter initialEntries={['/transactions/history?transactions=sample']}>
    <SectionTabsBar section="transactions" search="?transactions=sample" action={<button type="button">New transaction</button>} />
  </MemoryRouter>);
  const bar = screen.getByRole('navigation', { name: 'Section navigation' });
  expect(bar.closest('.section-tabs-sticky')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'New transaction' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/transactions/overview?transactions=sample');
});
it('renders the same shared surface for Wishlist and Collection', () => {
  render(<MemoryRouter><SectionTabsBar section="wishlist" /><SectionTabsBar section="collection" /></MemoryRouter>);
  expect(screen.getAllByRole('navigation', { name: 'Section navigation' })).toHaveLength(2);
  expect(document.querySelectorAll('.section-tabs-sticky')).toHaveLength(2);
});
