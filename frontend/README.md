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

The first toolchain PR leaves Pages deployment on its existing build. Subsequent focused PRs introduce routing/service boundaries and switch the staging artifact to this app after validation. Production release remains #21.
