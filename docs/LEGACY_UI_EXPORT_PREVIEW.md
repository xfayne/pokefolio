# Legacy UI JSON preview (Issue #21)

The user-menu **Backup JSON** from Vintage Binder is a normalized v4 export,
not a Firestore server snapshot. It contains the 15 progress fields needed
for a **read-only preliminary inventory and conversion preview**.

`previewLegacyUiExport(exported, { ownerUid, catalogIds })`:
- validates the export identity/version, time and complete field presence;
- constructs a synthetic in-memory backup envelope and invokes the existing
  version-3 `previewLegacy` mapper without changing or sorting input state;
- reports all membership, prices, Binder indices and Wishlist order issues;
- returns `canApply: false` and `verifiedLiveSource: false` unconditionally.

**Never** use this preview-only envelope as authorization to write to
Staging. The export has no Firebase owner UID, server revision, read timestamp,
or authenticated enumeration proof. Before live migration, independently
verify ownership, current source revision/data, and compare source vs.
approved preview. Do not embed or commit a real export to GitHub.

The historical `analyticsSnapshots` are intentionally retained in the
**original source archive only**; the domain materializer excludes them
from active Pokefolio imported data. Legacy Shared Binder and AI analysis
records are out of scope. Unpriced copies retain unknown individual costs.
Mixed-currency parcels remain one purchase with per-currency native subtotals,
without a fabricated combined amount or exchange rate. Additional shipping
is zero because the owner confirms it is included in legacy card prices.

Run synthetic checks:

```sh
node --test tests/legacy-ui-export.test.mjs
```
