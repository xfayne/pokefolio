# Manual Pokefolio staging preview

The preview workflow is manually dispatched on protected `main` only. It does not run on pull requests, pushes, workflow-run callbacks or a schedule.

Before packaging, `verify-staging-source.mjs` independently reads the current main SHA and requires all four successful GitHub Actions checks for that exact commit. The fixed repository, ref, source SHA and Actions app identity are checked. A stale, unchecked or foreign commit fails before packaging.

`build-staging-preview.mjs` copies only frontend `index.html`, `js/`, `css/`, `assets/` and `deal-finder/` code/styles/images/fonts into a new output directory. Backend code, Firebase policies, docs, hidden files, secrets and user data are excluded. Links and reused output directories are rejected. The generated index loads validated runtime settings before the safety gate and displays a small staging marker.

## Configuration

Repository Actions variable `POKEFOLIO_FIREBASE_WEB_CONFIG` holds the four-field **public Firebase Web configuration** for the already registered staging app: `apiKey`, `projectId`, `authDomain`, `appId`. This public browser configuration is not a Firebase Admin credential. The builder rejects every other project, app, auth domain or extra field; provider credentials must never be placed in it.

The artifact enables only the independent staging Firebase. `workerUrl` is always empty: eBay, AI grading and shipment-provider calls stay disabled, and the separate Worker remains undeployed/unexposed. No private provider key is required or included. A public manifest records source SHA and enabled capabilities without the Web API key or user identity.

The deploy job uses environment `pokefolio-staging`, restricted to main in GitHub settings. The build token has only contents/checks/Pages read access; only the deploy job gets Pages/OIDC write access. GitHub Pages must use the Actions publishing source before the manual run.

## Verification and rollback

```sh
node --test tests/staging-preview.test.mjs
```

Deployment is manual only. Pages uses the Actions publishing source; `pokefolio-staging` permits only branch `main` and no tags. The registered public Web configuration is configured in the repository Actions variable. Enabling a private-Firebase preview does not complete Issue #2's external integrations or public-sharing work.

Verify the deployed manifest SHA, Firebase project, disabled Worker and visible staging marker. Test sign-in and read/write authorization against staging only; never import real collection data for a preview.

To withdraw access, disable this repository's Pages site and apply the verified deny-all staging Firestore rollback if needed. No production site or document is modified. To restore a prior frontend, revert it through a tested PR and manually deploy protected main again. The workflow does not publish arbitrary SHA inputs.

## Verified deployment — 2026-11-19

- URL: https://xfayne.github.io/pokefolio/
- Successful build and deploy: https://github.com/xfayne/pokefolio/actions/runs/44463075103
- Source SHA: `2de8294894dd40735a01610c729bf49d3ed3c271`; all four required checks passed before dispatch.
- Live `pokefolio-staging-manifest.json` matches the source SHA, `pokefolio-staging`, `firebaseEnabled: true`, `workerEnabled: false`.
- Catalog loaded with zero owned/Wishlist/binder cards and a visible staging marker. No collection data was imported or edited.
- After explicit user authorization, Google sign-in from this Pages URL succeeded on 2026-11-19 and the app confirmed successful private collection loading from Firestore. No collection edits, imports or manual sync writes were performed. Earlier localhost synthetic owner/cross-user authorization checks passed, as recorded in PROJECT_CONTEXT.md.
- External providers and public sharing remain disabled; Issue #2 is not complete.
