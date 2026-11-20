import { costSchema, currencySchema, fxEvidenceSchema, moneySchema, type Cost, type FxEvidence, type Money, type Sale, saleSchema } from './schema';

export function safeInteger(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Money exceeds safe integer range');
  return Number(value);
}
export function parseMoney(decimal: string, currency: Money['currency']): Money {
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(decimal) || decimal.length > 20) throw new Error('Use a nonnegative decimal with at most two places');
  const [whole = '0', fraction = ''] = decimal.split('.');
  return moneySchema.parse({ currency, minor: safeInteger(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) });
}
export function sumMoney(amounts: readonly Money[], currency: Money['currency']): Money {
  currencySchema.parse(currency);
  const total = amounts.reduce((sum, raw) => {
    const amount = moneySchema.parse(raw);
    if (amount.currency !== currency) throw new Error('Cannot add different currencies');
    return sum + BigInt(amount.minor);
  }, 0n);
  return { currency, minor: safeInteger(total) };
}

/** Order must be canonical line/unit order, never locale sorted IDs or view order. */
export function splitMoney(raw: Money, orderedIds: readonly string[]): ReadonlyMap<string, Money> {
  const total = moneySchema.parse(raw);
  if (!orderedIds.length || new Set(orderedIds).size !== orderedIds.length) throw new Error('Allocation needs distinct physical copies');
  const count = BigInt(orderedIds.length);
  const base = BigInt(total.minor) / count, remainder = BigInt(total.minor) % count;
  return new Map(orderedIds.map((id, i) => [id, { currency: total.currency, minor: Number(base + (BigInt(i) < remainder ? 1n : 0n)) }]));
}

// Profit can be signed; it must not be passed back as a nonnegative expense Money.
export type Metric = { status: 'exact' | 'estimated'; currency: Money['currency']; minor: number } |
  { status: 'unavailable'; reason: string };
export function costBasis(rawCosts: readonly Cost[], currency: Money['currency']): Metric {
  currencySchema.parse(currency);
  if (!rawCosts.length) return { status: 'unavailable', reason: 'No cost evidence' };
  const costs = rawCosts.map((cost) => costSchema.parse(cost));
  if (costs.some((cost) => cost.status === 'unknown' || cost.status === 'unallocated')) return { status: 'unavailable', reason: 'Incomplete cost basis' };
  const amounts = costs.flatMap((cost) => cost.status === 'exact' || cost.status === 'estimated' ? [cost.value] : []);
  if (amounts.some((amount) => amount.currency !== currency)) return { status: 'unavailable', reason: 'Historical FX required' };
  return { ...sumMoney(amounts, currency), status: costs.some((cost) => cost.status === 'estimated') ? 'estimated' : 'exact' };
}
export function netSaleProceeds(input: Sale): Metric {
  const sale = saleSchema.parse(input);
  const components = [sale.cardProceeds, sale.buyerShipping, sale.sellingFees, sale.sellerShipping, sale.sellingTaxes];
  if (components.some((x) => x.status === 'unknown')) return { status: 'unavailable', reason: 'Incomplete sale amounts' };
  const values = components.map((x) => x.status === 'known' ? BigInt(x.value.minor) : 0n);
  const [cards = 0n, buyer = 0n, fees = 0n, shipping = 0n, taxes = 0n] = values;
  return { status: 'exact', currency: sale.currency, minor: safeInteger(cards + buyer - fees - shipping - taxes) };
}
export function realizedProfit(proceeds: Metric, basis: Metric): Metric {
  if (proceeds.status === 'unavailable') return proceeds;
  if (basis.status === 'unavailable') return basis;
  if (proceeds.currency !== basis.currency) return { status: 'unavailable', reason: 'Historical FX required' };
  return { status: proceeds.status === 'estimated' || basis.status === 'estimated' ? 'estimated' : 'exact', currency: proceeds.currency,
    minor: safeInteger(BigInt(proceeds.minor) - BigInt(basis.minor)) };
}

/** Round once, half up, using evidenced historical decimal FX; no live fallback. */
export function convertHistorical(raw: Money, target: Money['currency'], rawFx: FxEvidence | null): Metric {
  const amount = moneySchema.parse(raw);
  currencySchema.parse(target);
  if (amount.currency === target) return { ...amount, status: 'exact' };
  if (!rawFx) return { status: 'unavailable', reason: 'Historical FX missing' };
  const fx = fxEvidenceSchema.parse(rawFx);
  if (fx.from !== amount.currency || fx.to !== target) throw new Error('Historical FX pair mismatch');
  const [whole = '0', fraction = ''] = fx.rateDecimal.split('.');
  const numerator = BigInt(whole + fraction), denominator = 10n ** BigInt(fraction.length);
  const scaled = BigInt(amount.minor) * numerator;
  return { status: fx.quality === 'actual' ? 'exact' : 'estimated', currency: target,
    minor: safeInteger((scaled * 2n + denominator) / (denominator * 2n)) };
}
