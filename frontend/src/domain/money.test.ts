import { describe, expect, it } from 'vitest';
import { convertHistorical, costBasis, netSaleProceeds, parseMoney, realizedProfit, splitMoney, sumMoney } from './money';
import { copy, gbp, known, metadata, purchase, unknown } from './fixtures.test-support';
import type { Sale } from './schema';

describe('integer money and financial coverage', () => {
  it('parses decimal strings without floating-point errors', () => {
    expect(parseMoney('0.29', 'GBP')).toEqual(gbp(29));
    expect(parseMoney('20.3', 'GBP')).toEqual(gbp(2030));
    for (const invalid of ['-1', '0.001', '1e2', ' 2', '01.00', '90071992547409.92']) expect(() => parseMoney(invalid, 'GBP')).toThrow();
    expect(() => sumMoney([gbp(Number.MAX_SAFE_INTEGER), gbp(1)], 'GBP')).toThrow();
    expect(() => sumMoney([gbp(1)], 'USD')).toThrow();
  });
  it('splits zero, a single penny and nondivisible shipping in stable unit order', () => {
    for (const [total, expected] of [[0, [0, 0, 0]], [1, [1, 0, 0]], [100, [34, 33, 33]]] as const) {
      expect([...splitMoney(gbp(total), ['c', 'a', 'b']).values()].map((x) => x.minor)).toEqual(expected);
    }
    expect([...splitMoney(gbp(101), ['only']).values()]).toEqual([gbp(101)]);
    expect(() => splitMoney(gbp(1), [])).toThrow();
    expect(() => splitMoney(gbp(1), ['same', 'same'])).toThrow();
  });
  it('reconciles shipping over varied amounts and copy counts', () => {
    for (const count of [1, 2, 3, 7, 60]) for (const minor of [0, 1, 2, 100, 999, Number.MAX_SAFE_INTEGER]) {
      const shares = [...splitMoney(gbp(minor), Array.from({ length: count }, (_, i) => `copy-${i}`)).values()];
      expect(sumMoney(shares, 'GBP').minor).toBe(minor);
      expect(Math.max(...shares.map((x) => x.minor)) - Math.min(...shares.map((x) => x.minor))).toBeLessThanOrEqual(1);
    }
  });
  it('distinguishes net sale proceeds, exact profit, missing basis and estimates', () => {
    const sale: Sale = { ...metadata, id: 'sale', kind: 'sale', transactionOn: '2026-11-20', currency: 'GBP', source: purchase.source, notes: '',
      cardProceeds: known(gbp(3000)), buyerShipping: known(gbp(300)), sellingFees: known(gbp(200)), sellerShipping: known(gbp(400)), sellingTaxes: known(gbp(0)) };
    const net = netSaleProceeds(sale);
    const basis = costBasis([copy.cardCost, copy.shippingCost, copy.taxCost, copy.feeCost], 'GBP');
    expect(net).toEqual({ status: 'exact', currency: 'GBP', minor: 2700 });
    expect(realizedProfit(net, basis)).toEqual({ status: 'exact', currency: 'GBP', minor: 666 });
    expect(realizedProfit(net, costBasis([unknown], 'GBP')).status).toBe('unavailable');
    expect(realizedProfit(net, costBasis([{ status: 'estimated', value: gbp(2000), method: 'Manual lot allocation' }], 'GBP')).status).toBe('estimated');
    expect(netSaleProceeds({ ...sale, sellingFees: unknown }).status).toBe('unavailable');
    expect(netSaleProceeds({ ...sale, cardProceeds: known(gbp(0)) })).toEqual({ status: 'exact', currency: 'GBP', minor: -300 });
    expect(costBasis([{ status: 'unallocated', lotId: 'lot' }], 'GBP').status).toBe('unavailable');
  });
  it('never substitutes display FX for missing historical evidence', () => {
    expect(convertHistorical(gbp(100), 'USD', null).status).toBe('unavailable');
    const fx = { from: 'GBP' as const, to: 'USD' as const, rateDecimal: '1.255', effectiveOn: '2026-11-20', observedAt: metadata.createdAt, source: 'Synthetic', quality: 'actual' as const };
    expect(convertHistorical(gbp(100), 'USD', fx)).toEqual({ status: 'exact', currency: 'USD', minor: 126 });
    expect(convertHistorical(gbp(100), 'USD', { ...fx, quality: 'historical-reference' }).status).toBe('estimated');
    expect(() => convertHistorical(gbp(100), 'EUR', fx)).toThrow();
    expect(costBasis([copy.cardCost], 'USD').status).toBe('unavailable');
  });
});
