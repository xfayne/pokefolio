import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { usePortfolio } from '@/hooks/use-portfolio';
import { auditCopyChange, type CopyChange } from '@/domain/lifecycle';
import { cardCopySchema, type CardCopy } from '@/domain/schema';
import { getEnvironment } from '@/services/environment';
import { getFirebaseServices } from '@/services/firebase';
import { commitPortfolio, readPortfolio } from '@/services/portfolio';
import { planStagingEnglishCorrection } from './english-language-repair';

type Prepared = {
  owner: string;
  copies: readonly CardCopy[];
  changes: readonly CopyChange[];
  unknownFinishes: number;
  filename: string;
  url: string;
};

/**
 * Explicit one-time owner tool. The Firebase rules deployment service account
 * has no permission to read/write collection documents. The logged-in owner
 * can write through existing audited portfolio commands instead.
 *
 * Hidden from regular Settings: #/settings?stagingTools=english
 */
export function StagingEnglishLanguageRepair() {
  const [params] = useSearchParams();
  const account = usePortfolio();
  const client = useQueryClient();
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [savedBackup, setSavedBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const enabled = params.get('stagingTools') === 'english' &&
    getEnvironment()?.firebase.projectId === 'pokefolio-staging';

  useEffect(() => {
    if (!enabled || !account.owner || account.loading || account.error) return;
    const services = getFirebaseServices();
    if (!services || services.db.app.options.projectId !== 'pokefolio-staging' ||
        services.auth.currentUser?.uid !== account.owner) return;
    const owner = account.owner;
    const copies = account.records.flatMap(entry =>
      entry.collection === 'copies' ? [entry.record] : []);
    if (!copies.length) {
      setStatus('No owner copies are available to repair.');
      return;
    }
    try {
      const changes = planStagingEnglishCorrection(owner, copies, new Date().toISOString());
      const backup = {
        schemaVersion: 1,
        projectId: 'pokefolio-staging',
        ownerUid: owner,
        exportedAt: new Date().toISOString(),
        copies: copies.slice().sort((a, b) => a.id.localeCompare(b.id)),
      };
      const json = JSON.stringify(backup, null, 2);
      const reread = JSON.parse(json) as typeof backup;
      if (reread.projectId !== backup.projectId || reread.ownerUid !== owner ||
          reread.copies.length !== copies.length ||
          reread.copies.some((copy, i) =>
            JSON.stringify(cardCopySchema.parse(copy)) !== JSON.stringify(backup.copies[i]))) {
        throw Error('Local backup verification failed');
      }
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      setPrepared({
        owner, copies, changes,
        unknownFinishes: copies.filter(copy =>
          copy.catalog.kind === 'identified' && copy.catalog.finish.status === 'unknown').length,
        filename: `pokefolio-staging-copies-before-english-${backup.exportedAt.slice(0, 10)}.json`,
        url,
      });
      setSavedBackup(false);
      setStatus(`Loaded ${copies.length} copies; ${changes.length} language corrections needed.`);
      return () => URL.revokeObjectURL(url);
    } catch (error) {
      setPrepared(null);
      setStatus(error instanceof Error ? error.message : 'Could not verify backup.');
    }
  }, [enabled, account.owner, account.loading, account.error, account.records]);

  if (!enabled) return null;

  const apply = async () => {
    if (!prepared || !savedBackup || busy) return;
    setBusy(true);
    try {
      const services = getFirebaseServices();
      if (!services || services.db.app.options.projectId !== 'pokefolio-staging' ||
          services.auth.currentUser?.uid !== prepared.owner ||
          account.owner !== prepared.owner) {
        throw Error('Staging owner identity changed; no writes were made.');
      }
      // The downloaded backup contains the exact before-record for every copy.
      // Each committed update also has an immutable before/after audit in Firestore.
      for (let i = 0; i < prepared.changes.length; i += 10) {
        if (services.auth.currentUser?.uid !== prepared.owner)
          throw Error('Signed-in owner changed; repair stopped.');
        const batch = prepared.changes.slice(i, i + 10);
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
        setStatus(`Updated ${Math.min(i + batch.length, prepared.changes.length)}/${prepared.changes.length} copies…`);
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
    <p className="text-sm text-slate-700">One-time data correction in pokefolio-staging only. Copies, purchase prices, conditions, Binder and Wishlist remain unchanged, except the language and audited revision of affected copies.</p>
    {account.loading ? <p>Loading your copies…</p> : account.error ? <p role="alert">Could not load your staging account.</p> : prepared ? <>
      <p className="text-sm">Copies: {prepared.copies.length} · English corrections: {prepared.changes.length} · Unknown finishes (unchanged): {prepared.unknownFinishes}</p>
      {prepared.changes.length > 0 && <>
        <a href={prepared.url} download={prepared.filename} className="inline-flex min-h-11 items-center rounded-lg border border-blue-500 px-3 font-semibold text-blue-700 underline" onClick={() => setSavedBackup(true)}>1. Save verified copy backup (JSON)</a>
        <div><Button disabled={!savedBackup || busy} onClick={() => { void apply(); }}>2. Update {prepared.changes.length} copies to English</Button></div>
      </>}
    </> : <p>Preparing the copy backup…</p>}
    <p role="status" className="text-sm">{status}</p>
  </section>;
}
