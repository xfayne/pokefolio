import { cloneJson, createBackup, digest } from './legacy-backup.mjs';
import { previewLegacy } from './legacy-preview.mjs';

// These are the exact progress fields exported by Vintage Binder's v4
// user-menu JSON backup. No legacy Firestore access, write or normalization.
const progressFields = [
  'owned', 'wish', 'pendingPurchase', 'removedWish', 'conditions', 'notes',
  'purchasePrices', 'firstEdition', 'ownedAddedAt', 'shipments',
  'analyticsSnapshots', 'binderExcluded', 'binderIncludeWish',
  'binderOrder', 'wishOrder',
];

export function previewLegacyUiExport(exported, { ownerUid, catalogIds }) {
  if (!exported || typeof exported !== 'object' || Array.isArray(exported) ||
      exported.app !== 'pokemon-vintage-binder' || exported.version !== 4 ||
      typeof exported.date !== 'string' || !Number.isFinite(Date.parse(exported.date))) {
    throw Error('INVALID_LEGACY_UI_EXPORT');
  }
  if (typeof ownerUid !== 'string' || !ownerUid || ownerUid.length > 128) {
    throw Error('PREVIEW_OWNER_REQUIRED');
  }
  if (progressFields.some(field => !Object.hasOwn(exported, field))) {
    throw Error('INCOMPLETE_LEGACY_UI_EXPORT');
  }
  const progress = Object.fromEntries(progressFields.map(field => [field, cloneJson(exported[field])]));
  const rootPath = `users/${ownerUid}`;
  const sourceContentDigest = digest(exported);
  // The UI export lacks a server-issued Firestore revision and authorization
  // evidence. This synthetic envelope supports preview ONLY, never live apply.
  const backup = createBackup({
    source: {
      projectId: 'unverified-legacy-ui-export',
      ownerUid,
      revision: `ui-v4-content-${sourceContentDigest}`,
      capturedAt: exported.date,
    },
    documents: { [rootPath]: { progress } },
    inventory: [{ path: rootPath, status: 'present' }],
  });
  const report = previewLegacy(backup, {
    rootPath, catalogIds, requiredPaths: [rootPath],
  });
  return {
    kind: 'legacy-ui-export-preview', verifiedLiveSource: false, canApply: false,
    sourceContentDigest, report,
  };
}
