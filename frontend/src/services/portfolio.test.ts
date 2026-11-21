import { vi, it, expect, beforeEach } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { purchaseCommit } from '@/domain/purchase-commit';
import { createPurchaseDraft } from '@/features/transactions/purchase-draft-seed';
const state = vi.hoisted(() => ({ store: new Map<string, unknown>() }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  serverTimestamp: () => 'SERVER_TIME',
  collection: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: async (_db: unknown, run: (tx: unknown) => Promise<void>) => {
    const staged = new Map<string, unknown>();
    let wrote = false;
    await run({
      get: async (ref: { path: string }) => {
        if (wrote) throw Error('read after write');
        return {
          ref,
          exists: () => state.store.has(ref.path),
          data: () => state.store.get(ref.path),
        };
      },
      set: (ref: { path: string }, data: unknown) => {
        wrote = true;
        staged.set(ref.path, data);
      },
    });
    staged.forEach((v, k) => state.store.set(k, v));
  },
}));
import { commitPortfolio } from './portfolio';
const db = {} as Firestore;
beforeEach(() => state.store.clear());
it('commits all records and a receipt atomically and replays identical retries', async () => {
  const command = purchaseCommit(
    'owner',
    createPurchaseDraft(true),
    '2026-11-21T00:00:00Z',
  );
  await commitPortfolio(db, 'owner', command);
  const original = new Map(state.store);
  await commitPortfolio(db, 'owner', command);
  expect(state.store).toEqual(original);
  await expect(
    commitPortfolio(db, 'owner', {
      ...command,
      creates: command.creates.map((e) =>
        e.collection === 'transactions'
          ? { ...e, record: { ...e.record, notes: 'changed' } }
          : e,
      ),
    }),
  ).rejects.toThrow('Conflicting');
  expect(state.store).toEqual(original);
});
it('rejects stale edits atomically, even when earlier records could have been written', async () => {
  const draft = createPurchaseDraft(true);
  const command = purchaseCommit('owner', draft, '2026-11-21T00:00:00Z');
  await commitPortfolio(db, 'owner', command);
  const edit = purchaseCommit(
    'owner',
    { ...draft, shipping: '1.00' },
    '2026-11-21T01:00:00Z',
    command.creates,
  );
  await commitPortfolio(db, 'owner', edit);
  const original = new Map(state.store);
  await expect(
    commitPortfolio(db, 'owner', {
      ...edit,
      idempotencyKey: 'another-attempt',
    }),
  ).rejects.toThrow('Record changed');
  expect(state.store).toEqual(original);
  await expect(commitPortfolio(db, 'foreign', command)).rejects.toThrow();
});
