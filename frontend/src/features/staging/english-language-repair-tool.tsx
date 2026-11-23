import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { usePortfolio } from '@/hooks/use-portfolio';
import { auditCopyChange } from '@/domain/lifecycle';
import { cardCopySchema, type CardCopy } from '@/domain/schema';
import { getEnvironment } from '@/services/environment';
import { getFirebaseServices } from '@/services/firebase';
import { commitPortfolio, readPortfolio } from '@/services/portfolio';
import { planStagingEnglishCorrection } from './english-language-repair';

/**
 * Explicit one-time owner tool. The Firebase Rules CI service account cannot
 * read/write collection documents; the already signed-in owner can.
 * Hidden from regular Settings: #/settings?stagingTools=english
 */
export function StagingEnglishLanguageRepair() {
  const [params] = useSearchParams();
  const account = usePortfolio();
  const client = useQueryClient();
  const [backupKey, setBackupKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const enabled = params.get('stagingTools') === 'english' &&
    getEnvironment()?.firebase.projectId === 'pokefolio-staging';

  const prepared = useMemo(() => {
    if (!enabled || !account.owner || account.loading || account.error) return null;
    const copies = account.records.flatMap(entry =>
      entry.collection === 'copies' ? [entry.record] : []);
    if (!copies.length || copies.some(copy => copy.ownerUid !== account.owner) ||
        new Set(copies.map(copy => copy.id)).size !== copies.length) return null;
    const changeCount = copies.filter(copy => {
      if (copy.catalog.kind !== 'identified') return false;
      const language = copy.catalog.language;
      return language.status !== 'known' ||
        !['en', 'english'].includes(language.value.trim().toLowerCase());
    }).length;
    return {
      owner: account.owner,
      copies,
      changeCount,
      unknownFinishes: copies.filter(copy =>
        copy.catalog.kind === 'identified' && copy.catalog.finish.status === 'unknown').length,
      // A revision change invalidates the prior backup consent.
      key: JSON.stringify(copies.map(copy => [copy.id, copy.revision, copy.catalog.kind === 'identified' ? copy.catalog.language : null])),
    };
  }, [enabled, account.owner, account.loading, account.error, account.records]);

  if (!enabled) return null;

  const downloadBackup = () => {
    if (!prepared || busy) return;
    try {
      const services = getFirebaseServices();
      if (!services || services.db.app.options.projectId !== 'pokefolio-staging' ||
          services.auth.currentUser?.uid !== prepared.owner) {
        throw Error('Sign in to the verified staging account first.');
      }
      const payload = {
        schemaVersion: 1,
        projectId: 'pokefolio-staging',
        ownerUid: prepared.owner,
        exportedAt: new Date().toISOString(),
        copies: prepared.copies.slice().sort((a, b) => a.id.localeCompare(b.id)),
      };
      const json = JSON.stringify(payload, null, 2);
      const reread = JSON.parse(json) as typeof payload;
      if (reread.projectId !== payload.projectId || reread.ownerUid !== prepared.owner ||
          reread.copies.length !== prepared.copies.length ||
          reread.copies.some((copy, i) =>
            JSON.stringify(cardCopySchema.parse(copy)) !== JSON.stringify(payload.copies[i]))) {
        throw Error('Local backup verification failed');
      }
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `pokefolio-staging-copies-before-english-${payload.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setBackupKey(prepared.key);
      setStatus(`Backed up ${prepared.copies.length} copies. You can apply the English correction.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Backup could not be exported.');
    }
  };

  const apply = async () => {
    if (!prepared || backupKey !== prepared.key || busy) return;
    setBusy(true);
    try {
      const services = getFirebaseServices();
      if (!services || services.db.app.options.projectId !== 'pokefolio-staging' ||
          services.auth.currentUser?.uid !== prepared.owner ||
          account.owner !== prepared.owner) {
        throw Error('Staging owner identity changed; no writes were made.');
      }
      const changes = planStagingEnglishCorrection(
        prepared.owner, prepared.copies as readonly CardCopy[], new Date().toISOString());
      if (changes.length !== prepared.changeCount) throw Error('The copy preview changed; reload.');
      // 10 copies => 10 audited updates + 10 immutable audits + one receipt.
      for (let i = 0; i < changes.length; i += 10) {
        if (services.auth.currentUser?.uid !== prepared.owner)
          throw Error('Signed-in owner changed; repair stopped.');
        const batch = changes.slice(i, i + 10);
        const creates = batch.map(change => ({
          collection: 'revisions' as const,
          record: auditCopyChange(change, `language-${crypto.randomUUID()}`,
            'Owner-confirmed correction of imported English card language', 'edit'),
        }));
        await commitPortfolio(services.db, prepared.owner, {
          ownerUid: prepared.owner,
          idempotencyKey: `language-${crypto.randomUUID()}`,
          creates,
          updates: batch.map(change => ({
            before: { collection: 'copies' as const, record: change.before },
            after: { collection: 'copies' as const, record: change.after },
          })),
        });
        setStatus(`Updated ${Math.min(i + batch.length, changes.length)}/${changes.length} copies…`);
      }
      const latest = await readPortfolio(services.db, prepared.owner);
      const latestCopies = latest.flatMap(entry => entry.collection === 'copies' ? [entry.record] : []);
      const unresolved = planStagingEnglishCorrection(prepared.owner, latestCopies, new Date().toISOString());
      if (latestCopies.length !== prepared.copies.length || unresolved.length)
        throw Error(`Verification failed: ${unresolved.length} English corrections remain; reload and retry.`);
      setStatus(`Verified ${latestCopies.length} copies: all identified card languages are English. Other fields were preserved.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Staging repair failed. No further writes made.');
    } finally {
      setBusy(false);
      await client.invalidateQueries({ queryKey: ['portfolio', prepared.owner] });
    }
  };

  return <section className="space-y-3 rounded-xl border border-blue-300 bg-blue-50 p-3" aria-label="Staging English copy repair">
    <h2 className="font-bold">Staging: repair imported card languages</h2>
    <p className="text-sm text-slate-700">One-time correction in pokefolio-staging only. Copy condition, edition, finish, costs, Binder and Wishlist are unchanged. Every correction has a reversible audit.</p>
    {account.loading ? <p>Loading your copies…</p> : account.error ? <p role="alert">Could not load your staging account.</p> : prepared ? <>
      <p className="text-sm">Copies: {prepared.copies.length} · English corrections: {prepared.changeCount} · Unknown finishes (unchanged): {prepared.unknownFinishes}</p>
      {prepared.changeCount > 0 && <>
        <Button variant="outline" disabled={busy} onClick={downloadBackup}>1. Download verified copy backup (JSON)</Button>
        <div><Button disabled={backupKey !== prepared.key || busy} onClick={() => { void apply(); }}>2. Update {prepared.changeCount} copies to English</Button></div>
      </>}
    </> : <p>Loading copy records…</p>}
    <p role="status" className="text-sm">{status}</p>
  </section>;
}
