# Pokefolio

Mobile-first Pokémon card portfolio application built with React, TypeScript and Vite. The new application lives in `frontend/`. Legacy Vanilla JS files remain as reference only and are not bundled or loaded by the React entrypoint.

## Development

Use Node 24 LTS (24.11 or newer).

```sh
cd frontend
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Open http://localhost:5173/pokefolio/. The Adventure Blue shell defaults to Dashboard, supports hash routes and nested section navigation, and switches English/Hebrew with RTL through Settings. Search opens a full-screen catalog shell, preserving its background route; catalog results remain future work. Routes are placeholders for future screen-specific approved designs, not completed product screens. Binder and Wishlist implementation must retain the reference behavior and ordering requirements.

## Architecture

- React Router for hash navigation on GitHub Pages.
- Tailwind and locally owned shadcn/ui components; add only needed components.
- Named `react-icons/lu` imports for shared icons, with self-hosted Inter and Noto Sans Hebrew.
- Axios for API transport and TanStack Query for remote API state.
- Firebase SDK for Auth/Firestore, with typed services and auth subscriptions.
- Zustand for transient UI state only; never duplicate collection data or tokens in it.
- React Hook Form + Zod for forms/boundary validation; i18next for localization.
- Vitest, Testing Library, Playwright and ESLint for verification.

Local development is disconnected unless supplied the exact validated staging configuration. The frontend rejects foreign/production Firebase projects and alternate API origins. It performs no collection migration or Firestore writes. Inventory/transaction persistence models remain separate roadmap decisions.

## Environments and release

[Staging](https://xfayne.github.io/pokefolio/) publishes from protected main after five current-main checks: staging isolation, JavaScript parity, style parity, Firestore rules and React foundation. The build uses the registered `pokefolio-staging` Web configuration and independent `pokefolio-api-staging`; only the new Vite artifact is shipped. The manifest records its exact source SHA and application. No legacy controllers or backend source are packaged.

Production Firebase/API are already provisioned with authorized provider secrets. Production frontend cutover and any approved real-data import remain #21. The independent [Vintage Binder production app](https://xfayne.github.io/pokemon-vintage-binder/) is unchanged.

## Reference and data safety

Reference source remains in root `index.html`, `templates/`, `js/`, `css/` and `deal-finder/`. Reference index regeneration uses `node scripts/build-index.mjs`; retained regression/security checks continue to run. There is no compatibility bridge or requirement to operate those old screens in Pokefolio.

Never modify legacy production Firestore data. Real data transfer needs an independently verified backup, approved migration, dry-run integrity checks and rollback. Preserve binder positions, empty pockets, page ordering and manual Wishlist ordering.

See [Project context](PROJECT_CONTEXT.md), [React foundation](frontend/README.md), [Production setup](docs/PRODUCTION_SETUP.md), and [safe import](docs/SAFE_IMPORT.md).

Issue #5 starts with the [transaction/inventory domain proposal](docs/DOMAIN_MODEL_PROPOSAL.md).
Its schema and financial policies were owner-approved on 2026-11-20; implementation is in progress.
