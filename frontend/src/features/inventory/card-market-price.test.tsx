import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect } from 'vitest';
import '@/lib/i18n';
import { selectInventory } from '@/domain/inventory';
import { CardMarketPrice } from './card-market-price';
import { createSampleCopies, sampleCatalog, sampleOwner, sampleQuotes } from './sample';

const copies = selectInventory(sampleOwner, createSampleCopies(), sampleCatalog, sampleQuotes, 'USD').groups.find(g => g.key === 'base1-4')!.copies;
const catalog = copies[0]!.copy.catalog;
const money = (m: { minor: number }) => String(m.minor);
it('defaults to the best held condition, switches one-card prices without changing copies, and keeps missing prices explicit', async () => {
  const original = structuredClone(copies);
  render(<CardMarketPrice catalog={catalog} copies={copies} quotes={sampleQuotes} currency="USD" money={money} />);
  expect(screen.getByLabelText('Price condition')).toHaveValue('NM');
  expect(screen.getByText('26000')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Price condition'), 'LP');
  expect(screen.getByText('22000')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Price condition'), 'HP');
  expect(screen.getByText('Unpriced')).toBeInTheDocument();
  expect(copies).toEqual(original);
});
it('works with no owned copies and defaults to LP without inferring ownership', () => {
  render(<CardMarketPrice catalog={catalog} copies={[]} quotes={sampleQuotes} currency="USD" money={money} />);
  expect(screen.getByLabelText('Price condition')).toHaveValue('LP');
  expect(screen.getByText('22000')).toBeInTheDocument();
});
it('uses the selected edition only, without falling back to Unlimited prices', async () => {
 const first = {...catalog,edition:'first-edition' as const};
 render(<CardMarketPrice catalog={catalog} copies={[]} quotes={[...sampleQuotes,{catalog:first,condition:'LP',money:{currency:'USD',minor:99999},observedAt:'2026-11-21T00:00:00Z',source:'fixture'}]} currency="USD" money={money} />);
 expect(screen.getByText('22000')).toBeInTheDocument();
 await userEvent.click(screen.getByRole('checkbox',{name:'First Edition'}));
 expect(screen.getByText('99999')).toBeInTheDocument();
 await userEvent.selectOptions(screen.getByLabelText('Price condition'),'HP');
 expect(screen.getByText('Unpriced')).toBeInTheDocument();
});
