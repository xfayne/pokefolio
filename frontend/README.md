# Pokefolio React foundation

Fresh React application for roadmap #3. Files in the repository root (`index.html`, `templates/`, `js/`, `css/`, `deal-finder/`) are legacy reference only: this app does not load them or implement a compatibility bridge.

Use Node 24 LTS (24.11 or later) and npm:

```sh
cd frontend
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Vite serves `/pokefolio/`. Strict TypeScript, Tailwind and a locally owned shadcn-style Button are configured. `components.json` sets up future shadcn additions with RTL. Only required components should be added; do not mix UI systems.

Approved foundations: Axios for HTTP transport, TanStack Query for remote API state, Firebase SDK for auth/Firestore, Zustand for temporary UI state, React Hook Form/Zod for forms and boundary validation, i18next for English/Hebrew, React Router hash routes for Pages. No automatic collection migration or Firestore writes are part of this foundation. Screen designs and binder implementation belong to later roadmap tasks.

The app has Dashboard-first hash routes and English/Hebrew RTL. All product routes are placeholders until their screen designs are approved. The staging pipeline packages only the Vite output; legacy files are never included. Its manifest identifies `react-foundation` and the source SHA. Production release remains #21.

Run browser tests with `npx playwright install chromium` then `npm run test:e2e`. For a local installed Chrome, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can specify its executable. CI always uses the exact Playwright-managed Chromium revision.

## Shared visual foundation (#4)

Use `Card`, `Field`, `EmptyState`, `LoadingState`, `ErrorState` and the locally owned `Button` for screen work. Prefer Tailwind palette/spacing utilities; semantic aliases live in `styles.css`. Import individual icons from `react-icons/lu` to keep the shared line style consistent. Fonts are bundled Latin/Hebrew subsets, with no third-party font request at runtime.

Primary navigation remains visible on product routes and is hidden during the native full-screen Search/Settings dialogs. Route state retains the background screen; direct utility URLs close safely to Dashboard. Search retains only its transient query in Zustand. Actual catalog search and analyzer behavior belong to #16. Settings exposes the foundation language control only.

`npm run test:e2e` exercises modal focus/back behavior, responsive/RTL bounds, contrast via axe and captures English/Hebrew screenshots. CI uploads those captures as `mobile-navigation-checks`. These are review artifacts, not pixel-golden assertions. Do not claim full product-screen visual parity from shell checks.
