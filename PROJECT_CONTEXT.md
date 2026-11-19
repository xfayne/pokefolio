# Pokefolio — Project Context

_Last updated: 2026-11-19 · Pages Google sign-in and public binder sharing verified in staging; external integrations pending; no Pokefolio production environment exists._

## Source of truth

- New repository: https://github.com/xfayne/pokefolio
- Legacy production repository: https://github.com/xfayne/pokemon-vintage-binder
- Roadmap: https://github.com/xfayne/pokefolio/issues
- Source snapshot pinned to legacy main commit `16b89318e77ebea3180461824a09711ae3f93782`.
- Original legacy README and project context are retained verbatim in `docs/LEGACY_README.md` and `docs/LEGACY_PROJECT_CONTEXT.md`. They describe the **legacy** implementation, not Pokefolio deployment status.

## Current state

The safe legacy baseline was imported in PRs #22–#23. The app remains vanilla JavaScript until the approved React/TypeScript migration in #3.

- **Firebase:** independent `pokefolio-staging`, project number `403637067452`, Spark plan; Standard `(default)` Firestore in `europe-west1`. Google sign-in and Web app `1:403637067452:web:ea6738aebf38f14c637ab9` are configured independently. Authorized domains are `localhost`, `pokefolio-staging.firebaseapp.com`, `pokefolio-staging.web.app` and `xfayne.github.io`.
- **Active Firestore policy:** `firebase/firestore.private.rules` from merged PR #36 (blob `4ab7d9b12274af9b631591dabb348d5504f3a03d`) was published only to staging after 24 emulator tests passed. Private roots/settings/analyses retain their owner-only policy. Public schema-v2 binder projections permit single-document gets only when the owner's settings enable that exact link; collection listing, foreign writes, ownership changes and extra/private fields remain denied. The public payload encodes only catalog references and pocket kinds, preserving ordering and empty pockets; private progress is unchanged. Publication atomically commits the snapshot and matching opt-in. Disabling/rotating owner settings revokes old reads without deleting data.
- **Live verification:** a temporary localhost diagnostic verified staging token issuer/audience, own missing collection read, rejected cross-user reads/writes and enumeration, one synthetic analysis create/read/update, rejected invalid update/root deletion/public access, and rejected private reads after sign-out. One explicitly synthetic analysis record remains in staging. The live public-sharing check additionally created one empty public binder projection and owner sharing settings; it did not create/edit the private collection root, Wishlist, binder order or shipments.
- **Rollback:** `firebase/firestore.rules` remains the deny-all bootstrap/rollback source. The pinned `scripts/firebase-staging.mjs` wrapper can deploy only that policy to the exact staging project. Its local validation is tested; remote CLI deployment remains unverified in this restricted terminal.
- **Cloudflare:** `pokefolio-ebay-deals-staging` still has one undeployed deny-only version, zero active deployments/bindings/secrets and disabled public/preview URLs. Full Worker source is pinned to staging Firebase and has 30 signed-token scenarios covering identity isolation. The source has not been deployed. No KV binding is used by the imported Worker, so no unused namespace was created.
- **GitHub:** active main ruleset `27585981` requires a PR, up-to-date `staging-isolation`, `javascript-parity`, `style-parity` and `firestore-rules` checks from GitHub Actions, with zero manual approvals, no bypass actors and deletion/force pushes blocked. Settings were independently read back through the API.
- **Frontend:** cloud connections still default to disabled. The runtime gate accepts only `pokefolio-staging` and the exact independent Worker URL, drops alternate Firebase service endpoints, and never initializes the legacy project. Currency and postal preferences use Pokefolio-only browser keys; no legacy key is read, changed or deleted.
- **Hosting/providers:** the manually triggered Pages workflow now packages a staging-only frontend after verifying the current main SHA and all four checks. It accepts only the registered staging public Web configuration from a repository Actions variable, excludes backend/docs/hidden files, injects runtime settings before the safety gate, marks the environment and emits a non-sensitive source manifest. The Worker URL is always empty. Pages uses the Actions source and https://xfayne.github.io/pokefolio/ was deployed successfully by run `44466136119` from main `4dd48e00b60fdb21cb3c303fff5e3e78362d28b1`, after all four required checks passed. The `pokefolio-staging` deployment environment permits only the `main` branch (no tags). The live manifest matches that SHA, staging Firebase and disabled Worker; the catalog loads with an empty collection and a visible staging marker. After explicit user authorization, a fresh Google sign-in from the deployed Pages URL succeeded on 2026-11-19; the app confirmed the private collection loaded successfully from Firestore. No collection changes, import or manual sync writes were performed. The earlier localhost synthetic owner/cross-user authorization checks also passed. Public binder publication and read-only viewing were verified live, including a reload after owner sign-out. The staging binder is empty; nonempty ordering/empty-pocket/full-capacity cases passed automated tests. External integrations remain unconfigured. The user authorized reuse of legacy provider keys on 2026-11-19; Cloudflare's existing secret-text bindings expose names but not values, and no local Worker key file was found. Values still need secure entry into the new Worker; do not change the legacy Worker to extract them. Reusing 17TRACK credentials does not authorize mutating legacy shipment state. Issue #2 stays open for external integration acceptance.
- **Production:** no separate Pokefolio production Firebase/Worker/deployment has been provisioned. The public Pages URL is a staging preview and remains pinned to staging.

## Product decisions that must be preserved

- Transactions are the primary purchase/sale record; physical copies and eBay lots are distinct, with unknown cost represented explicitly, not invented.
- Preserve all existing binder pocket positions, reserved empty pockets, 3×3 page grouping, page relocation and shared read-only view.
- Preserve manual Wishlist drag ordering, including its behavior when sorted by price.
- Dashboard is the default home. Bottom nav: Collection, Wishlist, Dashboard, Deals and Transactions; top nav: Search, Analyze and Settings.
- Collection includes Overview, Cards and Binder. Mobile-first, compact lists and premium investment-like analytics.
- English default and full Hebrew RTL support.
- No migrations of real data or changes to the legacy production app without an independently verified backup, explicit approval and tested rollback.

## Engineering workflow

- Many focused PRs, all verified with CI before merging; no unapproved architectural or UI redesign.
- `index.html` is generated with `node scripts/build-index.mjs`. Keep generated file identical to its template and catalog sources.
- No secrets or production snapshots in Git. Use fake cloud fixtures in automated tests.
- See `docs/SAFE_IMPORT.md` for the import checklist, history limitation and staging prerequisites.
