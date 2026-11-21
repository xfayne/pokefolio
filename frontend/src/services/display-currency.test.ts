import { expect, it } from 'vitest';
import { convertDisplay } from './display-currency';
it('converts reference rates through the USD base, with explicit missing rates', () => {
  const rates = { USD: 1, EUR: 0.8, GBP: 0.5, ILS: 4 };
  expect(convertDisplay(7000, 'EUR', 'ILS', rates)).toBe(35000);
  expect(convertDisplay(305, 'GBP', 'ILS', rates)).toBe(2440);
  expect(convertDisplay(-305, 'GBP', 'USD', rates)).toBe(-610);
  expect(convertDisplay(305, 'GBP', 'USD', { USD: 1 })).toBeNull();
  expect(convertDisplay(305, 'GBP', 'GBP', {})).toBe(305);
});
