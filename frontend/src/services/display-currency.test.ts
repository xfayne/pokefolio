import { expect, it } from 'vitest';
import { convertDisplay, formatCompactCardMoney } from './display-currency';
it('converts reference rates through the USD base, with explicit missing rates', () => {
  const rates = { USD: 1, EUR: 0.8, GBP: 0.5, ILS: 4 };
  expect(convertDisplay(7000, 'EUR', 'ILS', rates)).toBe(35000);
  expect(convertDisplay(305, 'GBP', 'ILS', rates)).toBe(2440);
  expect(convertDisplay(-305, 'GBP', 'USD', rates)).toBe(-610);
  expect(convertDisplay(305, 'GBP', 'USD', { USD: 1 })).toBeNull();
  expect(convertDisplay(305, 'GBP', 'GBP', {})).toBe(305);
});

it('keeps positive compact card prices at least one without changing real zero or ordinary rounding', () => {
  expect(formatCompactCardMoney(1, 'USD', 'en-US')).toBe('$1');
  expect(formatCompactCardMoney(49, 'USD', 'en-US')).toBe('$1');
  expect(formatCompactCardMoney(50, 'USD', 'en-US')).toBe('$1');
  expect(formatCompactCardMoney(149, 'USD', 'en-US')).toBe('$1');
  expect(formatCompactCardMoney(150, 'USD', 'en-US')).toBe('$2');
  expect(formatCompactCardMoney(2808, 'USD', 'en-US')).toBe('$28');
  expect(formatCompactCardMoney(0, 'USD', 'en-US')).toBe('$0');
  expect(formatCompactCardMoney(12, 'EUR', 'en-US')).toBe('€1');
});
