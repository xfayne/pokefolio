import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { getFirebaseServices } from './firebase';
import { currencySchema, type Currency, type Money } from '@/domain/schema';
export type Rates = Partial<Record<Currency, number>>;
export function convertDisplay(
  minor: number,
  from: Currency,
  to: Currency,
  rates: Rates,
): number | null {
  if (from === to) return minor;
  const a = rates[from],
    b = rates[to];
  if (
    !a ||
    !b ||
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    a <= 0 ||
    b <= 0
  )
    return null;
  const result = Math.round((minor / a) * b);
  return Number.isSafeInteger(result) ? result : null;
}
async function loadRates(signal: AbortSignal) {
  const response = await fetch(
    'https://api.frankfurter.dev/v2/rates?base=USD',
    {
      signal: AbortSignal.any([signal, AbortSignal.timeout(13000)]),
      credentials: 'omit',
    },
  );
  if (!response.ok) throw Error('FX unavailable');
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw Error('Invalid FX');
  const rates: Rates = { USD: 1 };
  const dates: string[] = [];
  for (const row of rows)
    if (
      row && typeof row === 'object' && row.base === 'USD' &&
      currencySchema.safeParse(row.quote).success &&
      typeof row.rate === 'number' &&
      row.rate > 0 &&
      Number.isFinite(row.rate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.date)
    ) {
      rates[currencySchema.parse(row.quote)] = row.rate;
      dates.push(row.date);
    }
  return { rates, date: dates.sort()[0] ?? null };
}
type Display = {
  currency: Currency;
  convert: (minor: number, from: Currency) => number | null;
  setCurrency: (value: Currency) => Promise<void>;
  date: string | null;
  failed: boolean;
};
const Context = createContext<Display | null>(null);
const local = (key: string): Currency => {
  try {
    const value = currencySchema.safeParse(localStorage.getItem(key));
    return value.success ? value.data : 'USD';
  } catch {
    return 'USD';
  }
};
export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const owner = auth.user?.uid;
  const key = `pokefolio-currency-${owner ?? 'guest'}`;
  const client = useQueryClient();
  const [overrides, setOverrides] = useState<Record<string, Currency>>({});
  const pref = useQuery({
    queryKey: ['display-currency', owner],
    enabled: !!owner,
    queryFn: async () => {
      const s = await getDoc(
        doc(getFirebaseServices()!.db, `users/${owner}/preferences/display`),
      );
      return s.exists() ? currencySchema.parse(s.data().currency) : local(key);
    },
    retry: 1,
  });
  const fx = useQuery({
    queryKey: ['reference-fx'],
    queryFn: ({ signal }) => loadRates(signal),
    staleTime: 6 * 3600000,
    retry: 1,
  });
  const currency = overrides[key] ?? pref.data ?? local(key);
  async function setCurrency(value: Currency) {
    currencySchema.parse(value);
    if (owner)
      await setDoc(
        doc(getFirebaseServices()!.db, `users/${owner}/preferences/display`),
        { currency: value, updatedAt: serverTimestamp() },
      );
    try {
      localStorage.setItem(key, value);
    } catch {
      /* server preference remains available */
    }
    setOverrides((v) => ({ ...v, [key]: value }));
    client.setQueryData(['display-currency', owner], value);
  }
  return (
    <Context
      value={{
        currency,
        convert: (minor, from) =>
          convertDisplay(minor, from, currency, fx.data?.rates ?? { USD: 1 }),
        setCurrency,
        date: fx.data?.date ?? null,
        failed: fx.isError || pref.isError,
      }}
    >
      {children}
    </Context>
  );
}
export function useDisplayCurrency() {
  return useContext(Context);
}
/** Compact rows never display a positive monetary value as zero. */
export function formatCompactCardMoney(minor: number, currency: Currency, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minor > 0 ? Math.max(1, minor / 100) : minor / 100);
}
export function useDisplayMoney(fractionDigits?: number) {
  const display = useDisplayCurrency();
  const { i18n } = useTranslation();
  return (money: Money) => {
    const minor = display
      ? display.convert(money.minor, money.currency)
      : money.minor;
    if (minor === null) return '—';
    if (fractionDigits === 0) {
      // A positive source value can also round to zero minor units during FX conversion.
      return formatCompactCardMoney(money.minor > 0 ? Math.max(1, minor) : minor, display?.currency ?? money.currency, i18n.language);
    }
    return new Intl.NumberFormat(i18n.language, {
          style: 'currency',
          currency: display?.currency ?? money.currency,
          ...(fractionDigits === undefined ? {} : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }),
        }).format(minor / 100);
  };
}
export function CurrencySettings() {
  const display = useDisplayCurrency();
  const { i18n } = useTranslation();
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!display) return null;
  const he = i18n.language === 'he';
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3">
        {he ? 'מטבע תצוגה' : 'Display currency'}
        <select
          className="min-h-11 rounded-lg border p-2 text-base"
          value={display.currency}
          disabled={saving}
          onChange={(e) => {
            setError(false);
            setSaving(true);
            void display
              .setCurrency(currencySchema.parse(e.target.value))
              .catch(() => setError(true))
              .finally(() => setSaving(false));
          }}
        >
          {currencySchema.options.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <p className="text-xs text-slate-600">
        Frankfurter ·{' '}
        {display.date ?? (he ? 'טוען שערי המרה' : 'Loading reference rates')}
      </p>
      {(error || display.failed) && (
        <p role="alert">
          {he
            ? 'שמירת המטבע או טעינת השערים נכשלה.'
            : 'Currency save or rate loading failed.'}
        </p>
      )}
    </div>
  );
}
