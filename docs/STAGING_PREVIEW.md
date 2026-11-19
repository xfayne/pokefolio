# Verified Pokefolio staging preview

The preview workflow accepts manual dispatch on protected `main`, or completion of the main-push `Main UI JavaScript Parity` workflow. Automatic activation requires a successful push event from the same repository, branch `main`, and the triggering SHA must equal the workflow/current main SHA. It never deploys pull request workflow artifacts or code. The existing source guard independently requires all four successful checks for that exact current commit.

Before packaging, `verify-staging-source.mjs` independently reads the current main SHA and requires all four successful GitHub Actions checks for that exact commit. The fixed repository, ref, source SHA and Actions app identity are checked. A stale, unchecked or foreign commit fails before packaging.

`build-staging-preview.mjs` copies only frontend `index.html`, `js/`, `css/`, `assets/` and `deal-finder/` code/styles/images/fonts into a new output directory. Backend code, Firebase policies, docs, hidden files, secrets and user data are excluded. Links and reused output directories are rejected. The generated index loads validated runtime settings before the safety gate and displays a small staging marker.

## Configuration

Repository Actions variable `POKEFOLIO_FIREBASE_WEB_CONFIG` holds the four-field **public Firebase Web configuration** for the already registered staging app: `apiKey`, `projectId`, `authDomain`, `appId`. This public browser configuration is not a Firebase Admin credential. The builder rejects every other project, app, auth domain or extra field; provider credentials must never be placed in it.

The artifact enables only the independent staging Firebase (private collection plus opt-in public binder projection). The exact `pokefolio-api-staging.xfayne.workers.dev` URL can be enabled via manual `enable_api` input and is enabled for successful automatic main-CI deployments. Other URLs are rejected. The API keeps shared-account 17TRACK registration disabled; read-only calls and the existing AI owner policy remain enforced. No private provider key is required or included. A public manifest records source SHA and enabled capabilities without the Web API key or user identity.

The deploy job uses environment `pokefolio-staging`, restricted to main in GitHub settings. The build token has only contents/checks/Pages read access; only the deploy job gets Pages/OIDC write access. GitHub Pages must use the Actions publishing source before the manual run.

## Verification and rollback

```sh
node --test tests/staging-preview.test.mjs
```

Deployment requires verified protected main, whether automatically after main push CI or by manual dispatch. Pages uses the Actions publishing source; `pokefolio-staging` permits only branch `main` and no tags. The registered public Web configuration is configured in the repository Actions variable. Enabling a private-Firebase preview does not complete Issue #2's external integrations or public-sharing work.

Verify the deployed manifest SHA, Firebase project, disabled Worker and visible staging marker. Test sign-in and read/write authorization against staging only; never import real collection data for a preview.

To withdraw access, disable this repository's Pages site and apply the verified deny-all staging Firestore rollback if needed. No production site or document is modified. To restore a prior frontend, revert it through a tested PR and manually deploy protected main again. The workflow does not publish arbitrary SHA inputs. Automatic callbacks with a foreign repository, PR event, non-main branch, failed conclusion or stale SHA are rejected before checkout/build; the source guard rejects any unchecked current main.

## Verified deployment — 2026-11-19

- URL: https://xfayne.github.io/pokefolio/
- Successful build and deploy: https://github.com/xfayne/pokefolio/actions/runs/44463075103
- Source SHA: `2de8294894dd40735a01610c729bf49d3ed3c271`; all four required checks passed before dispatch.
- Live `pokefolio-staging-manifest.json` matches the source SHA, `pokefolio-staging`, `firebaseEnabled: true`, `workerEnabled: false`.
- Catalog loaded with zero owned/Wishlist/binder cards and a visible staging marker. No collection data was imported or edited.
- After explicit user authorization, Google sign-in from this Pages URL succeeded on 2026-11-19 and the app confirmed successful private collection loading from Firestore. No collection edits, imports or manual sync writes were performed. Earlier localhost synthetic owner/cross-user authorization checks passed, as recorded in PROJECT_CONTEXT.md.
- External providers remain disabled; Issue #2 is not complete.

## Public sharing verification — 2026-11-19

PR #36 passed all four required checks, including 24 Firestore emulator tests and browser publication/viewer regression checks. Merged rules blob `4ab7d9b12274af9b631591dabb348d5504f3a03d` was published to staging only. Successful preview run: https://github.com/xfayne/pokefolio/actions/runs/44466136119 ; live manifest source `4dd48e00b60fdb21cb3c303fff5e3e78362d28b1`.

The actual binder button created an empty schema-v2 public projection and owner opt-in settings; the viewer loaded successfully and still loaded after owner sign-out. Private collection progress was not created, imported or changed. Automated cases cover nonempty ordered pockets, null placeholders, all kinds, 1,252 pockets, foreign access, schema pollution, atomic opt-in and link revocation. The public projection is a bounded token string so rules validate every entry; the reader decodes it to the existing 3×3 view. This is not a private collection migration.

Public-sharing rollback: republish the prior private-only rules from PR #31 (blob `0286137cee6c768ac325fbb6897fa27c0b7700f5`) to staging to deny shared reads immediately, or disable the owner's sharing settings. Deny-all remains the full staging rollback. No production environment exists for Pokefolio.

## Backend activation — 2026-11-19

`pokefolio-api-staging` contains the five authorized provider secrets and serves merged PR #38 source `1d55e3a3fe5e918ad59f738c6266e7942c496925` (Worker version `c191f5cb-e28a-449a-8da2-752b928f7016`). Live health and eBay search passed (24 results, no provider errors). The unchanged Gemini core produced a valid image analysis using the configured model; 17TRACK read-only quota authentication passed. No shipment registration, collection import or legacy production deployment change was made. End-to-end authenticated browser use remains part of product regression testing; signed owner authorization is covered by automated tests.
