import { expect, it } from 'vitest';
import { copy, unknown } from '@/domain/fixtures.test-support';
import { planStagingEnglishCorrection } from './english-language-repair';

it('corrects English evidence on every affected physical copy without changing anything else', () => {
  if (copy.catalog.kind !== 'identified') throw Error('Invalid fixture');
  const imported = {
    ...copy, id: 'legacy-1', catalog: { ...copy.catalog, language: unknown },
  };
  const pending = {
    ...imported, id: 'legacy-2', possession: 'pending' as const,
  };
  const sold = {
    ...imported, id: 'legacy-3', disposition: 'sold' as const,
    dispositionRecordId: 'sale',
  };
  const date = '2026-11-23T19:00:00Z';
  const result = planStagingEnglishCorrection('owner', [imported, pending, sold, copy], date);
  expect(result).toHaveLength(3);
  expect(result.map(change => change.after.catalog)).toEqual(
    [imported, pending, sold].map(c => ({
      ...c.catalog, language: { status: 'known', value: 'English', source: 'user' },
    })),
  );
  for (const change of result) {
    expect(change.after).toEqual({
      ...change.before,
      catalog: { ...change.before.catalog, language: { status: 'known', value: 'English', source: 'user' } },
      revision: change.before.revision + 1,
      updatedAt: date,
    });
  }
  expect(imported.catalog.language).toEqual(unknown);
  expect(planStagingEnglishCorrection('owner', result.map(x => x.after), date)).toHaveLength(0);
});

it('refuses foreign/duplicate copies and preserves correct English observations', () => {
  expect(planStagingEnglishCorrection('owner', [copy], '2026-11-23T19:00:00Z')).toEqual([]);
  expect(() => planStagingEnglishCorrection('owner', [copy, copy], '2026-11-23T19:00:00Z')).toThrow();
  expect(() => planStagingEnglishCorrection('other', [copy], '2026-11-23T19:00:00Z')).toThrow();
});
